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
│  Express (server.ts) — 9 endpoints                      │
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
| `POST /api/compare-local` | Comparação offline de duas lâminas (motor local) | idem |
| `POST /api/compare-slides` | **501** («usa a comparação offline») | Gemini |
| `POST /api/ask-tutor` | **501** («usa /api/chat») | Gemini |
| `GET /api/gallery` | 42 lâminas: 15 micrografias reais (CC) + 24 lâminas sintéticas Meta AI + 3 esquemas de embriologia — sempre disponível | idem |
| `GET /api/gallery/:key/analysis` | Análise local da lâmina de referência | idem |
| `GET /api/status` | Reporta capacidades (`{gemini: bool, engine: {active, queued}}`) | idem |

O motor local corre **sempre** primeiro: dá métricas objetivas instantâneas, fundamenta o Gemini e garante que a app nunca fica inutilizável sem chave.

## Endurecimento e operação

Sem chave nenhuma, a app funciona offline; com tráfego público, foi endurecida (2026-09-29) sem dependências novas:

| Variável | Por omissão | Para quê |
|---|---|---|
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `60` / `60000` | Pedidos por IP em `/api` (janela fixa, em memória). `0` desliga. |
| `AI_RATE_LIMIT_MAX` | `12` | Limite mais apertado nos 5 endpoints que gastam quota Gemini (429 + `Retry-After`). |
| `MAX_JSON_BODY_MB` | `20` | Teto do corpo JSON (imagem base64); acima disso, 413 legível. |
| `ENGINE_MAX_CONCURRENCY` / `ENGINE_MAX_QUEUE` | `2` / `8` | Pipelines Python em simultâneo e fila de espera; fila cheia devolve 503 com `retryAfterSeconds`. |
| `TRUST_PROXY` | `0` | `1` faz o rate limit usar o IP real (`X-Forwarded-For`) — só com reverse proxy à frente. |
| `DISABLE_CSP` | `0` | `1` desliga a CSP de produção (a de dev não é enviada, o Vite precisa de scripts inline). |

Também: cabeçalhos de segurança em todas as respostas, validação de payloads antes de tocar no motor (`gallery:<key>` e `/gallery-images/<key>.jpg` são resolvidos para ficheiro, não aceites como base64), e `server.ts` só abre portas quando é o ponto de entrada — os testes importam o `app` sem subir o Vite.

```bash
npm run verify         # tsc --noEmit + vitest run (contratos das rotas incluídos)
npm run test:engine    # pytest do motor (precisa de engine/requirements.txt)
python engine/eval.py  # avaliação por split, com ressalvas de amostra
```

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

Ver [`engine/README.md`](engine/README.md). Pipeline: desconvolução de cor H&E (Ruifrok & Johnston) → limiar global de Otsu + morfologia → **watershed com marcadores sobre a transformada de distância** (separa núcleos encostados) → morfometria (área, circularidade, elongação) → features globais (densidade nuclear/mm², razão de estroma, espaços claros) → classificação por regras com confiança e evidência. As lâminas restantes devolvem «indeterminado» em vez de falsos positivos (as alegações anteriores de 92% não eram verificáveis — nenhum script de avaliação existia), com uma exceção deliberada: campos matriz-dominantes (<15 núcleos, estroma > 0.6, eosina alta) são lidos como muscular/conjuntivo a confiança baixa (0.55) — ver [`engine/README.md`](engine/README.md).

**Números de classificação (última corrida registada: treino 8/11, validação 2/3, total 10/14)** — reprodutíveis com `python engine/eval.py`, que imprime o `n` de cada split, quantos pontos percentuais vale cada imagem, o subtotal por proveniência e o aviso de que o split de treino é onde as regras foram afinadas. O `liver` (metástase mamária) foi excluído dos splits por ser rótulo enganoso para o classificador — nota honesta: a subida de 67% para 71% vem dessa exclusão (o caso removido era um erro), não de melhoria do modelo, e `liver` fica como a única classe do motor sem cobertura no eval. Nenhum destes números é uma métrica de generalização: a amostra é minúscula.

## Galeria de referência

42 lâminas: 15 micrografias + 27 imagens sintéticas (24 lâminas histológicas geradas por Meta AI e 3 esquemas de embriologia em pt-PT). As sintéticas estão marcadas no `gallery_meta.json` com `provenance: "ai-generated"`, `split: "excluded"` (fora do treino/validação do motor) e crachá «imagem sintética» na UI — não substituem micrografias reais.

**Proveniência das micrografias: 15/15 com prova byte a byte contra o Commons** — campo `match` + `sha1`/`commons_sha1` auditáveis em `engine/gallery_meta.json` (12 ficheiros originais; 3 substituídos por thumbnail 960px com SHA1 do original registado). Nas 27 lâminas sintéticas os campos `sha1`/`commons_sha1`/`match` não se aplicam (não há original no Commons); existe apenas `local_sha1` como verificação de integridade do ficheiro local. **14/15 com autor verificável na ficha**; `lung_alveoli` tem atribuição plausível (PLoS Medicine) mas Artist/Credit vazios na ficha — a ressalva é visível na UI (tooltip do crachá). Reservas de conteúdo documentadas: `liver` é uma metástase hepática de carcinoma da mama (NCI, domínio público), não parênquima normal; `nervous_ganglion` é um feixe nervoso. Na UI o crachá «© autor» é um link para a ficha no Commons e mostra a prova e a ressalva no tooltip.

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
│   └── static/gallery/    #   42 lâminas (15 micrografias CC + 27 sintéticas Meta AI)
└── src/data/referenceSlides.ts  # atlas SVG sintético (modo diagrama)
```

## Nota

Ferramenta educacional — não substitui diagnóstico médico.
