# Registo de alterações

Cada alteração ao código fica registada aqui por data (mais recente primeiro), com ficheiros tocados e a razão. Estado "local" = ainda não enviado ao GitHub; passa a indicar o commit quando houver push.

---

## 2026-09-29 — Melhorias sugeridas no review, segunda vaga (endurecimento + arquitetura) (commit `01b4bb5`)

**Ficheiros:** `server/guards.ts` (novo), `server/validate.ts` (novo), `server.ts`, `tests/server_routes.test.ts` (novo), `src/utils/{annotations,apiError,thumbnailStore,dialogFocus}.ts` (novos), `src/types/histology.ts`, `src/App.tsx`, `src/components/{AcademicQuizModal,ImageUploaderModal,ReferenceAtlasDrawer,ProgressDashboardModal,SlideComparisonModal,HistologyTutorModal,AnnotationSystem}.tsx`, `src/utils/analysisHistory.ts`, `engine/eval.py`, `package.json`.

Implementa os pontos que na vaga anterior ficaram explicitamente "fora do lote".

**Segurança e custo:**
1. **Rate limit por IP** (`server/guards.ts`) — janela fixa em memória. Dois limiters: `apiRateLimit` em `/api` (60/min, `RATE_LIMIT_MAX`) e `aiRateLimit` nos 5 endpoints que gastam quota Gemini (12/min, `AI_RATE_LIMIT_MAX`), com **429 + `Retry-After`** e mensagem legível. Desligável com `*_RATE_LIMIT_MAX=0`. `TRUST_PROXY=1` faz usar o IP real atrás de reverse proxy (desligado por defeito — sem proxy, `X-Forwarded-For` é falsificável).
2. **Corpo JSON de 40 MB → 20 MB** e handler de erro do parser: 413 com mensagem própria (imagem grande) e 400 em JSON malformado, em vez de uma página de stack trace.
3. **Validação de payloads** (`server/validate.ts`) — `validateIncomingImage` aceita data URL, base64 puro, `gallery:<key>` e `/gallery-images/<key>.jpg`; verifica charset base64 e teto de 12 MB descodificados (antes, uma string qualquer ia para o Gemini e para um ficheiro temporário escrito pelo motor). Chat valida `messages` (teto de 8000 car./turno, últimas 40), quiz valida o `analysis` local (exige `tissue`) e o `count` fica limitado a 1–20 (ia cru para o prompt).
4. **Cabeçalhos de segurança** — `nosniff`, `DENY` de framing, `Referrer-Policy`, `COOP`/`CORP`, `Permissions-Policy` e **CSP** em produção (a CSP fica fora em dev porque o Vite injeta scripts inline; desligável com `DISABLE_CSP=1`).
5. **Teto de concorrência do motor** (`runEngineTask`) — antes cada pedido fazia spawn de um processo Python sem limite (10 pedidos = 10 pipelines OpenCV). Agora `ENGINE_MAX_CONCURRENCY` (2) com fila de `ENGINE_MAX_QUEUE` (8) e **503 + `retryAfterSeconds`** quando a fila enche; `/api/status` expõe a carga da fila.
6. **Bug corrigido pelo caminho:** o quiz e o tutor enviavam `slideImageSrc` (caminho `/gallery-images/<key>.jpg`) no campo de imagem, que o Gemini recebia como base64 inválido. Agora o servidor resolve a referência para base64 a partir do ficheiro da galeria (404 se a key não existir).

**Arquitetura e manutenção:**
7. **Um único dono das anotações** (`src/utils/annotations.ts`) — o `App` carrega/persiste e o `AnnotationSystem` só reporta alterações. Antes os dois gravavam `histoscope_annotations_<id>` e o `App.handleAddAnnotation` escrevia `[...snapshot, nova]` a partir do render anterior: duas caixas seguidas e a segunda gravação apagava a primeira. As anotações da lâmina ativa passam a carregar-se na mudança de lâmina (o contador do painel já não aparece a 0).
8. **Tipos do motor como fonte única** — `UiLocalAnalysis` (`src/types/histology.ts`) deriva de `LocalAnalysis` (`engine/engine_bridge.ts`); desapareceram os `Record<string, unknown>` e os casts de `overlay_jpg_b64`/`nuclei`/`features` espalhados por `App.tsx` e três modais. Renomear um campo do motor passa a ser um erro de compilação, não uma caça a strings.
9. **Miniaturas do histórico em IndexedDB** (`src/utils/thumbnailStore.ts`) — o localStorage ficava com data URLs até estourar a quota de ~5 MB, e o plano B era apagar as miniaturas de todas as entradas. O histórico guarda só metadados, a miniatura vive no IndexedDB (lida ao abrir o drawer, com fallback para entradas antigas) e é removida quando a análise sai do histórico. Sem IndexedDB, degrada em silêncio.
10. **`server.ts` importável** — só arranca quando é o ponto de entrada (`tsx server.ts` / `node dist/server.js`) e exporta `app`, o que tornou as rotas testáveis sem abrir portas nem carregar o Vite.

**Produto e acessibilidade:**
11. **Erros da API traduzidos** (`src/utils/apiError.ts`) — os cinco `fetch` passam a mostrar a razão real (413/429/501/503, timeout, e o `error` do servidor) em vez de `HTTP 4xx` ou mensagens genéricas.
12. **Diálogos com foco gerido** (`src/utils/dialogFocus.ts`) — substitui as cinco cópias do listener de Escape: foca o painel ao abrir, devolve o foco ao botão de origem ao fechar e os cinco modais ganharam `role="dialog"`, `aria-modal` e `aria-label` (o drawer já os tinha). Antes, o Tab seguinte ao abrir percorria o conteúdo por trás do modal.
13. **`engine/eval.py` com ressalvas explícitas** — imprime o `n` de cada split, quantas imagens com rótulo por confirmar entraram no cálculo, o subtotal **só com as verificadas**, quantos pontos percentuais vale cada imagem (~7, com 15 imagens) e lembra que o split de treino é onde as regras foram afinadas.

**Testes:** `tests/server_routes.test.ts` (16 casos novos, 33 no total) cobre o que não estava testado: validação e 400, 404 da galeria e das referências forjadas (`gallery:../../etc/passwd`), 501 dos endpoints Gemini sem chave, 429 com `Retry-After` e independência das janelas do limitador, cabeçalhos de segurança e `/api/status`. Nenhum caso válido é testado de propósito — os caminhos felizes chamam o motor Python, que não corre no CI Node. Novo script `npm run verify` (tsc + vitest); o workflow de CI já existente passa a incluir estes testes via `npm run test:js`.

**Verificação.** `npx tsc --noEmit` limpo, `npx vitest run` 33/33 (3 ficheiros), `python -m py_compile` OK nos cinco módulos do motor. `pytest`/`engine/eval.py` continuam a não correr neste ambiente (sem numpy/cv2) — as alterações ao `eval.py` foram verificadas por compilação e leitura; a folha de cálculo das percentagens é aritmética simples, mas correr `python engine/eval.py` num ambiente com `engine/requirements.txt` continua a ser o único teste real.

---

## 2026-09-29 — Correcções do review externo (P0–P2 + higiene) (local, sem commit)

**Ficheiros:** `Dockerfile`, `server.ts`, `engine/analyzer.py`, `engine/engine_cli.py`, `engine/chatbot.py`, `engine/engine_bridge.ts`, `engine/README.md`, `src/App.tsx`, `src/components/{AcademicQuizModal,ImageUploaderModal,ReferenceAtlasDrawer,ProgressDashboardModal,SlideComparisonModal}.tsx`, `src/utils/analysisHistory.ts`, `tests/engine_bridge.test.ts`, `package.json`, `.gitignore`, `metadata.json`, `index.html`.

**P0 — partia em produção/offline:**
1. **Docker runtime sem `node_modules`** — o `dist/server.js` é empacotado com `--packages=external`, logo importa `express`/`vite`/`@google/genai`/`dotenv` do `node_modules`; a imagem final só copiava código e o `node`, e `docker compose up --build` morria com `ERR_MODULE_NOT_FOUND`. Novo stage `deps` (`npm ci --omit=dev`) cujo `node_modules` é copiado para `/app`. O `import` do `vite` em `server.ts` passou a **dinâmico** dentro do ramo `!isProduction` (não é carregado em produção).

**P1 — bugs funcionais:**
2. **Path traversal em `/api/compare-local`** — `imageBase64: "gallery:<key>"` era concatenado diretamente no caminho (`gallery:../../foo.jpg` escapava de `static/gallery`). A key é agora validada contra `GALLERY_KEYS` (404 se desconhecida), como já acontecia no `:key` da rota da galeria.
3. **`__dirname` em `/api/gallery/:key/analysis`** — troca para `PROJECT_ROOT` (o server corre de `dist/` em produção e os assets do motor vivem na raiz; era a mesma classe de bug de 2026-09-28).
4. **Perguntas dissertativas (B6) presas** — `handleRevealModelAnswer` só ligava `showModelAnswer`, mas o bloco da resposta modelo + «Acertei/Errei» estava dentro de `isAnswered`: o primeiro clique escondia a resposta e o aluno ficava sem autoavaliação e sem «Próxima Questão». A ramificação passou a ser por `showModelAnswer`, com o estado da autoavaliação mostrado depois de registada.
5. **Fill-blanks aceitavam 1 caractere** — a comparação por substring marcava qualquer lacuna como certa com `"a"`/`"e"` (o normalizador remove acentos e pontuação). Agora exige igualdade, ou substring só com 4+ caracteres.

**P2 — rigor e coerência:**
6. **Aba «As minhas lâminas»** mostrava a barra de pesquisa e o atlas esquemático completo por baixo do histórico — pesquisa, filtro de famílias e grelha passam a render só com `tab !== 'mine'`.
7. **Timers do uploader** — passam a ser limpos no `finally` (em erro/timeout continuavam a reescrever a fase da análise).
8. **`ProgressDashboardModal`** — ganhou a guarda `if (!isOpen) return;` no listener de Escape (era o único dos 7 sem ela) e passou a re-subscribir só com `isOpen`/`onClose`.
9. **Comparação offline silenciosa** — `handleRunLocalComparison` fazia `return` mudo quando a lâmina não tinha imagem (análise guardada/atlas SVG); agora mostra o motivo e há uma nota visível junto ao botão desativado.
10. **Overlay renomeado `overlay_png_b64` → `overlay_jpg_b64`** — o motor codifica **JPEG** (`cv2.imencode('.jpg', …, 88)`) e o frontend compunha `data:image/jpeg;base64,`: o nome mentia. Atualizado em `analyzer.py`, `engine_bridge.ts` (`LocalAnalysis`) e `App.tsx`.
11. **Escala offline honesta** — `scale_estimate.source` só é `magnification` para uma ampliação **reconhecida**; um valor desconhecido fica `default` (500 px/mm) em vez de a UI apresentar a ampliação indicada como se tivesse sido usada.
12. **Docs do motor alinhadas com o código** — `chatbot.py` e `engine/README.md` diziam «sem watershed», mas o `analyzer.py` faz distance-transform seeded watershed (A1); a docstring dizia «adaptive threshold» onde o código usa Otsu global; removido o código morto `dist_s` (`MORPH_OPEN` numa variável nunca usada, com comentário a falar de h-minima) e corrigido o inventário do README (15 imagens, 5 verificadas, classes de cartilagem/rim/pulmão) e a alegação de precisão (por split, **só reprodutível com `python engine/eval.py`** — não há valor fixo no README).
13. **`/api/compare-slides` e `/api/ask-tutor`** — devolvem **501** com instrução («usa a comparação offline» / «usa /api/chat») em vez de 500 genérico quando falta `GEMINI_API_KEY`.

**Higiene:** `getAnalysis`/`clearAnalyses` removidos (`analysisHistory.ts` nunca os usava); `npm test` passa a correr o vitest e o pytest ficou em `test:engine` (os nomes estavam trocados); entrada obsoleta `esbuild@0.25.12` removida de `allowScripts`; `.gitignore` sem `node_modules/` e `.env` duplicados; título do teste dos fill-blanks deixou de afirmar o contrário do que verifica; `metadata.json`/`index.html` deixaram de se apresentar como «guia diagnóstico de alta precisão» (passa a ferramenta educacional, não substitui diagnóstico médico).

**Verificação.** `npx tsc --noEmit` limpo e `npx vitest run` 17/17 (2 ficheiros). `python -m py_compile` OK em `analyzer.py`/`engine_cli.py`/`chatbot.py`/`questions.py`. **Não** foi possível correr `pytest`/`engine/eval.py` neste ambiente (sem numpy/cv2/pytest instalados neste ambiente), pelo que as alterações ao motor são verificadas só por análise estática e compilação — correr `npm run test:engine` e `python engine/eval.py` num ambiente com `engine/requirements.txt`.

**Fora do lote (decisão consciente):** rate-limit/auth por IP nos endpoints que gastam quota Gemini, limite de body (40 MB) mais apertado, `IndexedDB` para thumbnails, dois escritores de anotações (`App.handleAddAnnotation` + `AnnotationSystem.saveAnnotations`), tipos duplicados motor↔UI e substituição das 10 imagens `unverified`.

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

---

## 2026-09-29 — Roadmap completo: A1-A3, B1-B6, C1-C4

**Ficheiros:** `engine/*`, `engine/static/gallery/*` (3 novas), `server.ts`, `engine/engine_bridge.ts`, `src/App.tsx`, `src/components/*`, `src/utils/*` (novos), `src/i18n.ts` (novo), `tests/*` (novos), `Dockerfile` + `docker-compose.yml` (novos).

### Motor (A1-A3)

- **A1 — Watershed** para núcleos encostados (marcadores por distância transformada); as densidades deixam de subestimar núcleos sobrepostos.
- **A2 — Calibração de escala**: ampliação do objetivo selecionada no upload (40x-1000x) → `px_per_mm` estimado por objetivo; `scale_estimate` propagado até à UI (estimativa claramente etiquetada).
- **A3 — Train/validation + 3 novas classes**: rim (`kidney_cortex.jpg`, CC BY-SA 2.5, Uwe Gille), pulmão (`lung_alveoli.jpg`, CC BY 2.0, PLoS) e cartilagem hialina (`cartilage_hyaline.jpg`, CC0; imagem pálida — o motor devolve «indeterminado», limitação documentada na galeria). `engine/eval.py` separa treino (9/12, 75%) de validação (2/3, 67%) — as regras de rim/pulmão foram afinadas post-hoc contra as imagens de validação (documentado no próprio eval).

### Produto (B1-B6)

- **B1 — Comparativo offline**: `POST /api/compare-local` compara quaisquer duas lâminas (upload ou galeria) com o motor local — tabela de 7 métricas com deltas («densidade 2,3× maior»), sem chave Gemini.
- **B2 — Histórico persistente**: análises de uploads guardadas em localStorage (miniatura + título, máximo 30) e reabríveis no separador «As minhas lâminas» do atlas.
- **B3 — Exportar relatório**: Markdown descarregável + versão imprimível (PDF via print) com classificação, métricas, critérios e anotações.
- **B4 — Repetição espaçada (SM-2)**: `src/utils/spacedRepetition.ts` — perguntas falhadas voltam primeiro nas sessões seguintes; intervalos 1 → 6 → n×EF; persiste em `histoscope_srs`.
- **B5 — Overlay interativo**: `nuclei` (até 800) no payload da análise; pontos clicáveis sobre a lâmina com métricas individuais (área, perímetro, circularidade, elongação) — posições corrigidas para o letterbox do stage 800×600.
- **B6 — Perguntas dissertativas**: as questões «open» do motor passam a ser mostradas com resposta modelo + autoavaliação «Acertei/Errei», registando no histórico do quiz e no SRS.

### Engenharia (C1-C4)

- **C1 — Testes de contrato JS**: vitest com 17 testes (12 do contrato motor → UI, 5 do SRS); CI corre `npm run test:js` antes do build.
- **C2 — Docker**: multi-stage `node:20-slim`/`python:3.12-slim`; dependências Python fixadas; `docker compose up --build` serve a app em `127.0.0.1:3000`.
- **C3 — Tutor offline com contexto**: as métricas da lâmina ativa são enviadas ao `localChat` — respostas com números reais («300 núcleos, densidade ≈245/mm²»).
- **C4 — i18n pt/en**: `src/i18n.ts` com dicionário e deteção/uso guardado em localStorage; toggle PT/EN no cabeçalho. Cobertura inicial: navegação principal (conteúdo pedagógico permanece pt).

**Verificação.** `tsc --noEmit` limpo; `npx vitest run` 17/17; `pytest -q engine/` 18/18; `python engine/eval.py` treino 9/12 (75%), validação 2/3 (67%), total 11/15 (73%); `npm run build` ok.
