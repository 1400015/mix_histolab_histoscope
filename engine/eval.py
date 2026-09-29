#!/usr/bin/env python3
"""Avaliação do classificador sobre a galeria de referência.

Corre o motor sobre as micrografias de `static/gallery/` e compara com os
rótulos de `gallery_meta.json`. Substitui a alegação não verificável
"Precisão: 92% (11/12)" do README por um número reprodutível:

    python engine/eval.py

Splits (A3):
- `train` (ou sem campo split): as 12 imagens usadas para desenvolver as
  regras do classificador — o número é indicativo, não validação real.
- `validation`: imagens adicionais (cartilagem, rim, pulmão) adquiridas
  depois. Nota honesta: as regras kidney/lung foram afinadas contra estas
  imagens após a primeira avaliação (pós-hoc); a cartilagem pálida do
  Commons mantém-se como limitação conhecida (indeterminate).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cv2  # noqa: E402

from analyzer import analyze_image  # noqa: E402

HERE = Path(__file__).parent


def run(items: list[dict], label: str) -> tuple[int, int]:
    correct = 0
    total = 0
    rows: list[str] = []
    for item in items:
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
        rows.append(
            f"{'OK' if hit else 'FALHOU':>13}  {key:<24} esperado={truth:<12} obtido={got} ({conf:.2f})"
        )
    print(f"\n--- {label} ---")
    print("\n".join(rows))
    if total:
        print(f"\n{label}: {correct}/{total} ({(correct / total * 100):.0f}%)")
    return correct, total


def main() -> None:
    meta = json.loads((HERE / "gallery_meta.json").read_text(encoding="utf-8"))
    train = [m for m in meta if m.get("split", "train") == "train"]
    validation = [m for m in meta if m.get("split") == "validation"]

    c1, t1 = run(train, "Treino")
    c2, t2 = run(validation, "Validação (pós-hoc, ver docstring)")

    ct, tt = c1 + c2, t1 + t2
    if tt:
        print(f"\nPrecisão total na galeria: {ct}/{tt} ({(ct / tt * 100):.0f}%)")


if __name__ == "__main__":
    main()
