<div align="center">

# 🔬 HistoScope AI

**Plataforma académica de histologia com IA** — análise de lâminas, atlas de referência, quizzes gerados por IA e tutor de histologia.

**Modo híbrido**: funciona 100% offline com o motor local de visão por computador; com `GEMINI_API_KEY` (gratuita no [Google AI Studio](https://aistudio.google.com)) ativa respostas Gemini enriquecidas e *grounded* nas métricas objetivas do motor local.

</div>

## Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  React 19 + Vite + Tailwind (SPA)                        │
│  Microscópio · Anotações · Atlas · Quiz · Progresso      │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Express (server.ts) — 7 endpoints                      │
│                                                          │
│  mode: auto | local | gemini                             │
│  ┌────────────────────┐      ┌───────────────────────┐  │
│  │ Motor local (Python)│      │ Gemini (@google/genai)│  │
│  │ engine/engine_cli   │      │ análise rica + chat   │  │
│  │ CV determinístico   │─────▶│ grounded nas métricas │  │
│  │ 100% offline        │      │ do motor local (CV)   │  │
│  └────────────────────┘      └───────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Como funciona o híbrido

| Endpoint | Sem API key (offline) | Com GEMINI_API_KEY |
|---|---|---|
| `POST /api/analyze-histology` | Análise CV local (segmentação de núcleos, 10 métricas, classificação) | Gemini com métricas locais no prompt (*grounding*) + `localAnalysis` na resposta |
| `POST /api/generate-quiz` | Quiz offline a partir da análise local | Quizzes Gemini (MCQ + fill-blank) |
| `POST /api/chat` | Tutor local por regras | Chatbot Gemini multi-persona |
| `GET /api/gallery` | 12 micrografias reais (CC) — sempre disponível | idem |
| `GET /api/gallery/:key/analysis` | Análise local da lâmina de referência | idem |
| `GET /api/status` | Reporta capacidades (`{gemini: bool}`) | idem |

O motor local corre **sempre** primeiro: dá métricas objetivas instantâneas, fundamenta o Gemini e garante que a app nunca fica inutilizável sem chave.

## Setup

```bash
# 1) Dependências Node
npm install

# 2) Motor local Python (offline, gratuito)
pip install -r engine/requirements.txt
#    Windows: o servidor tenta python → py → python3 (ou define PYTHON_BIN no .env)

# 3) (Opcional) Chave Gemini — gratuita com conta Google
#    https://aistudio.google.com → Get API key
cp .env.example .env   # e preenche GEMINI_API_KEY

# 4) Arrancar (dev)
npm run dev            # http://localhost:3000
```

## Motor local (Histolab)

Ver [`engine/README.md`](engine/README.md). Pipeline: desconvolução de cor H&E (Ruifrok & Johnston) → segmentação de núcleos (Otsu + morfologia) → morfometria (área, circularidade, elongação) → features globais (densidade nuclear/mm², razão de estroma, espaços claros) → classificação por regras com confiança e evidência. **Precisão medida: 11/15 (73%)** — treino 9/12 (75%), validação 2/3 (67%) — reprodutível com `python engine/eval.py`. As 3 lâminas restantes devolvem «indeterminado» em vez de falsos positivos (as alegações anteriores de 92% não eram verificáveis — nenhum script de avaliação existia).

## Galeria de referência

12 micrografias H&E. **Proveniência honesta (corrigida 2026-09-28):** só 2/12 têm origem verificada no Wikimedia Commons (fotógrafo Photograper09, CC BY-SA 4.0 — ver `source_url` em [`engine/gallery_meta.json`](engine/gallery_meta.json)); as restantes 10 estão marcadas `provenance: "unverified"` (os nomes de ficheiro reclamados nem existem no Commons) — **verificar ou substituir antes de qualquer distribuição pública**: epitélios (escamoso, transicional, adenocarcinoma do cólon), conjuntivo (frouxo, denso), muscular (liso, esquelético, cardíaco), nervoso (gânglio, córtex), adiposo e fígado.

## Estrutura

```
├── server.ts              # Express + endpoints híbridos
├── src/                   # SPA React (9 componentes)
├── engine/                # Motor local Python (Histolab)
│   ├── analyzer.py        #   pipeline CV + classificador
│   ├── questions.py       #   gerador de quizzes offline
│   ├── chatbot.py         #   tutor offline por regras
│   ├── engine_cli.py      #   interface stdin/stdout JSON
│   ├── engine_bridge.ts   #   bridge Node ↔ Python
│   └── static/gallery/    #   12 micrografias CC
└── src/data/referenceSlides.ts  # atlas SVG sintético (modo diagrama)
```

## Nota

Ferramenta educacional — não substitui diagnóstico médico.
