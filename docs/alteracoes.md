# Registo de alterações

Cada alteração ao código fica registada aqui por data (mais recente primeiro), com ficheiros tocados e a razão. Estado "local" = ainda não enviado ao GitHub; passa a indicar o commit quando houver push.

---

## 2026-09-28 — Melhorias de produto e engenharia (lote pós-review) (commit `7d26243`)

**Ficheiros:** `server/gemini.ts` (novo), `server.ts` (reescrito), `engine/engine_cli.py`, `engine/engine_bridge.ts`, `engine/questions.py`, `engine/requirements.txt`, `engine/test_analyzer.py`, `src/App.tsx`, `src/components/{ReferenceAtlasDrawer,MicroscopeViewer,ImageUploaderModal,AcademicQuizModal,SlideComparisonModal,HistologyTutorModal,ProgressDashboardModal}.tsx`, `.github/workflows/ci.yml` (novo), `package.json`, `README.md`.

**Melhorias aplicadas (das sugeridas na re-avaliação):**

1. **Galeria real na UI** — o `ReferenceAtlasDrawer` ganhou um separador "Galeria real (fotos)": carrega `GET /api/gallery`, mostra as 12 micrografias com **atribuição e crachá de proveniência** (verified ✓ / unverified ⚠), e ao clicar corre `GET /api/gallery/:key/analysis` (agora devolve a análise **mapeada** para o contrato da UI, com overlay). `App.tsx` ganhou `handleSelectGallerySlide` (lâmina `gallery_<key>`, imagem `/gallery-images/`, análise + overlay ligados). Antes, a galeria real era inacessível pela interface.
2. **Overlay da segmentação visível** — o `analyzer.py` já desenhava os núcleos segmentados e o CLI descartava: agora o overlay (JPEG base64) chega ao frontend e o `MicroscopeViewer` mostra-o com um botão "Segmentação" (opacidade 0.55, blend screen, alinhado com pan/zoom dentro do palco). Auto-ativa quando chega overlay novo.
3. **Seletor de modo no upload** — o endpoint aceitava `mode: auto|local|gemini` e a UI nunca enviava: agora há um select "Motor:" no rodapé do modal (Auto / Só motor local / Só Gemini).
4. **Fill-blanks offline** — 3 perguntas de preenchimento novas no `questions.py`; `mapLocalQuestions` mapeia-as (com `acceptableAnswers`); o filtro "Apenas Preenchimento de Lacunas" passou a valer offline (o servidor pede o pool completo — n=99 — e fatia DEPOIS de filtrar; antes o corte `pool[:5]` levava só MCQ e os fill_blanks nunca apareciam).
5. **Erros específicos no quiz** — o corpo do erro do servidor (ex.: 422 "análise indeterminada") aparece na UI em vez da mensagem genérica.
6. **Schemas/prompts Gemini extraídos** — novo `server/gemini.ts` (~330 linhas: 3 schemas, prompts, personas, modelos); `server.ts` fica só com HTTP + orquestração.
7. **AbortController/timeout nos fetches** — análise 150 s, quiz 60 s, chat 60 s, comparação 90 s (`AbortSignal.timeout`), com mensagens de timeout em pt; a galeria tem 15 s/120 s.
8. **A11y nos 6 modais** — `role="dialog"` + `aria-modal`, fecho com **Escape** (o `AnnotationSystem` tem overlay fixo mas não é modal — excluído de propósito).
9. **CI** — `.github/workflows/ci.yml`: job web (npm ci → lint → build) + job engine (pip install → pytest → eval informativo).
10. **Requirements fixados** — `numpy==2.5.3`, `opencv-python-headless==5.0.0.93` (era `numpy`/`opencv-python-headless` soltos).

**Bónus descoberto ao aplicar:** o **build de produção estava quebrado desde o primeiro commit** — o script usava `esbuild` sem `--bundle`, logo `dist/server.js` ficava com imports relativos (`./engine/engine_bridge`, `./server/gemini`) que não existem no `dist` (ninguém correra `npm start` em produção). Corrigido para `--bundle --packages=external` (node_modules externo, código próprio incluído — verificado: schemas presentes no bundle, zero imports relativos).

**Fora do lato (decisão consciente):** `px_per_mm` real (precisa de calibração/ampliação — heurística seria pseudo-precisão) e watershed no classificador (afinação com treino/validação separados).

**Verificação final.** tsc limpo; 15/15 pytest; build web+server completo; e2e offline via curl: análise mode=local mapeada com overlay ✓, quiz fill_blank (3 perguntas, acceptableAnswers) ✓, galeria mapeada com overlay ✓, traversal 404 ✓, `/api/status` ✓, `/api/gallery` com provenances ✓.
