"""Refresh the ERP sales outlook from complete years of consolidated sales."""

import csv
import json
from collections import defaultdict
from pathlib import Path
from statistics import mean, median

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/raw/brasaland_sales.csv"
OUTPUT = ROOT / "uis/talent-pipeline-tracker/app/dashboard/business-intelligence/sales-outlook.json"


def load_sales():
    sales = defaultdict(dict)
    with SOURCE.open(newline="") as source:
        for row in csv.DictReader(source):
            if row["market"] != "consolidated":
                continue
            year, month, _ = map(int, row["month"].split("-"))
            revenue = float(row["revenue_usd"])
            if month in sales[year] or not 0 < revenue < float("inf"):
                raise ValueError(f"Invalid or duplicate revenue for {year}-{month:02}")
            sales[year][month] = revenue

    years = sorted(sales)
    if len(years) < 5 or years != list(range(years[0], years[-1] + 1)):
        raise ValueError("Expected at least five consecutive years of sales.")
    if any(set(sales[year]) != set(range(1, 13)) for year in years):
        raise ValueError("The outlook requires twelve months per year.")
    return sales, years


def build_outlook(sales, years):
    totals = {year: sum(sales[year].values()) for year in years}

    def trend_before(year):
        return median(totals[y] / totals[y - 1] for y in range(year - 3, year))

    baseline_errors, trend_errors = [], []
    for year in years[4:]:
        trend = trend_before(year)
        for month, actual in sales[year].items():
            prior = sales[year - 1][month]
            baseline_errors.append(abs(prior - actual))
            trend_errors.append(abs(prior * trend - actual))

    cutoff = years[-1]
    trend = trend_before(cutoff + 1)
    january_ratios = [sales[y][1] / mean(sales[y].values()) for y in years]
    return {
        "firstYear": years[0],
        "lastYear": cutoff,
        "januaryTypicalChangePercent": round(100 * (median(january_ratios) - 1), 1),
        "januaryBottomThreeYears": sum(
            1 in sorted(sales[y], key=sales[y].__getitem__)[:3] for y in years
        ),
        "backtestStartYear": years[4],
        "baselineMaeUsd": round(mean(baseline_errors)),
        "outlookMaeUsd": round(mean(trend_errors)),
        "estimates": [
            {"month": f"{cutoff + 1}-12", "revenueUsd": round(sales[cutoff][12] * trend)},
            {"month": f"{cutoff + 2}-01", "revenueUsd": round(sales[cutoff][1] * trend**2)},
        ],
    }


if __name__ == "__main__":
    OUTPUT.write_text(json.dumps(build_outlook(*load_sales()), indent=2) + "\n")
