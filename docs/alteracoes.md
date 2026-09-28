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

---

## 2026-09-28 — Correcção completa do review (P0–P3) (commit `7d26243`)

**Ficheiros:** `engine/engine_bridge.ts` (reescrito), `engine/analyzer.py`, `engine/questions.py`, `engine/chatbot.py`, `engine/gallery_meta.json`, `engine/eval.py` (novo), `engine/test_analyzer.py` (novo), `server.ts`, `src/App.tsx`, 9 componentes em `src/components/`, `src/data/referenceSlides.ts`, `package.json`, `tsconfig.json`, `index.html`, `README.md`, `engine/README.md`.

**Origem.** Avaliação interna + review externo (MiMo 2.6 Flash) — cada afirmação crítica foi verificada contra o código antes de ser aceite; uma (mojibake em `metadata.json`) era falsa e não foi aplicada.

**P0 — o que estava partido:**
1. `engine_bridge.ts`: handler de erro no stdin (EPIPE = `uncaughtException` matava o servidor), timeout de 90 s com kill, e resolução do binário Python por sonda com candidatos por plataforma (`python`→`py`→`python3` no Windows, onde `python3` quase nunca existe). `engineAvailable()` morto removido.
2. Contrato offline: o modo local passou a devolver a MESMA forma `HistologyAnalysis` que o Gemini — `localAnalysisToHistology()` mapeia motor→UI; antes o frontend lia `result.tissueClassification` inexistente e rebentava em todo o upload sem chave. Quiz offline: o frontend envia agora `analysis` (a `localAnalysis` crua guardada em App) e `mapLocalQuestions()` traduz `type/answer` (texto) para `questionType/correctOptionIndex` (índice) — sem isso a UI dava TODAS as respostas como erradas.
3. Path traversal em `/api/gallery/:key/analysis`: `:key` validado contra as chaves do `gallery_meta.json` (404 se desconhecida). Bind alterado de `0.0.0.0` para `127.0.0.1` (override com `HOST` no `.env`).

**P1 — dados:**
4. Anotações limpas na troca de lâmina (referência) e no carregamento de nova lâmina — antes as caixas da lâmina A apareciam e gravavam na B.
5. Estado "indeterminate" no classificador: <15 núcleos → indeterminado (conf 0); consenso <45% → indeterminado. Fim do "adipose 100%" em imagem vazia e do "epithelial 0%" em imagem preta. `questions.py` recusa gerar quiz de análise indeterminada (erro claro → 422).
6. Proveniência das 12 imagens verificada na API do Wikimedia Commons: **10/12 não existem no Commons** com os nomes reclamados (não há créditos que se possam atribuir — marcadas `provenance: "unverified"`); as 2 verificadas têm autor real **Photograper09, CC BY-SA 4.0** — a atribuição anterior ("Lorenzo Apolloni / CC BY 4.0" e "Patho / CC BY-SA 3.0") estava errada e foi corrigida.

**P2 — qualidade:**
7. `npm install` deixou de falhar (esbuild `^0.25`→`^0.28`; vite@8 exige `^0.27+`); package renomeado `react-example`→`histoscope-ai`; `strict: true` + `noUnusedLocals` + `noUnusedParameters` no tsconfig; 44 erros de código morto eliminados (44→0); tutor offline deixou de descrever watershed e deteção de mitoses que não existem; `index.html` com `lang="pt-PT"`; READMEs com precisão medida e proveniência honesta.

**P3 — testes (primeiros do projeto):**
8. `engine/eval.py` — precisão reprodutível: **9/12 (75%)**; as 3 falhas devolvem «indeterminado» em vez de falsos positivos (a alegação "92% (11/12)" não era verificável). `engine/test_analyzer.py` — 15 testes pytest (guardas indeterminado, contrato do resultado, as 12 lâminas correm).

**Verificação final.** `tsc --noEmit` limpo (strict), `npm run build` completo, `npm install` sem ERESOLVE, 15/15 pytest, e2e offline verde.

---

## 2026-09-28 — Fix de paths no build de produção (P0)

**Ficheiros:** `server.ts`, `engine/engine_bridge.ts`, `docs/alteracoes.md`.

**Problema.** Em produção (`NODE_ENV=production`, `node dist/server.js`), todos os
caminhos usavam `__dirname` (= `dist/`): `gallery_meta.json`, `static/gallery/` e
`engine_cli.py` ficavam intratáveis — `/api/gallery` devolvia 500 (ENOENT) e o
motor local nunca arrancava. O bundle do esbuild vive em `dist/`, mas os assets do
motor ficam na raiz do projeto.

**Correção.** `PROJECT_ROOT` em `server.ts` e `ENGINE_DIR` em `engine_bridge.ts`
resolvem por sonda (`fs.existsSync`): se `engine/` existe junto ao ficheiro, é dev;
caso contrário sobem um nível (produção). Vale para os 4 pontos de uso
(galeria meta, static gallery, cli do motor, imagem da galeria).

**Verificação.** `tsc --noEmit` limpo; `npm run build` ok; e2e em produção sem
`GEMINI_API_KEY`: `/api/status` ✓, `/api/gallery` (12 itens) ✓, análise mode=local
mapeada ("Parênquima Hepático", 57%, com overlay) ✓, quiz local (4 perguntas) ✓,
chat local-tutor ✓.
