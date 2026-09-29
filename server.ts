import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  localAnalyze,
  localAnalyzeBase64,
  localQuestions,
  buildLocalComparison,
  localChat,
  featuresToPromptContext,
  localAnalysisToHistology,
  mapLocalQuestions,
  type LocalAnalysis,
} from './engine/engine_bridge';
import {
  MODEL_MAIN,
  ANALYSIS_SYSTEM,
  buildAnalysisPrompt,
  ANALYSIS_SCHEMA,
  QUIZ_SYSTEM,
  buildQuizPrompt,
  QUIZ_SCHEMA,
  COMPARE_SYSTEM,
  buildComparePrompt,
  COMPARE_SCHEMA,
  chatSystemInstruction,
  resolveChatModel,
} from './server/gemini';
import {
  EngineBusyError,
  JSON_BODY_LIMIT,
  aiRateLimit,
  apiRateLimit,
  engineLoad,
  runEngineTask,
  securityHeaders,
} from './server/guards';
import {
  readOptionalInt,
  readOptionalString,
  validateChatMessages,
  validateIncomingImage,
  validateLocalAnalysis,
} from './server/validate';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Base do projeto: em dev é a raiz do repo; em produção o server corre de dist/,
// por isso sobe um nível se necessário (os assets do motor ficam na raiz).
const PROJECT_ROOT = fs.existsSync(path.join(__dirname, 'engine'))
  ? __dirname
  : path.resolve(__dirname, '..');

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/** Erros do parser de corpo (imagem grande, JSON malformado) em JSON legível —
 * a UI mostra `body.error`, por isso uma página de stack trace não serve. */
function bodyErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Imagem demasiado grande para o servidor (limite 20 MB). Reduz a resolução ou envia em JPEG.',
    });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Pedido JSON malformado.' });
  }
  return next(err);
}

const app = express();
// Atrás de um reverse proxy (o do Freebuff/nginx) TRUST_PROXY=1 faz o rate
// limit usar o IP real do cliente. Desligado por defeito: sem proxy à frente,
// X-Forwarded-For é inventável e serviria para contornar o limite.
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(securityHeaders);
app.use('/api', apiRateLimit());
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
app.use(bodyErrorHandler);

// Shared Gemini client utility on the server
// User-Agent must be set to 'aistudio-build' for telemetry
const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

/**
 * Lê, valida e resolve o campo de imagem de um pedido:
 * - ausente/vazio → `{ ok: true, base64: null }` (a imagem é opcional);
 * - inválido/vazio demais → responde 400 e devolve `{ ok: false }`;
 * - `gallery:<key>` desconhecida → responde 404;
 * - válido → base64 pronto para o Gemini ou para o motor local.
 * Antes destas verificações, o valor cru ia para o Gemini e para um ficheiro
 * temporário escrito pelo motor.
 */
function takeImageField(
  raw: unknown,
  res: Response,
  field = 'imageBase64',
): { ok: true; base64: string | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, base64: null };
  const checked = validateIncomingImage(raw, { field });
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return { ok: false };
  }
  if (!checked.value.startsWith('gallery:')) return { ok: true, base64: checked.value };
  const key = checked.value.slice('gallery:'.length);
  if (!GALLERY_KEYS.has(key)) {
    res.status(404).json({ error: 'Lâmina da amostra desconhecida na galeria.' });
    return { ok: false };
  }
  return {
    ok: true,
    base64: fs
      .readFileSync(path.join(PROJECT_ROOT, 'engine', 'static', 'gallery', `${key}.jpg`))
      .toString('base64'),
  };
}

// API Route: Histological Image Analysis
app.post('/api/analyze-histology', aiRateLimit(), async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', tissueHint, stainHint, customInstructions, mode = 'auto', magnification } = req.body;

    const image = takeImageField(imageBase64, res);
    if (!image.ok) return;
    if (!image.base64) {
      return res.status(400).json({ error: 'Nenhuma imagem foi fornecida para análise.' });
    }

    // Local deterministic CV analysis (always attempted; free, offline, grounds Gemini)
    let localAnalysis: LocalAnalysis | null = null;
    try {
      localAnalysis = await runEngineTask(() => localAnalyzeBase64(image.base64 as string, magnification));
    } catch (e: any) {
      // Fila do motor cheia não é "motor indisponível": é saturação, e o 503
      // diz ao cliente para tentar de novo em vez de um 500 enganador.
      if (e instanceof EngineBusyError) {
        return res.status(503).json({ error: e.message, retryAfterSeconds: 5 });
      }
      console.error('Motor local indisponível:', e.message);
    }
    if (mode === 'local') {
      if (!localAnalysis) return res.status(500).json({ error: 'Motor local indisponível (requer Python com numpy + opencv-python-headless).' });
      // Contrato 2026-09-28: o modo offline devolve a MESMA forma que o
      // Gemini — antes devolvia {localAnalysis} cru e o frontend rebentava
      // em result.tissueClassification.primaryTissue (TypeError).
      return res.json({ ...localAnalysisToHistology(localAnalysis), mode: 'local', localAnalysis });
    }
    if (!hasGemini()) {
      if (localAnalysis) {
        return res.json({ ...localAnalysisToHistology(localAnalysis), mode: 'local', localAnalysis });
      }
      throw new Error('GEMINI_API_KEY ausente e motor local indisponível.');
    }
    const ai = getGenAI();

    const cleanBase64 = image.base64;

    const response = await ai.models.generateContent({
      model: MODEL_MAIN,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: buildAnalysisPrompt({
              tissueHint,
              stainHint,
              customInstructions,
              localContext: localAnalysis ? featuresToPromptContext(localAnalysis) : null,
          }) },
        ],
      },
      config: {
        systemInstruction: ANALYSIS_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA,
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ ...parsedData, mode: 'gemini', localAnalysis });
  } catch (error: any) {
    console.error('Erro na análise histológica:', error);
    return res.status(500).json({
      error: 'Falha ao processar a análise com a IA.',
      details: error.message || String(error),
    });
  }
});

// API Route: Generate Academic Quiz Questions
app.post('/api/generate-quiz', aiRateLimit(), async (req: Request, res: Response) => {
  try {
    const { tissueName, difficulty = 'Intermédio', specificTopic, imageBase64, mimeType, questionTypes = 'all', analysis } = req.body;
    // Teto de segurança: um `count` arbitrário do cliente ia direto para o prompt.
    const safeCount = readOptionalInt(req.body.count, 1, 20) ?? 5;

    if (!hasGemini()) {
      if (analysis) {
        const checkedAnalysis = validateLocalAnalysis(analysis);
        if (!checkedAnalysis.ok) {
          return res.status(400).json({ error: checkedAnalysis.error });
        }
        // Contrato 2026-09-28: o frontend passa a enviar a localAnalysis
        // (campo "analysis"); o motor devolve type/answer em TEXTO —
        // mapLocalQuestions traduz para questionType/correctOptionIndex,
        // sem o qual a UI dava TODAS as respostas como erradas.
        try {
          // n=99 = pool completo: o filtro questionTypes tem de aplicar ANTES
          // do corte por count, senão os fill_blanks (últimos do pool) nunca
          // aparecem quando se pede "Apenas Preenchimento de Lacunas".
          const raw = await localQuestions(checkedAnalysis.value as unknown as LocalAnalysis, 99, difficulty === 'Iniciação' ? 'easy' : difficulty === 'Avançado' ? 'hard' : 'medium');
          let qs = mapLocalQuestions(raw);
          // Melhoria 2026-09-28: o filtro da UI ("Apenas Escolha Múltipla" /
          // "Apenas Preenchimento de Lacunas") passou a valer também offline.
          if (questionTypes === 'multiple_choice') qs = qs.filter((q) => q.questionType === 'multiple_choice');
          if (questionTypes === 'fill_blank') qs = qs.filter((q) => q.questionType === 'fill_blank');
          qs = qs.slice(0, safeCount);
          if (!qs.length) {
            return res.status(422).json({ error: 'O motor local não tem perguntas desse tipo — escolhe "Mista" ou usa o modo Gemini.' });
          }
          return res.json({ quizTitle: `Quiz local — ${tissueName || analysis.tissue}`, targetTissue: tissueName || analysis.tissue, questions: qs, mode: 'local' });
        } catch (e: any) {
          // ex.: análise "indeterminate" — mensagem clara, não um 500 genérico
          return res.status(422).json({ error: e.message || 'Análise local insuficiente para gerar perguntas.' });
        }
      }
      return res.status(400).json({ error: 'Quiz offline requer uma análise local prévia (campo "analysis"). Configure GEMINI_API_KEY para quizzes gerais.' });
    }
    const ai = getGenAI();

    const parts: any[] = [];
    const image = takeImageField(imageBase64, res);
    if (!image.ok) return;
    if (image.base64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: image.base64,
        },
      });
    }

    parts.push({ text: buildQuizPrompt({ count: safeCount, tissueName, difficulty, specificTopic, questionTypes }) });

    const response = await ai.models.generateContent({
      model: MODEL_MAIN,
      contents: { parts },
      config: {
        systemInstruction: QUIZ_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: QUIZ_SCHEMA,
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json(parsedData);
  } catch (error: any) {
    console.error('Erro ao gerar questionário:', error);
    return res.status(500).json({
      error: 'Falha ao gerar perguntas académicas.',
      details: error.message || String(error),
    });
  }
});

// API Route: Side-by-Side Histological Slide Comparison
// API Route: Offline comparison (B1) — runs the local CV engine on both the
// uploaded sample and a real gallery slide, then returns a ComparisonResult
// with side-by-side metrics and deltas. Works WITHOUT GEMINI_API_KEY.
app.post('/api/compare-local', async (req: Request, res: Response) => {
  try {
    const { imageBase64, galleryKey, magnification, primaryLabel, referenceLabel } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem da amostra foi fornecida.' });
    }
    if (!galleryKey || !GALLERY_KEYS.has(galleryKey)) {
      return res.status(404).json({ error: 'Lâmina de referência desconhecida na galeria.' });
    }
    const image = validateIncomingImage(imageBase64);
    if (!image.ok) {
      return res.status(400).json({ error: image.error });
    }
    // imageBase64 pode ser "gallery:<key>" quando a amostra em estudo é ela
    // própria uma lâmina da galeria real (não há base64 no cliente nesse caso).
    // Correção 2026-09-29: a key também é validada contra a galeria — antes,
    // "gallery:../../foo" compunha um caminho fora de static/gallery.
    const primaryGalleryKey = image.value.startsWith('gallery:')
      ? image.value.slice('gallery:'.length)
      : null;
    if (primaryGalleryKey && !GALLERY_KEYS.has(primaryGalleryKey)) {
      return res.status(404).json({ error: 'Lâmina da amostra desconhecida na galeria.' });
    }
    const primary = primaryGalleryKey
      ? await runEngineTask(() => localAnalyze(path.join(PROJECT_ROOT, 'engine', 'static', 'gallery', `${primaryGalleryKey}.jpg`)))
      : await runEngineTask(() => localAnalyzeBase64(image.value, magnification));
    const refPath = path.join(PROJECT_ROOT, 'engine', 'static', 'gallery', `${galleryKey}.jpg`);
    const reference = await runEngineTask(() => localAnalyze(refPath));
    const result = buildLocalComparison(
      primary,
      reference,
      primaryLabel || 'Amostra em estudo',
      referenceLabel || 'Lâmina de referência',
    );
    return res.json({ ...result, mode: 'local' });
  } catch (error: any) {
    if (error instanceof EngineBusyError) {
      return res.status(503).json({ error: error.message, retryAfterSeconds: 5 });
    }
    console.error('Erro na comparação offline:', error);
    return res.status(500).json({
      error: 'Falha na comparação offline do motor local.',
      details: error.message || String(error),
    });
  }
});

app.post('/api/compare-slides', aiRateLimit(), async (req: Request, res: Response) => {
  try {
    const { primarySlide, referenceSlide } = req.body;

    if (!primarySlide || !referenceSlide) {
      return res.status(400).json({ error: 'Lâminas para comparação não fornecidas.' });
    }
    if (!hasGemini()) {
      return res.status(501).json({ error: 'Comparação com IA requer GEMINI_API_KEY — usa a «Comparação Offline (motor local)».' });
    }

    const ai = getGenAI();
    const parts: any[] = [];

    const image = takeImageField(primarySlide.imageBase64, res, 'primarySlide.imageBase64');
    if (!image.ok) return;
    if (image.base64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: image.base64,
        },
      });
    }

    parts.push({ text: buildComparePrompt(primarySlide, referenceSlide) });

    const response = await ai.models.generateContent({
      model: MODEL_MAIN,
      contents: { parts },
      config: {
        systemInstruction: COMPARE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: COMPARE_SCHEMA,
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json(parsedData);
  } catch (error: any) {
    console.error('Erro na comparação de lâminas:', error);
    return res.status(500).json({
      error: 'Falha ao processar comparação com IA.',
      details: error.message || String(error),
    });
  }
});

// API Route: Multi-Turn Gemini Histopathology Chatbot
app.post('/api/chat', aiRateLimit(), async (req: Request, res: Response) => {
  try {
    const {
      messages,
      tissueContext,
      imageBase64,
      localFeatures,
      mimeType,
      modelChoice = MODEL_MAIN,
      rolePersona = 'pathologist',
    } = req.body;

    const checkedMessages = validateChatMessages(messages);
    if (!checkedMessages.ok) {
      return res.status(400).json({ error: checkedMessages.error });
    }
    const turns = checkedMessages.value;

    if (!hasGemini()) {
      const last = turns[turns.length - 1];
      // C3: passa as métricas reais da lâmina ao tutor offline — respostas
      // com números concretos em vez de respostas genéricas sem contexto.
      const reply = await localChat(last.text || last.content || '', tissueContext, localFeatures);
      return res.json({ ...reply, modelUsed: 'local-tutor' });
    }

    const ai = getGenAI();

    const systemInstruction = chatSystemInstruction(tissueContext, rolePersona);

    const image = takeImageField(imageBase64, res);
    if (!image.ok) return;

    // Map conversation turns to Gemini API format
    const contents = turns.map((m, index: number) => {
      const parts: any[] = [];
      // Attach image to the first message if provided
      if (index === 0 && image.base64) {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: image.base64,
          },
        });
      }
      parts.push({ text: m.text || m.content });
      return {
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts,
      };
    });

    const selectedModel = resolveChatModel(modelChoice);

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction,
      },
    });

    return res.json({
      reply: response.text,
      modelUsed: selectedModel,
    });
  } catch (error: any) {
    console.error('Erro no chatbot Gemini:', error);
    return res.status(500).json({
      error: 'Falha ao processar mensagem com a IA.',
      details: error.message || String(error),
    });
  }
});

// API Route: Histology Tutor Consultation (usado por integrações externas;
// a UI do tutor fala com /api/chat, que tem fallback offline)
app.post('/api/ask-tutor', aiRateLimit(), async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const question = readOptionalString(req.body.question, 4_000);
    const tissueContext = readOptionalString(req.body.tissueContext, 500);

    if (!question) {
      return res.status(400).json({ error: 'Pergunta não informada.' });
    }
    if (!hasGemini()) {
      return res.status(501).json({ error: 'Tutor Gemini indisponível: falta GEMINI_API_KEY. Usa /api/chat, que tem tutor offline.' });
    }

    const image = takeImageField(imageBase64, res);
    if (!image.ok) return;

    const ai = getGenAI();
    const parts: any[] = [];

    if (image.base64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: image.base64,
        },
      });
    }

    parts.push({
      text: `Contexto do Tecido Atual: ${tissueContext || 'Histologia Geral'}
Pergunta do estudante/investigador: ${question}

Forneça uma resposta clara, didática, fundamentada em critérios histológicos precisos (morfologia celular, colorações, citoesqueleto, matriz extracelular). Em português técnico formal.`,
    });

    const response = await ai.models.generateContent({
      model: MODEL_MAIN,
      contents: { parts },
      config: {
        systemInstruction: 'Você é o Tutor de Histologia HistoScope AI. Responda com clareza clínica e académica exemplar.',
      },
    });

    return res.json({ answer: response.text });
  } catch (error: any) {
    console.error('Erro no tutor:', error);
    return res.status(500).json({
      error: 'Falha ao responder à questão.',
      details: error.message || String(error),
    });
  }
});

// API Route: Real reference gallery (micrographs from Wikimedia Commons, CC)
// Bloco — chaves válidas carregadas UMA vez: o :key do URL é validado contra
// este conjunto (correcção 2026-09-28: antes, key=../../etc/... percorria o
// disco — path traversal em /api/gallery/:key/analysis).
const GALLERY_KEYS: Set<string> = (() => {
  try {
    const items = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'engine', 'gallery_meta.json'), 'utf-8'));
    return new Set<string>(items.map((i: { key: string }) => i.key));
  } catch {
    return new Set<string>();
  }
})();

app.get('/api/gallery', (_req: Request, res: Response) => {
  try {
    const metaPath = path.join(PROJECT_ROOT, 'engine', 'gallery_meta.json');
    const items = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: 'Galeria indisponível: ' + e.message });
  }
});

app.use('/gallery-images', express.static(path.join(PROJECT_ROOT, 'engine', 'static', 'gallery')));

// API Route: Local analysis of a gallery slide (mapped to the UI contract —
// melhoria 2026-09-28: devolve HistologyAnalysis + localAnalysis, igual ao
// endpoint de análise, para a galeria real ser utilizável na UI).
app.get('/api/gallery/:key/analysis', async (req: Request, res: Response) => {
  if (!GALLERY_KEYS.has(req.params.key)) {
    return res.status(404).json({ error: 'Lâmina desconhecida na galeria.' });
  }
  try {
    // PROJECT_ROOT (não __dirname): em produção o server corre de dist/ e os
    // assets do motor ficam na raiz (bug de caminhos 2026-09-28).
    const imgPath = path.join(PROJECT_ROOT, 'engine', 'static', 'gallery', `${req.params.key}.jpg`);
    const analysis = await runEngineTask(() => localAnalyze(imgPath));
    res.json({ ...localAnalysisToHistology(analysis), mode: 'local', localAnalysis: analysis });
  } catch (e: any) {
    if (e instanceof EngineBusyError) {
      return res.status(503).json({ error: e.message, retryAfterSeconds: 5 });
    }
    res.status(500).json({ error: 'Análise local indisponível: ' + e.message });
  }
});

// API Route: Runtime capabilities (frontend can adapt its UI)
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({ gemini: hasGemini(), engine: engineLoad() });
});

// Mount Vite or static server
async function startServer() {
  if (!isProduction) {
    // Import dinâmico: em produção o servidor não carrega o `vite` (a imagem
    // runtime só traz as dependências de servidor).
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind 127.0.0.1 por defeito (correcção 2026-09-28: 0.0.0.0 expunha a
  // chave Gemini à rede local sem autenticação nenhuma). HOST no .env para
  // quem realmente quiser expor (com reverse proxy à frente).
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => {
    console.log(`HistoScope AI Server running on http://${HOST}:${PORT}`);
  });
}

// O servidor só arranca quando este ficheiro é o ponto de entrada (`tsx
// server.ts` / `node dist/server.js`). Ao ser importado — pelos testes — fica
// só o `app`, sem abrir portas nem criar o servidor de desenvolvimento do Vite.
const isMainModule = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === __filename;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  void startServer();
}

export { app, startServer };
