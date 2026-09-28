import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  localAnalyze,
  localAnalyzeBase64,
  localQuestions,
  localChat,
  featuresToPromptContext,
} from './engine/engine_bridge';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const { imageBase64, mimeType = 'image/jpeg', tissueHint, stainHint, customInstructions, mode = 'auto' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem foi fornecida para análise.' });
    }

    // Local deterministic CV analysis (always attempted; free, offline, grounds Gemini)
    let localAnalysis = null;
    try {
      localAnalysis = await localAnalyzeBase64(imageBase64);
    } catch (e: any) {
      console.error('Motor local indisponível:', e.message);
    }
    if (mode === 'local') {
      if (!localAnalysis) return res.status(500).json({ error: 'Motor local indisponível (requer python3 + opencv-python).' });
      return res.json({ mode: 'local', localAnalysis });
    }
    if (!hasGemini()) {
      if (localAnalysis) return res.json({ mode: 'local', localAnalysis });
      throw new Error('GEMINI_API_KEY ausente e motor local indisponível.');
    }
    const ai = getGenAI();

    // Clean base64 data if it contains a data URL prefix
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const systemPrompt = `Você é um patologista e histologista académico de renome internacional, especialista em microscopia ótica, histotécnica e diagnóstico morfológico de tecidos humanos e animais.
Sua missão é realizar uma análise histológica completa, rigorosa e minuciosa da imagem histológica submetida.
Responda SEMPRE em Português de Portugal / Português técnico médico, com nomenclatura histológica formal estrita (ex.: "Epitélio pavimentoso estratificado queratinizado", "Condrócito em lacuna", "Hematoxilina e Eosina", "Basofilia citoplasmática", "Discos intercalares").

Critérios essenciais que DEVE detalhar:
1. Classificação exata do tecido e provável localização anatómica / órgão.
2. Análise da coloração histológica (ex: Hematoxilina e Eosina - basofilia nuclear vs acidofilia citoplasmática/matriz, Tricrómio de Masson, PAS, Prata, etc.).
3. Identificação pormenorizada de todos os constituintes celulares (morfologia do núcleo, cromatina, nucléolo, citoplasma, limites celulares, inclusões, relação núcleo-citoplasma).
4. Coordenadas aproximadas em percentagem (0 a 100 para x, y, width, height) para localizar as estruturas principais na lâmina (mínimo de 3 a 6 estruturas marcadas).
5. Guia passo a passo de como reconhecer e classificar com alta precisão (critérios diagnósticos diferenciais: "Como não confundir com...").
6. Potenciais artefactos de preparação (retração, dobras, sobreposição, descalcificação) se visíveis.
7. Mini-banco de 3 perguntas académicas de avaliação de escolha múltipla sobre esta lâmina com resolução explicada.`;

    const promptText = `Analise minuciosamente esta lâmina histológica.
${tissueHint ? `Dica de tecido/órgão do utilizador: ${tissueHint}` : ''}
${stainHint ? `Coloração indicada: ${stainHint}` : ''}
${customInstructions ? `Instruções específicas: ${customInstructions}` : ''}

${localAnalysis ? `\n\nMétricas objetivas do motor de visão por computador local (use-as para fundamentar a análise):\n${featuresToPromptContext(localAnalysis)}` : ''}\nRetorne exclusivamente um JSON com a estrutura especificada.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tissueClassification: {
              type: Type.OBJECT,
              properties: {
                primaryTissue: { type: Type.STRING, description: 'Nome formal do tecido (ex: Tecido Epitelial Pavimentoso Estratificado Queratinizado)' },
                tissueFamily: { type: Type.STRING, description: 'Família fundamental: Epitelial, Conjuntivo, Muscular ou Nervoso' },
                probableOrgan: { type: Type.STRING, description: 'Órgão ou estrutura anatómica de origem provável' },
                confidenceLevel: { type: Type.STRING, description: 'Grau de confiança (ex: "Elevado (98%)")' },
                stainType: { type: Type.STRING, description: 'Coloração identificada (ex: Hematoxilina e Eosina - H&E)' },
                magnificationEstimate: { type: Type.STRING, description: 'Estimativa de ampliação (ex: 100x ou 400x)' },
                generalDescription: { type: Type.STRING, description: 'Descrição panorâmica detalhada da lâmina' },
              },
              required: ['primaryTissue', 'tissueFamily', 'probableOrgan', 'confidenceLevel', 'stainType', 'generalDescription'],
            },
            stainingAnalysis: {
              type: Type.OBJECT,
              properties: {
                stainName: { type: Type.STRING },
                basophilicElements: { type: Type.STRING, description: 'Estruturas que retêm o corante básico (afinidade por H - DNA/RNA/núcleos, cor roxo/azul)' },
                acidophilicElements: { type: Type.STRING, description: 'Estruturas que retêm o corante ácido (afinidade por E - proteínas/citoplasma/colagénio, cor rosa)' },
                chemicalRationale: { type: Type.STRING, description: 'Explicação biofísica da afinidade dos corantes nesta lâmina' },
              },
              required: ['stainName', 'basophilicElements', 'acidophilicElements', 'chemicalRationale'],
            },
            cellularConstituents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Nome da célula ou componente (ex: Condrócito, Enterócito, Fibroblasto)' },
                  cellularCategory: { type: Type.STRING, description: 'Célula funcional, Célula estromal, Matriz extracelular, ou Vaso/Estrutura' },
                  morphologyDescription: { type: Type.STRING, description: 'Formato da célula, limites celulares e citoplasma' },
                  nuclearCharacteristics: { type: Type.STRING, description: 'Forma, localização do núcleo, cromatina e nucléolos' },
                  stainingAffinity: { type: Type.STRING, description: 'Basofílica, Eosinofílica, Anfofílica, Cromófoba ou PAS+' },
                  functionalSignificance: { type: Type.STRING, description: 'Função fisiológica no tecido' },
                  pinpoint: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER, description: 'Coordenada X em percentagem (0 a 100)' },
                      y: { type: Type.NUMBER, description: 'Coordenada Y em percentagem (0 a 100)' },
                      width: { type: Type.NUMBER, description: 'Largura da caixa em percentagem (0 a 100)' },
                      height: { type: Type.NUMBER, description: 'Altura da caixa em percentagem (0 a 100)' },
                      label: { type: Type.STRING, description: 'Rótulo curto da estrutura' },
                    },
                    required: ['x', 'y', 'label'],
                  },
                },
                required: ['name', 'cellularCategory', 'morphologyDescription', 'nuclearCharacteristics', 'stainingAffinity', 'functionalSignificance'],
              },
            },
            diagnosticCriteria: {
              type: Type.OBJECT,
              properties: {
                keyIdentificationRules: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Passos objetivos para reconhecer o tecido com 100% de certeza',
                },
                differentialDiagnosis: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      confusedWith: { type: Type.STRING, description: 'Tecido com o qual pode ser confundido' },
                      howToDistinguish: { type: Type.STRING, description: 'Regra de ouro para distinguir' },
                    },
                    required: ['confusedWith', 'howToDistinguish'],
                  },
                },
                artifactsAndCaveats: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Artefactos técnicos ou variações de corte a ter em atenção',
                },
              },
              required: ['keyIdentificationRules', 'differentialDiagnosis', 'artifactsAndCaveats'],
            },
            academicQuizQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctOptionIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  category: { type: Type.STRING, description: 'Identificação Estrutural, Histoquímica, Diagnóstico Diferencial ou Fisiopatologia' },
                  difficulty: { type: Type.STRING, description: 'Iniciação, Intermédio ou Avançado' },
                },
                required: ['question', 'options', 'correctOptionIndex', 'explanation', 'category'],
              },
            },
          },
          required: [
            'tissueClassification',
            'stainingAnalysis',
            'cellularConstituents',
            'diagnosticCriteria',
            'academicQuizQuestions',
          ],
        },
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
        const qs = await localQuestions(analysis, count, difficulty === 'Iniciação' ? 'easy' : difficulty === 'Avançado' ? 'hard' : 'medium');
        return res.json({ quizTitle: `Quiz local — ${tissueName || analysis.tissue}`, targetTissue: tissueName || analysis.tissue, questions: qs, mode: 'local' });
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

    const prompt = `Gere ${count} perguntas académicas de alta precisão pedagógica para estudantes universitários de Medicina, Ciências Biomédicas e Biologia Celular sobre Histologia.
Tecido ou contexto: ${tissueName || 'Tecidos fundamentais e órgãos humanos'}
Nível de dificuldade: ${difficulty}
${specificTopic ? `Foco específico: ${specificTopic}` : ''}
Tipos de questão solicitados: ${questionTypes} (Gere perguntas de escolha múltipla tradicionais e perguntas de preenchimento de lacunas / fill_blank).

Critérios para perguntas de preenchimento de lacuna (questionType = "fill_blank"):
- O enunciado deve conter uma frase com "_______" no lugar do termo histológico chave (ex: tipo de célula, corante, proteína ou estrutura).
- Indique 'acceptableAnswers' (sinónimos aceitáveis do termo).
- Também forneça 4 'options' de apoio caso o aluno queira ver opções.

Critérios para escolha múltipla (questionType = "multiple_choice"):
- 4 opções (A, B, C, D), correctOptionIndex (0 a 3).

Cada pergunta DEVE ter uma justificação / explicação aprofundada baseada em referências como Junqueira & Carneiro / Wheater's Functional Histology.`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction: 'Você é um professor catedrático de Histologia e Patologia Geral. Crie perguntas rigorosas e educativas em Português de Portugal.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quizTitle: { type: Type.STRING },
            targetTissue: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  questionType: { type: Type.STRING, description: 'multiple_choice ou fill_blank' },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctOptionIndex: { type: Type.INTEGER },
                  acceptableAnswers: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Palavras ou termos aceitáveis para preenchimento de lacuna',
                  },
                  explanation: { type: Type.STRING },
                  category: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                  targetStructure: { type: Type.STRING },
                },
                required: ['question', 'options', 'correctOptionIndex', 'explanation', 'category'],
              },
            },
          },
          required: ['quizTitle', 'targetTissue', 'questions'],
        },
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

    const promptText = `Atue como um patologista sénior e professor de histologia.
Compare a Lâmina em Análise (Amostra Submetida) com a Lâmina de Referência seleccionada:

LÂMINA EM ANÁLISE / AMOSTRA:
- Título/Classificação: ${primarySlide.title}
- Tecido: ${primarySlide.tissue || primarySlide.primaryTissue || 'Sob investigação'}
- Descrição: ${primarySlide.description || ''}

LÂMINA DE REFERÊNCIA DA BIBLIOTECA:
- Título: ${referenceSlide.title}
- Família Tecidual: ${referenceSlide.tissueFamily}
- Tecido: ${referenceSlide.primaryTissue}
- Coloração Padrão: ${referenceSlide.staining}
- Descrição de Referência: ${referenceSlide.description}

Efetue uma análise comparativa aprofundada:
1. Semelhanças morfológicas (padrões arquiteturais, características tintoriais, forma celular).
2. Diferenças diagnósticas cruciais (critérios objetivos que separam inequivocamente as duas preparações).
3. Identificação de padrões normais vs potenciais anomalias / alterações patológicas ou artefactos.
4. Conclusão diagnóstica comparativa.

Responda exclusivamente em formato JSON com a estrutura especificada.`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction: 'Você é um médico patologista especialista em diagnóstico morfológico comparativo de tecidos humanos. Em português de Portugal.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comparisonSummary: { type: Type.STRING, description: 'Resumo panorâmico da comparação entre ambas as lâminas' },
            similarities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de semelhanças visuais e morfológicas observadas',
            },
            differences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  feature: { type: Type.STRING, description: 'Critério (ex: Disposição nuclear, Colagénio, Estriações, Camadas)' },
                  primarySampleObservation: { type: Type.STRING, description: 'O que se observa na amostra sob análise' },
                  referenceObservation: { type: Type.STRING, description: 'O que se observa na lâmina de referência' },
                  diagnosticSignificance: { type: Type.STRING, description: 'Importância desta diferença para o diagnóstico' },
                },
                required: ['feature', 'primarySampleObservation', 'referenceObservation', 'diagnosticSignificance'],
              },
            },
            patternAnalysis: { type: Type.STRING, description: 'Análise de padrões arquiteturais e celulares' },
            potentialAnomaliesOrVariations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Potenciais anomalias, variações fenotípicas ou artefactos técnicos contrastantes',
            },
            diagnosticConclusion: { type: Type.STRING, description: 'Parecer diagnóstico comparativo final' },
          },
          required: [
            'comparisonSummary',
            'similarities',
            'differences',
            'patternAnalysis',
            'potentialAnomaliesOrVariations',
            'diagnosticConclusion',
          ],
        },
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
      mimeType,
      modelChoice = 'gemini-3.8-flash',
      rolePersona = 'pathologist',
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem foi fornecida.' });
    }

    if (!hasGemini()) {
      const last = messages[messages.length - 1];
      const reply = await localChat(last.text || last.content || '', tissueContext, undefined);
      return res.json({ ...reply, modelUsed: 'local-tutor' });
    }

    const ai = getGenAI();

    // Determine persona instructions
    let personaPrompt = 'Você é um médico patologista e professor catedrático de Histologia e Anatomia Patológica.';
    if (rolePersona === 'academic_tutor') {
      personaPrompt = 'Você é um professor tutor universitário de Histologia Geral e dos Sistemas Orgânicos. O seu objetivo é guiar didaticamente o estudante, decompondo estruturas em critérios observáveis e incentivando o raciocínio dedutivo.';
    } else if (rolePersona === 'lab_histotechnologist') {
      personaPrompt = 'Você é um especialista sénior em Histotecnologia, Colorações Especiais e Imuno-histoquímica. O seu foco é a química dos corantes, fixação tecidual, artefactos de corte e técnicas avançadas de marcação molecular.';
    }

    const systemInstruction = `${personaPrompt}
Você atua dentro da plataforma médica e de aprendizagem HistoScope AI.
Contexto do corte histológico sob análise: ${tissueContext || 'Histologia Geral Humana'}.
Instruções:
- Responda sempre em Português com rigor científico e terminologia histológica médica formal.
- Seja explicativo, estruturado e didático. Se oportuno, utilize marcadores e realces para clarificar.
- Considere que o utilizador está a observar uma lâmina histológica e pode tirar dúvidas sobre morfologia nuclear, citoplasma, matriz extracelular ou diagnósticos diferenciais.`;

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

    const selectedModel =
      modelChoice === 'gemini-3.1-flash-lite'
        ? 'gemini-3.1-flash-lite'
        : 'gemini-3.8-flash';

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

// API Route: Histology Tutor Consultation
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
      model: 'gemini-3.8-flash',
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
app.get('/api/gallery', (_req: Request, res: Response) => {
  try {
    const metaPath = path.join(__dirname, 'engine', 'gallery_meta.json');
    const items = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: 'Galeria indisponível: ' + e.message });
  }
});

app.use('/gallery-images', express.static(path.join(__dirname, 'engine', 'static', 'gallery')));

// API Route: Precomputed local analysis of a gallery slide
app.get('/api/gallery/:key/analysis', async (req: Request, res: Response) => {
  try {
    const imgPath = path.join(__dirname, 'engine', 'static', 'gallery', `${req.params.key}.jpg`);
    const analysis = await localAnalyze(imgPath);
    res.json(analysis);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HistoScope AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
