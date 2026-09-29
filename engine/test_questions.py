"""Gerador de perguntas académicas (engine/questions.py) — pytest.

Cobertura nova (2026-09-29): o projeto não tinha NENHUM teste para
questions.py. Portagem dos testes unittest antigos para a API atual
(itens com `type`/`answer`/`topic`; ValueError para análises
indeterminadas ou tecidos sem entrada pedagógica).

Correr com:  pytest -q engine/  (ou  -m "not gallery" para o conjunto rápido)
"""
from __future__ import annotations

import pytest

from questions import STRUCTURE_GLOSSARY, TISSUE_PT, generate_questions

ANALYSIS = {
    "tissue": "epithelial",
    "features": {
        "n_nuclei": 120,
        "nuclei_per_mm2": 42.5,
        "median_nucleus_area": 62.0,
        "median_circularity": 0.88,
        "median_elongation": 1.6,
        "stromal_ratio": 0.22,
        "empty_ratio": 0.05,
    },
}

MCQ = "mcq"
OPEN = "open"
FILL = "fill_blank"
RANK = {"easy": 0, "medium": 1, "hard": 2}


def test_returns_requested_number_of_questions() -> None:
    for n in (1, 4, 6, 9):
        assert len(generate_questions(ANALYSIS, n=n, seed=1)) == n


def test_every_question_satisfies_the_contract() -> None:
    seen_topics: set[str] = set()
    for item in generate_questions(ANALYSIS, n=9, seed=7):
        assert item["type"] in (MCQ, OPEN, FILL)
        assert item["question"].strip()
        assert item["answer"].strip()
        assert item["explanation"].strip()
        assert item["topic"].strip()
        assert item["difficulty"] in RANK
        seen_topics.add(item["topic"])
        if item["type"] in (MCQ, FILL):
            assert len(item["options"]) >= 4
            assert item["answer"] in item["options"]
            assert len(set(item["options"])) == len(item["options"])
        if item["type"] == FILL:
            assert item["acceptableAnswers"]
            assert item["answer"] in item["acceptableAnswers"]
    # O pool cobre ângulos distintos (não é o mesmo MCQ repetido).
    assert len(seen_topics) >= 5


def test_difficulty_easy_orders_items_easiest_first() -> None:
    items = generate_questions(ANALYSIS, n=9, difficulty="easy", seed=3)
    ranks = [RANK[q["difficulty"]] for q in items]
    assert ranks == sorted(ranks)


def test_same_seed_is_deterministic() -> None:
    assert generate_questions(ANALYSIS, n=5, seed=99) == generate_questions(ANALYSIS, n=5, seed=99)


def test_different_seeds_shuffle_options() -> None:
    a = generate_questions(ANALYSIS, n=6, seed=1)
    b = generate_questions(ANALYSIS, n=6, seed=2)
    assert a[0]["question"] == b[0]["question"]
    assert a[0]["options"] != b[0]["options"] or a[1]["options"] != b[1]["options"]


def test_stroma_value_drives_the_quantitative_answer() -> None:
    def answer(stroma: float) -> str:
        analysis = {"tissue": "epithelial", "features": {**ANALYSIS["features"], "stromal_ratio": stroma}}
        for item in generate_questions(analysis, n=11, seed=5):
            if "razão de estroma" in item["question"]:
                return item["answer"]
        raise AssertionError("pergunta quantitativa não encontrada no pool")

    assert "epitélios" in answer(0.22)
    assert "conjuntivo frouxo" in answer(0.62)


def test_indeterminate_analysis_raises_value_error() -> None:
    with pytest.raises(ValueError, match="indeterminada"):
        generate_questions({"tissue": "indeterminate", "features": ANALYSIS["features"]})


def test_empty_features_raises_value_error() -> None:
    with pytest.raises(ValueError, match="indeterminada"):
        generate_questions({"tissue": "epithelial", "features": {}})


def test_unknown_tissue_raises_value_error() -> None:
    with pytest.raises(ValueError, match="sem entrada pedagógica"):
        generate_questions({"tissue": "bogus_tissue", "features": ANALYSIS["features"]})


def test_every_known_tissue_generates_questions() -> None:
    for tissue in TISSUE_PT:
        items = generate_questions({"tissue": tissue, "features": ANALYSIS["features"]}, n=3, seed=4)
        assert len(items) == 3


def test_full_pool_contains_fill_blanks_for_the_ui_filter() -> None:
    items = generate_questions(ANALYSIS, n=50, seed=8)
    assert items == generate_questions(ANALYSIS, n=999, seed=8)
    fill = [q for q in items if q["type"] == FILL]
    assert fill, "o modo offline precisa de fill_blanks para o filtro da UI"
    assert set(STRUCTURE_GLOSSARY) == set(TISSUE_PT)
