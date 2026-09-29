#!/usr/bin/env python3
"""Avaliação do classificador sobre a galeria de referência.

Corre o motor sobre as micrografias de `static/gallery/` e compara com os
rótulos de `gallery_meta.json`. Substitui a alegação não verificável
"Precisão: 92% (11/12)" do README por um número reprodutível:

    python engine/eval.py

Splits (A3):
- `train` (ou sem campo split): as imagens usadas para desenvolver as
  regras do classificador — o número é indicativo, não validação real.
- `validation`: imagens adicionais (cartilagem, rim, pulmão) adquiridas
  depois. Nota honesta: as regras kidney/lung foram afinadas contra estas
  imagens após a primeira avaliação (pós-hoc); a cartilagem pálida do
  Commons mantém-se como limitação conhecida (indeterminate).

Honestidade do número (2026-09-29): a galeria tem 15 imagens, logo cada
imagem vale ~7 pontos percentuais — uma classificação a mudar mexe no
resultado tanto como uma melhoria real. O relatório imprime por isso o `n`
de cada split, quantas imagens com rótulo (proveniência) por confirmar
entraram no cálculo e o subtotal só com as verificadas. Nenhum destes
números é uma métrica de generalização.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cv2  # noqa: E402

from analyzer import analyze_image  # noqa: E402

HERE = Path(__file__).parent


def run(items: list[dict], label: str) -> tuple[int, int, list[str]]:
    """Corre o motor num split. Devolve (acertos, n avaliado, chaves por verificar)."""
    correct = 0
    total = 0
    unverified: list[str] = []
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
        if item.get("provenance") != "verified":
            unverified.append(key)
        flag = "" if item.get("provenance") == "verified" else "  [rótulo por verificar]"
        rows.append(
            f"{'OK' if hit else 'FALHOU':>13}  {key:<24} esperado={truth:<12} obtido={got} ({conf:.2f}){flag}"
        )

    print(f"\n--- {label} — n={total} de {len(items)} imagens ---")
    print("\n".join(rows))
    if total:
        peso = 100 / total
        print(f"\n{label}: {correct}/{total} ({(correct / total * 100):.0f}%) — cada imagem vale {peso:.0f} pontos percentuais")
    if unverified:
        print(f"Nota: {len(unverified)} imagem(ns) deste split têm rótulo por confirmar: {', '.join(unverified)}")
    return correct, total, unverified


def main() -> None:
    meta = json.loads((HERE / "gallery_meta.json").read_text(encoding="utf-8"))
    train = [m for m in meta if m.get("split", "train") == "train"]
    validation = [m for m in meta if m.get("split") == "validation"]
    verified = [m for m in meta if m.get("provenance") == "verified"]

    c1, t1, u1 = run(train, "Treino")
    c2, t2, u2 = run(validation, "Validação (pós-hoc, ver docstring)")

    ct, tt = c1 + c2, t1 + t2
    if tt:
        print(f"\nTotal na galeria: {ct}/{tt} ({(ct / tt * 100):.0f}%) — n pequeno, ver ressalva abaixo")

    # Subtotal que exclui os rótulos por confirmar: é o único que se pode citar
    # sem ressalvas, e mesmo assim sem valor de generalização.
    cv_, tv, _ = run(verified, "Só rótulos verificados")

    print()
    print("Ressalvas: (1) amostra minúscula — cada imagem vale ~7 pontos percentuais;")
    print("           (2) rótulos 'unverified' no gallery_meta.json não foram confirmados,")
    print(f"           ficaram fora do subtotal verificado ({cv_}/{tv});")
    print("           (3) o split de treino é o conjunto onde as regras foram afinadas.")
    if u1 or u2:
        print(f"           Imagens com rótulo por confirmar: {', '.join(u1 + u2)}")


if __name__ == "__main__":
    main()
