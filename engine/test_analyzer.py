"""Testes do motor local de análise histológica (pytest).

Primeiro conjunto de testes do projeto (2026-09-28 — antes existiam zero):
- guarda "indeterminate" para imagens sem tecido classificável;
- contrato do resultado (chaves, tipos, intervalos);
- as 12 imagens da galeria correm sem excepção e classificam dentro do
  conjunto de tecidos conhecido.

Correr com:  pytest -q engine/
"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
import pytest

from analyzer import analyze_image

HERE = Path(__file__).parent
GALLERY = HERE / "static" / "gallery"


def _solid(bgr: tuple[int, int, int], size: int = 512) -> np.ndarray:
    img = np.full((size, size, 3), bgr[::-1], dtype=np.uint8)  # RGB→BGR
    return img


def test_imagem_branca_e_indeterminada() -> None:
    """Sem núcleos segmentáveis, o resultado honesto é indeterminado (conf 0)."""
    result = analyze_image(_solid((255, 255, 255)))
    assert result["tissue"] == "indeterminate"
    assert result["tissue_confidence"] == 0.0
    assert result["evidence"][0]["type"] == "insuficiente"


def test_imagem_preta_e_indeterminada() -> None:
    """Bug corrigido 2026-09-28: devolvia 'epithelial' com confiança 0."""
    result = analyze_image(_solid((0, 0, 0)))
    assert result["tissue"] == "indeterminate"


def test_contrato_do_resultado() -> None:
    result = analyze_image(_solid((120, 200, 230)))  # tons rosados (eosina)
    assert set(result) == {
        "features", "tissue", "tissue_confidence", "evidence", "nuclei", "overlay_jpg_b64",
    }
    assert isinstance(result["features"], dict)
    assert 0.0 <= result["tissue_confidence"] <= 1.0
    f = result["features"]
    for key in (
        "n_nuclei", "nuclei_per_mm2", "median_nucleus_area", "nucleus_area_cv",
        "median_circularity", "median_elongation", "stromal_ratio", "empty_ratio",
        "hematoxylin_mean", "eosin_mean",
    ):
        assert key in f
    assert 0.0 <= f["stromal_ratio"] <= 1.0
    assert 0.0 <= f["empty_ratio"] <= 1.0


@pytest.mark.parametrize("item", json.loads((HERE / "gallery_meta.json").read_text(encoding="utf-8")), ids=lambda i: i["key"])
def test_galeria_classifica_sem_excepcao(item: dict) -> None:
    """As 12 lâminas da galeria correm e classificam dentro do conjunto conhecido."""
    img = cv2.imread(str(GALLERY / f"{item['key']}.jpg"))
    assert img is not None, f"galeria sem {item['key']}.jpg"
    result = analyze_image(img)
    known = {
        "epithelial", "connective", "muscular", "nervous",
        "adipose", "liver", "cartilage", "kidney", "lung", "indeterminate",
    }
    assert result["tissue"] in known
    assert isinstance(result["features"]["n_nuclei"], int)
