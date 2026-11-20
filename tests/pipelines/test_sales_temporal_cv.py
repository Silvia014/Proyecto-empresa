from pathlib import Path

import pandas as pd
import pytest

from scripts.evaluate_sales_learning_curve import chronological_folds
from scripts.train_sales_forecast import split_sales


def test_sales_cv_preserves_chronology():
    root = Path(__file__).resolve().parents[2]
    history, _ = split_sales(pd.read_csv(root / "data/raw/brasaland_sales.csv"))

    folds = list(chronological_folds(history))
    assert len(folds) == 5
    previous_end = -1
    for fit, validation in folds:
        assert fit.tolist() == list(range(validation[0]))
        assert validation.tolist() == list(range(validation[0], validation[0] + 8))
        assert previous_end < validation[0]
        assert history["month"].iloc[fit[-1]] < history["month"].iloc[validation[0]]
        assert history["month"].iloc[validation[-1]] < pd.Timestamp("2024-01-01")
        previous_end = validation[-1]

    with pytest.raises(ValueError, match="ordered months"):
        list(chronological_folds(history.iloc[::-1]))
