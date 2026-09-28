#!/usr/bin/env python3
"""Avaliação do classificador sobre a galeria de referência.

Corre o motor sobre as 12 micrografias de `static/gallery/` e compara com os
rótulos de `gallery_meta.json`. Substitui a alegação não verificável
"Precisão: 92% (11/12)" do README por um número reprodutível:

    python engine/eval.py

Nota honesta: as 12 imagens da galeria são simultaneamente o conjunto de
avaliação — não há separação treino/teste (correcção 2026-09-28). O número é
indicativo do comportamento na galeria, não de precisão clínica geral.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import cv2  # noqa: E402

from analyzer import analyze_image  # noqa: E402

HERE = Path(__file__).parent


def main() -> None:
    meta = json.loads((HERE / "gallery_meta.json").read_text(encoding="utf-8"))
    correct = 0
    total = 0
    rows: list[str] = []
    for item in meta:
        key, truth = item["key"], item["tissue"]
        img = cv2.imread(str(HERE / "static" / "gallery" / f"{key}.jpg"))
        if img is None:
            rows.append(f"{'ERRO':>13}  {key} (imagem não lida)")
            continue
        result = analyze_image(img)
        got, conf = result["tissue"], result["tissue_confidence"]
        hit = got == truth
        correct += int(hit)
        total += 1
        rows.append(f"{'OK' if hit else 'FALHOU':>13}  {key:<24} esperado={truth:<12} obtido={got} ({conf:.2f})")

    print("\n".join(rows))
    print(f"\nPrecisão na galeria: {correct}/{total} ({(correct / total * 100):.0f}%)" if total else "sem imagens")


if __name__ == "__main__":
    main()
