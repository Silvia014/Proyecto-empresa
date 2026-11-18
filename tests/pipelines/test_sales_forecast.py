from pathlib import Path

import pandas as pd

from scripts.train_sales_forecast import split_sales


def test_sales_split_uses_first_eight_years_and_last_two():
    root = Path(__file__).resolve().parents[2]
    sales = pd.read_csv(root / "data/raw/brasaland_sales.csv")

    train, test = split_sales(sales)

    expected_train = pd.date_range("2016-01-01", "2023-12-01", freq="MS")
    expected_test = pd.date_range("2024-01-01", "2025-12-01", freq="MS")

    assert pd.DatetimeIndex(train["month"]).equals(expected_train)
    assert pd.DatetimeIndex(test["month"]).equals(expected_test)
    assert train["month"].max() < test["month"].min()
