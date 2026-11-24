"""Measure whether the expected source appears among the top three retrieved chunks."""

from __future__ import annotations

import json
import os
from pathlib import Path

from data.pipelines.rag import retrieve

ROOT = Path(__file__).resolve().parents[2]
QUERIES = ROOT / "data" / "eval" / "rag-test-queries.json"


def main() -> int:
    cases = json.loads(QUERIES.read_text(encoding="utf-8"))
    minimum_score = float(os.getenv("RAG_MIN_SCORE", "0.45"))
    hits = 0
    for case in cases:
        results = retrieve(case["question"], k=3, min_score=minimum_score)
        hit = any(
            item.get("source_document") == case["expected_source_document"]
            and item.get("section") == case["expected_section"]
            for item in results
        )
        hits += int(hit)
        print(f"{'HIT' if hit else 'MISS'}: {case['question']}")
    recall_at_3 = hits / len(cases) if cases else 0.0
    print(f"Recall@3: {hits}/{len(cases)} = {recall_at_3:.1%}")
    return 0 if recall_at_3 >= 0.8 else 1


if __name__ == "__main__":
    raise SystemExit(main())
