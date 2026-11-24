import pandas as pd


def split_sales(sales: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    sales = sales.loc[sales["market"].eq("consolidated")].copy()
    sales["month"] = pd.to_datetime(sales["month"], format="%Y-%m-%d")
    sales = sales.sort_values("month").reset_index(drop=True)

    expected = pd.date_range("2016-01-01", "2025-12-01", freq="MS")
    if not pd.DatetimeIndex(sales["month"]).equals(expected):
        raise ValueError("Se esperaba una fila por mes de enero de 2016 a diciembre de 2025.")

    if sales["revenue_usd"].isna().any() or (sales["revenue_usd"] <= 0).any():
        raise ValueError("Las ventas mensuales deben estar presentes y ser positivas.")

    cutoff = pd.Timestamp("2024-01-01")
    return sales.loc[sales["month"] < cutoff].copy(), sales.loc[
        sales["month"] >= cutoff
    ].copy()


def sales_features(history: pd.Series, month: pd.Timestamp) -> dict:
    last_year = history.iloc[-12]
    return {
        "calendar_month": month.month,
        "sales_lag_1_ratio": history.iloc[-1] / last_year,
        "sales_lag_12_usd": last_year,
        "rolling_3_ratio": history.iloc[-3:].mean() / last_year,
    }


def fit_sales_model(train: pd.DataFrame):
    from sklearn.ensemble import RandomForestRegressor

    revenue = train["revenue_usd"].reset_index(drop=True)
    features = pd.DataFrame([
        sales_features(revenue.iloc[:i], train["month"].iloc[i])
        for i in range(12, len(train))
    ])
    growth = (revenue / revenue.shift(12) - 1).iloc[12:]

    # Con una serie mensual pequeña, un bosque poco profundo permite
    # capturar estacionalidad e interacciones con poco ajuste inicial.
    model = RandomForestRegressor(
        n_estimators=200, max_depth=4, min_samples_leaf=3, random_state=42
    )
    return model.fit(features, growth)


def forecast_sales(model, train: pd.DataFrame, months: pd.Series) -> pd.DataFrame:
    history = train["revenue_usd"].reset_index(drop=True).copy()
    baseline_history = history.copy()
    rows = []

    for month in months:
        features = sales_features(history, month)
        growth = model.predict(pd.DataFrame([features]))[0]
        predicted = features["sales_lag_12_usd"] * (1 + growth)
        baseline = baseline_history.iloc[-12]
        rows.append((month, predicted, baseline))

        history.loc[len(history)] = predicted
        baseline_history.loc[len(baseline_history)] = baseline

    return pd.DataFrame(rows, columns=["month", "forecast_usd", "baseline_usd"])


def main():
    from pathlib import Path

    from sklearn.metrics import mean_absolute_error

    root = Path(__file__).resolve().parents[1]
    sales = pd.read_csv(root / "data/raw/brasaland_sales.csv")
    train, test = split_sales(sales)
    model = fit_sales_model(train)
    forecast = forecast_sales(model, train, test["month"])
    results = forecast.merge(test[["month", "revenue_usd"]], on="month",
                             validate="one_to_one")

    print(f"Meses pronosticados: {len(results)}")
    for label, column in [
        ("Random Forest", "forecast_usd"),
        ("Referencia estacional", "baseline_usd"),
    ]:
        mae = mean_absolute_error(results["revenue_usd"], results[column])
        print(f"{label} — error absoluto medio: USD {mae:,.2f} por mes")


if __name__ == "__main__":
    main()
