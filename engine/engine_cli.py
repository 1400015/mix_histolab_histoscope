#!/usr/bin/env python3
"""HistoScope local analysis engine (from Histolab).

Reads a JSON request on stdin and writes a JSON response on stdout,
so the Node server can call it directly via child_process — no extra
port, no Python web server required.

Request:
{
  "action": "analyze" | "questions" | "chat",
  "imagePath": "/abs/path/to/image.jpg",        // analyze
  "analysis": {...}, "n": 6, "difficulty": "medium", "seed": null,  // questions
  "message": "...", "tissue": "...", "features": {...}              // chat
}

Response: {"ok": true, ...result} or {"ok": false, "error": "..."}
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import cv2  # noqa: E402

from analyzer import analyze_image  # noqa: E402
from questions import generate_questions  # noqa: E402
from chatbot import chat_reply  # noqa: E402

# A2: px/mm aproximados por objetivo, assumindo câmara ~1/2.3" e display 1920px.
# ESTIMATIVA didática — os valores reais variam com o sensor/ocular.
MAGNIFICATION_PX_PER_MM = {  # noqa: N806
    "40x": 130.0,
    "100x": 320.0,
    "200x": 640.0,
    "400x": 1280.0,
    "1000x": 3200.0,
}


def main() -> None:
    try:
        req = json.loads(sys.stdin.read())
        action = req.get("action", "analyze")

        if action == "analyze":
            img = cv2.imread(req["imagePath"])
            if img is None:
                raise ValueError(f"Não foi possível ler a imagem: {req['imagePath']}")
            # A2: calibração de escala por ampliação (ESTIMATIVA — depende do
            # tamanho do sensor e da câmara; aproximação didática por objetivo).
            mag = req.get("magnification") or req.get("pxPerMm")
            px_per_mm = 500.0
            source = "default"
            if isinstance(mag, (int, float)) and 20 <= float(mag) <= 1000:
                px_per_mm = float(mag)  # px/mm explícito
                source = "explicit"
            elif isinstance(mag, str) and mag.lower() in MAGNIFICATION_PX_PER_MM:
                # Só uma ampliação RECONHECIDA é "magnification": um valor
                # desconhecido cai no default de 500 px/mm e a UI tem de o
                # dizer (antes assumia a ampliação indicada).
                px_per_mm = MAGNIFICATION_PX_PER_MM[mag.lower()]
                source = "magnification"
            result = analyze_image(img, px_per_mm=px_per_mm)
            result["scale_estimate"] = {
                "px_per_mm": px_per_mm,
                "source": source,
                "note": "estimativa aproximada; não substitui calibração com micrómetro de lâmina",
            }
            # B5: os núcleos individuais (até 800, coordenadas + métricas)
            # passam a viajar no payload — a UI usa-os para o overlay
            # interativo (clicar num núcleo mostra as suas métricas).
            result["nuclei"] = result.get("nuclei", [])[:800]
            json.dump({"ok": True, "analysis": result}, sys.stdout, ensure_ascii=False)

        elif action == "questions":
            qs = generate_questions(
                req.get("analysis", {}),
                n=int(req.get("n", 6)),
                difficulty=req.get("difficulty", "medium"),
                seed=req.get("seed"),
            )
            json.dump({"ok": True, "questions": qs}, sys.stdout, ensure_ascii=False)

        elif action == "chat":
            reply = chat_reply(
                req.get("message", ""),
                tissue=req.get("tissue"),
                features=req.get("features"),
            )
            json.dump({"ok": True, **reply}, sys.stdout, ensure_ascii=False)

        else:
            raise ValueError(f"Ação desconhecida: {action}")

    except Exception as e:  # noqa: BLE001
        json.dump({"ok": False, "error": str(e)}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
