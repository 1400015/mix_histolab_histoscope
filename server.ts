import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
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

const app = express();
app.use(express.json({ limit: '40mb' }));
app.use(express.urlencoded({ extended: true, limit: '40mb' }));

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

// API Route: Histological Image Analysis
app.post('/api/analyze-histology', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', tissueHint, stainHint, customInstructions, mode = 'auto', magnification } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem foi fornecida para análise.' });
    }

    // Local deterministic CV analysis (always attempted; free, offline, grounds Gemini)
    let localAnalysis: LocalAnalysis | null = null;
    try {
      localAnalysis = await localAnalyzeBase64(imageBase64, magnification);
    } catch (e: any) {
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

    // Clean base64 data if it contains a data URL prefix
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

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
app.post('/api/generate-quiz', async (req: Request, res: Response) => {
  try {
    const { tissueName, difficulty = 'Intermédio', count = 5, specificTopic, imageBase64, mimeType, questionTypes = 'all', analysis } = req.body;

    if (!hasGemini()) {
      if (analysis) {
        // Contrato 2026-09-28: o frontend passa a enviar a localAnalysis
        // (campo "analysis"); o motor devolve type/answer em TEXTO —
        // mapLocalQuestions traduz para questionType/correctOptionIndex,
        // sem o qual a UI dava TODAS as respostas como erradas.
        try {
          // n=99 = pool completo: o filtro questionTypes tem de aplicar ANTES
          // do corte por count, senão os fill_blanks (últimos do pool) nunca
          // aparecem quando se pede "Apenas Preenchimento de Lacunas".
          const raw = await localQuestions(analysis as LocalAnalysis, 99, difficulty === 'Iniciação' ? 'easy' : difficulty === 'Avançado' ? 'hard' : 'medium');
          let qs = mapLocalQuestions(raw);
          // Melhoria 2026-09-28: o filtro da UI ("Apenas Escolha Múltipla" /
          // "Apenas Preenchimento de Lacunas") passou a valer também offline.
          if (questionTypes === 'multiple_choice') qs = qs.filter((q) => q.questionType === 'multiple_choice');
          if (questionTypes === 'fill_blank') qs = qs.filter((q) => q.questionType === 'fill_blank');
          qs = qs.slice(0, count);
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
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    parts.push({ text: buildQuizPrompt({ count, tissueName, difficulty, specificTopic, questionTypes }) });

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
    // imageBase64 pode ser "gallery:<key>" quando a amostra em estudo é ela
    // própria uma lâmina da galeria real (não há base64 no cliente nesse caso).
    const primary = imageBase64.startsWith('gallery:')
      ? await localAnalyze(path.join(PROJECT_ROOT, 'engine', 'static', 'gallery', `${imageBase64.slice('gallery:'.length)}.jpg`))
      : await localAnalyzeBase64(imageBase64, magnification);
    const refPath = path.join(PROJECT_ROOT, 'engine', 'static', 'gallery', `${galleryKey}.jpg`);
    const reference = await localAnalyze(refPath);
    const result = buildLocalComparison(
      primary,
      reference,
      primaryLabel || 'Amostra em estudo',
      referenceLabel || 'Lâmina de referência',
    );
    return res.json({ ...result, mode: 'local' });
  } catch (error: any) {
    console.error('Erro na comparação offline:', error);
    return res.status(500).json({
      error: 'Falha na comparação offline do motor local.',
      details: error.message || String(error),
    });
  }
});

app.post('/api/compare-slides', async (req: Request, res: Response) => {
  try {
    const { primarySlide, referenceSlide } = req.body;

    if (!primarySlide || !referenceSlide) {
      return res.status(400).json({ error: 'Lâminas para comparação não fornecidas.' });
    }

    const ai = getGenAI();
    const parts: any[] = [];

    if (primarySlide.imageBase64) {
      const cleanBase64 = primarySlide.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64,
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
app.post('/api/chat', async (req: Request, res: Response) => {
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

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem foi fornecida.' });
    }

    if (!hasGemini()) {
      const last = messages[messages.length - 1];
      // C3: passa as métricas reais da lâmina ao tutor offline — respostas
      // com números concretos em vez de respostas genéricas sem contexto.
      const reply = await localChat(last.text || last.content || '', tissueContext, localFeatures);
      return res.json({ ...reply, modelUsed: 'local-tutor' });
    }

    const ai = getGenAI();

    const systemInstruction = chatSystemInstruction(tissueContext, rolePersona);

    // Map conversation turns to Gemini API format
    const contents = messages.map((m: any, index: number) => {
      const parts: any[] = [];
      // Attach image to the first message if provided
      if (index === 0 && imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
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
app.post('/api/ask-tutor', async (req: Request, res: Response) => {
  try {
    const { question, tissueContext, imageBase64, mimeType } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Pergunta não informada.' });
    }

    const ai = getGenAI();
    const parts: any[] = [];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
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
    const imgPath = path.join(__dirname, 'engine', 'static', 'gallery', `${req.params.key}.jpg`);
    const analysis = await localAnalyze(imgPath);
    res.json({ ...localAnalysisToHistology(analysis), mode: 'local', localAnalysis: analysis });
  } catch (e: any) {
    res.status(500).json({ error: 'Análise local indisponível: ' + e.message });
  }
});

// API Route: Runtime capabilities (frontend can adapt its UI)
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({ gemini: hasGemini() });
});

// Mount Vite or static server
async function startServer() {
  if (!isProduction) {
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

startServer();
