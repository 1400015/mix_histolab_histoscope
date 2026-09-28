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


def main() -> None:
    try:
        req = json.loads(sys.stdin.read())
        action = req.get("action", "analyze")

        if action == "analyze":
            img = cv2.imread(req["imagePath"])
            if img is None:
                raise ValueError(f"Não foi possível ler a imagem: {req['imagePath']}")
            result = analyze_image(img)
            # overlay_png_b64 mantém-se desde 2026-09-28: a UI mostra a
            # segmentação de núcleos por cima da lâmina (só os núcleos
            # individuais são descartados — payload pesado e redundante).
            result.pop("nuclei", None)
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
