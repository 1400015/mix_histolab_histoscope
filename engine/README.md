# Motor local de análise histológica (Histolab)

Motor de visão por computador determinístico, **100% offline e gratuito**, integrado no HistoScope AI como camada de análise local e *grounding* para o Gemini.

## Requisitos

```bash
pip install -r engine/requirements.txt   # numpy + opencv-python-headless
```

## Pipeline

1. **Desconvolução de cor H&E** (Ruifrok & Johnston) — separa canais de hematoxilina (núcleos) e eosina (citoplasma/matriz) no espaço de densidade ótica, normalizados por p99.
2. **Segmentação de núcleos** — Otsu global no canal H → morfologia (abertura/fecho) → componentes conexos com área válida (15–4000 px) → **watershed com marcadores sobre a transformada de distância** para separar núcleos que se tocam (A1).
3. **Morfometria por núcleo** — área, perímetro, circularidade e elongação (elipse ajustada, com filtragem de degenerados).
4. **Features globais** — densidade nuclear/mm², área mediana, CV, circularidade/elongação medianas, razão de estroma (eosina não-nuclear), razão de espaços claros (vacúolos/lúmen), médias H e E.
5. **Classificação por regras** — epitelial, conjuntivo, muscular, nervoso, adiposo, hepático, cartilagem, rim e pulmão, com confiança normalizada e critérios morfológicos de evidência.

**Precisão:** medida por split, com `python engine/eval.py` (12 imagens de treino + 3 de validação). O split de treino é **indicativo**, não validação real — as regras foram afinadas sobre essas mesmas imagens, e as regras de rim/pulmão foram afinadas *pós-hoc* contra o split de validação (ver docstring de `eval.py`). As lâminas sem critérios claros devolvem «indeterminado» em vez de um tecido inventado (guardas 2026-09-28). Os **testes** estão em `test_analyzer.py` (`pytest -q engine/`).

## Interface (CLI stdin/stdout)

```json
{"action": "analyze", "imagePath": "/tmp/slide.jpg"}
{"action": "questions", "analysis": {...}, "n": 6, "difficulty": "medium"}
{"action": "chat", "message": "O que cora a hematoxilina?", "tissue": "epithelial"}
```

O servidor Node invoca via `child_process` (ver `engine_bridge.ts`) — sem porta extra nem serviço Python dedicado.

## Estrutura

- `analyzer.py` — pipeline CV e classificador
- `questions.py` — gerador offline de perguntas académicas (MCQ + abertas)
- `chatbot.py` — tutor offline por regras e glossário
- `engine_cli.py` — interface stdin/stdout JSON
- `gallery_meta.json` — metadados, `split` (train/validation) e **atribuição de licenças** das 15 micrografias
- `static/gallery/` — 15 micrografias H&E reais (Wikimedia Commons, CC)

## Licenças

As imagens em `static/gallery/` NÃO são MIT: cada uma mantém a licença original do Wikimedia Commons (CC BY / CC BY-SA / domínio público), com atribuição por imagem em `gallery_meta.json`.

## Proveniência das imagens

`gallery_meta.json` marca cada lâmina com `provenance: "verified"` (origem confirmada na API do Wikimedia Commons) ou `"unverified"` — 10 das 15 são unverified: os nomes de ficheiro reclamados não existem no Commons, por isso **não há créditos que possam ser corretamente atribuídos**. Antes de distribuir publicamente, verificar ou substituir.
