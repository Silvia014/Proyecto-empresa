"""Evaluate Brasaland's existing sales model within 2016–2023."""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from sklearn.model_selection import TimeSeriesSplit

from scripts.train_sales_forecast import (
    fit_sales_model,
    forecast_sales,
    sales_features,
    split_sales,
)


def chronological_folds(history):
    dates = pd.DatetimeIndex(history["month"])
    if dates.empty or not dates.equals(pd.date_range(dates[0], periods=len(dates), freq="MS")):
        raise ValueError("History must contain consecutive, ordered months.")
    return TimeSeriesSplit(n_splits=5, test_size=8).split(history)


def score_fold(train, validation):
    model = fit_sales_model(train)
    revenue = train["revenue_usd"].reset_index(drop=True)
    # Score the same final eight fitted targets for every size at a given origin.
    positions = range(len(train) - len(validation), len(train))
    features = pd.DataFrame([
        sales_features(revenue.iloc[:i], train["month"].iloc[i]) for i in positions
    ])
    fitted = features["sales_lag_12_usd"] * (1 + model.predict(features))
    actual_train = revenue.iloc[list(positions)]
    forecast = forecast_sales(model, train, validation["month"])
    actual = validation["revenue_usd"]
    return {
        "train_mae": mean_absolute_error(actual_train, fitted),
        "train_rmse": root_mean_squared_error(actual_train, fitted),
        "validation_mae": mean_absolute_error(actual, forecast["forecast_usd"]),
        "validation_rmse": root_mean_squared_error(actual, forecast["forecast_usd"]),
        "baseline_mae": mean_absolute_error(actual, forecast["baseline_usd"]),
        "mean_residual_usd": (actual.to_numpy() - forecast["forecast_usd"]).mean(),
    }


def evaluate(history):
    folds, curve = [], []
    for fold, (fit_indices, validation_indices) in enumerate(chronological_folds(history), 1):
        train = history.iloc[fit_indices]
        validation = history.iloc[validation_indices]
        folds.append({
            "fold": fold,
            "training_months": len(train),
            "validation_start": validation["month"].iloc[0].strftime("%Y-%m"),
            "validation_end": validation["month"].iloc[-1].strftime("%Y-%m"),
            **score_fold(train, validation),
        })
        for size in (24, 32, 40, 48, 56):
            curve.append({
                "fold": fold,
                "training_months": size,
                **score_fold(train.tail(size), validation),
            })
    return pd.DataFrame(folds), pd.DataFrame(curve)


def main():
    root = Path(__file__).resolve().parents[1]
    history, _ = split_sales(pd.read_csv(root / "data/raw/brasaland_sales.csv"))
    folds, curve = evaluate(history)
    output = root / "data/eval"
    output.mkdir(parents=True, exist_ok=True)
    folds.to_csv(output / "sales_cv_folds.csv", index=False, float_format="%.2f")
    curve.to_csv(output / "sales_learning_curve.csv", index=False, float_format="%.2f")

    fig, axes = plt.subplots(1, 2, figsize=(10, 4), layout="constrained")
    for ax, metric in zip(axes, ("mae", "rmse"), strict=True):
        groups = curve.groupby("training_months")
        for split, name in (("train", "Entrenamiento"), ("validation", "Validación")):
            summary = groups[f"{split}_{metric}"].agg(["mean", "std"]) / 1000
            ax.plot(summary.index, summary["mean"], marker="o", label=name)
            ax.fill_between(
                summary.index, summary["mean"] - summary["std"],
                summary["mean"] + summary["std"], alpha=0.15,
            )
        ax.set(xlabel="Meses de historial por fold", ylabel=f"{metric.upper()} (miles de USD)")
        ax.set_xticks(summary.index)
        ax.legend()
    fig.suptitle("Brasaland | Curva de aprendizaje con cinco cortes temporales")
    fig.savefig(output / "learning_curve.png", dpi=135)
    plt.close(fig)

    print(folds.round(2).to_string(index=False))
    print(folds.iloc[:, 4:].agg(["mean", "std"]).round(2).to_string())
    print(curve.groupby("training_months").mean().round(2).to_string())


if __name__ == "__main__":
    main()
