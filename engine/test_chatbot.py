"""Tutor offline (engine/chatbot.py) — pytest.

Cobertura nova (2026-09-29): o projeto não tinha NENHUM teste para
chatbot.py. Portagem dos testes unittest antigos para a API atual
(`chat_reply(message, tissue, features)` → {reply, suggestions}).

Correr com:  pytest -q engine/  (ou  -m "not gallery" para o conjunto rápido)
"""
from __future__ import annotations

from chatbot import FALLBACK, KB, chat_reply

FEATURES = {
    "n_nuclei": 120,
    "nuclei_per_mm2": 42.5,
    "median_nucleus_area": 62.0,
    "median_circularity": 0.88,
    "stromal_ratio": 0.22,
    "empty_ratio": 0.05,
}


def test_stain_question_matches_hematoxylin_intent() -> None:
    out = chat_reply("O que cora a hematoxilina?")
    assert "hematoxilina" in out["reply"].lower()
    assert out["suggestions"]


def test_every_kb_intent_is_reachable() -> None:
    for key, entry in KB.items():
        assert entry["answer"].strip()
        assert len(entry["links"]) >= 2
        assert entry["keywords"], f"intent {key} sem keywords"


def test_unknown_message_returns_fallback_with_suggestions() -> None:
    out = chat_reply("zzz qqwwxyz sem sentido")
    assert out["reply"] == FALLBACK
    assert len(out["suggestions"]) >= 2


def test_empty_message_returns_fallback() -> None:
    assert chat_reply("")["reply"] == FALLBACK
    assert chat_reply("   ")["reply"] == FALLBACK


def test_tissue_context_prefix_is_prepended() -> None:
    out = chat_reply("O que cora a hematoxilina?", tissue="epithelial")
    assert out["reply"].startswith("Considerando a tua imagem")


def test_unknown_tissue_context_is_ignored() -> None:
    out = chat_reply("O que cora a hematoxilina?", tissue="unknown_tissue")
    assert not out["reply"].startswith("Considerando a tua imagem")


def test_image_metrics_are_appended_for_analysis_intents() -> None:
    out = chat_reply("Como funciona a análise automática?", features=FEATURES)
    assert "120 núcleos" in out["reply"]
    assert "42.5" in out["reply"]


def test_metrics_are_not_injected_into_unrelated_answers() -> None:
    out = chat_reply("O que cora a eosina?", features=FEATURES)
    assert "120 núcleos" not in out["reply"]


def test_numeric_question_reports_measured_features() -> None:
    out = chat_reply("Quantos núcleos tem esta imagem?", features=FEATURES)
    assert "120" in out["reply"]


def test_numeric_question_without_features_stays_on_topic() -> None:
    out = chat_reply("Quantos núcleos tem esta imagem?")
    assert "núcleos em h&e" in out["reply"].lower()


def test_metrics_line_omits_missing_fields() -> None:
    out = chat_reply("Como funciona a análise automática?", features={"n_nuclei": 7})
    assert "7 núcleos" in out["reply"]
    assert "None" not in out["reply"]
