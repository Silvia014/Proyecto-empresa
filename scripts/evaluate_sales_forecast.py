import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from scipy.stats import normaltest
from sklearn.metrics import auc
from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
)

from train_sales_forecast import fit_sales_model, forecast_sales, split_sales


def population_stability_index(train_revenue, test_revenue):
    cutoffs = np.unique(train_revenue.quantile([.2, .4, .6, .8]))
    bins = np.r_[-np.inf, cutoffs, np.inf]

    def proportions(values):
        counts = np.histogram(values, bins=bins)[0] + 0.5
        return counts / counts.sum()

    reference = proportions(train_revenue)
    observed = proportions(test_revenue)
    return float(np.sum((observed - reference) * np.log(observed / reference)))


def normalized_gini(actual, predicted):
    def ordered_gini(score):
        groups = (
            pd.DataFrame({"actual": actual, "score": score})
            .groupby("score", sort=True)["actual"]
            .agg(["sum", "size"])
        )
        x = np.r_[0, groups["size"].cumsum() / len(actual)]
        y = np.r_[0, groups["sum"].cumsum() / groups["sum"].sum()]
        return 1 - 2 * auc(x, y)

    return float(ordered_gini(predicted) / ordered_gini(actual))


def main():
    root = Path(__file__).resolve().parents[1]
    sales = pd.read_csv(root / "data/raw/brasaland_sales.csv")
    train, test = split_sales(sales)

    # Tres pronósticos históricos de 24 meses. Cada modelo solo ve
    # los datos anteriores a su fecha de emisión.
    calibration = []
    for cutoff in (48, 60, 72):
        history = train.iloc[:cutoff]
        actual = train.iloc[cutoff:cutoff + 24].reset_index(drop=True)
        historical = forecast_sales(
            fit_sales_model(history), history, actual["month"]
        )
        calibration.append(pd.DataFrame({
            "horizon_year": [1] * 12 + [2] * 12,
            "error_usd": actual["revenue_usd"] - historical["forecast_usd"],
        }))

    errors = pd.concat(calibration, ignore_index=True)
    bands = errors.groupby("horizon_year")["error_usd"].quantile(
        [0.10, 0.90]
    ).unstack().rename(columns={0.10: "lower_error", 0.90: "upper_error"})

    results = forecast_sales(fit_sales_model(train), train, test["month"])
    results = results.merge(test[["month", "revenue_usd"]], on="month",
                            validate="one_to_one")
    results["horizon_year"] = [1] * 12 + [2] * 12
    results = results.join(bands, on="horizon_year")
    predicted = results["forecast_usd"]
    actual = results["revenue_usd"]
    results["lower_usd"] = (predicted + results["lower_error"]).clip(lower=0)
    results["upper_usd"] = predicted + results["upper_error"]

    residuals = actual - predicted
    normality = normaltest(residuals)
    metrics = {
        "residual_normality_k2": float(normality.statistic),
        "residual_normality_p_value": float(normality.pvalue),
        "mean_residual_usd": float(residuals.mean()),
        "mae_usd": mean_absolute_error(actual, predicted),
        "baseline_mae_usd": mean_absolute_error(actual, results["baseline_usd"]),
        "mape_percent": 100 * mean_absolute_percentage_error(actual, predicted),
        "mse_usd_squared": mean_squared_error(actual, predicted),
        "r2": r2_score(actual, predicted),
        "psi_revenue_train_vs_test": population_stability_index(
            train["revenue_usd"], actual
        ),
        "gini_normalized_test": normalized_gini(actual, predicted),
        "band_coverage_percent": 100 * actual.between(
            results["lower_usd"], results["upper_usd"]
        ).mean(),
        "mean_band_width_usd": (
            results["upper_usd"] - results["lower_usd"]
        ).mean(),
    }

    output = root / "reports" / "sales_forecast"
    output.mkdir(parents=True, exist_ok=True)
    results.to_csv(output / "predictions.csv", index=False)
    (output / "metrics.json").write_text(
        json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
    )

    fig, ax = plt.subplots(figsize=(11, 5), layout="constrained")
    ax.plot(results["month"], actual, color="black", label="Ventas reales")
    ax.plot(results["month"], predicted, color="tab:blue", label="Pronóstico")
    ax.fill_between(
        results["month"], results["lower_usd"], results["upper_usd"],
        color="tab:blue", alpha=0.20, label="Banda histórica P10–P90",
    )
    ax.set(title="Brasaland · pronóstico mensual 2024–2025", ylabel="Ventas (USD)")
    ax.legend()
    fig.savefig(output / "forecast.png", dpi=160)
    plt.close(fig)

    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
