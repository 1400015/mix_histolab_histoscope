// Prompts, schemas e modelos Gemini — extraídos do server.ts (2026-09-28,
// melhoria M6: os schemas sozinhos eram ~300 linhas dentro do monólito).
// Tudo o que fala com o Gemini em termos de CONTEÚDO vive aqui; server.ts
// mantém só o HTTP e a orquestração.

import { Type } from '@google/genai';

export const MODEL_MAIN = 'gemini-3.8-flash';
export const MODEL_LITE = 'gemini-3.1-flash-lite';

export function resolveChatModel(modelChoice: string): string {
  return modelChoice === MODEL_LITE ? MODEL_LITE : MODEL_MAIN;
}

/* ───────────────────────── Análise histológica ───────────────────────── */

export const ANALYSIS_SYSTEM = `Você é um patologista e histologista académico de renome internacional, especialista em microscopia ótica, histotécnica e diagnóstico morfológico de tecidos humanos e animais.
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

export function buildAnalysisPrompt(opts: {
  tissueHint?: string;
  stainHint?: string;
  customInstructions?: string;
  /** Bloco de métricas do motor local (grounding) — null se indisponível. */
  localContext: string | null;
}): string {
  return `Analise minuciosamente esta lâmina histológica.
${opts.tissueHint ? `Dica de tecido/órgão do utilizador: ${opts.tissueHint}` : ''}
${opts.stainHint ? `Coloração indicada: ${opts.stainHint}` : ''}
${opts.customInstructions ? `Instruções específicas: ${opts.customInstructions}` : ''}

${opts.localContext ? `\n\nMétricas objetivas do motor de visão por computador local (use-as para fundamentar a análise):\n${opts.localContext}` : ''}\nRetorne exclusivamente um JSON com a estrutura especificada.`;
}

export const ANALYSIS_SCHEMA = {
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
};

/* ───────────────────────────── Quiz académico ─────────────────────────── */

export const QUIZ_SYSTEM =
  'Você é um professor catedrático de Histologia e Patologia Geral. Crie perguntas rigorosas e educativas em Português de Portugal.';

export function buildQuizPrompt(opts: {
  count: number;
  tissueName?: string;
  difficulty: string;
  specificTopic?: string;
  questionTypes: string;
}): string {
  return `Gere ${opts.count} perguntas académicas de alta precisão pedagógica para estudantes universitários de Medicina, Ciências Biomédicas e Biologia Celular sobre Histologia.
Tecido ou contexto: ${opts.tissueName || 'Tecidos fundamentais e órgãos humanos'}
Nível de dificuldade: ${opts.difficulty}
${opts.specificTopic ? `Foco específico: ${opts.specificTopic}` : ''}
Tipos de questão solicitados: ${opts.questionTypes} (Gere perguntas de escolha múltipla tradicionais e perguntas de preenchimento de lacunas / fill_blank).

Critérios para perguntas de preenchimento de lacuna (questionType = "fill_blank"):
- O enunciado deve conter uma frase com "_______" no lugar do termo histológico chave (ex: tipo de célula, corante, proteína ou estrutura).
- Indique 'acceptableAnswers' (sinónimos aceitáveis do termo).
- Também forneça 4 'options' de apoio caso o aluno queira ver opções.

Critérios para escolha múltipla (questionType = "multiple_choice"):
- 4 opções (A, B, C, D), correctOptionIndex (0 a 3).

Cada pergunta DEVE ter uma justificação / explicação aprofundada baseada em referências como Junqueira & Carneiro / Wheater's Functional Histology.`;
}

export const QUIZ_SCHEMA = {
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
};

/* ─────────────────────── Comparação de lâminas ───────────────────────── */

export const COMPARE_SYSTEM =
  'Você é um médico patologista especialista em diagnóstico morfológico comparativo de tecidos humanos. Em português de Portugal.';

export function buildComparePrompt(primary: {
  title: string;
  tissue?: string;
  primaryTissue?: string;
  description?: string;
}, reference: {
  title: string;
  tissueFamily: string;
  primaryTissue: string;
  staining: string;
  description: string;
}): string {
  return `Atue como um patologista sénior e professor de histologia.
Compare a Lâmina em Análise (Amostra Submetida) com a Lâmina de Referência seleccionada:

LÂMINA EM ANÁLISE / AMOSTRA:
- Título/Classificação: ${primary.title}
- Tecido: ${primary.tissue || primary.primaryTissue || 'Sob investigação'}
- Descrição: ${primary.description || ''}

LÂMINA DE REFERÊNCIA DA BIBLIOTECA:
- Título: ${reference.title}
- Família Tecidual: ${reference.tissueFamily}
- Tecido: ${reference.primaryTissue}
- Coloração Padrão: ${reference.staining}
- Descrição de Referência: ${reference.description}

Efetue uma análise comparativa aprofundada:
1. Semelhanças morfológicas (padrões arquiteturais, características tintoriais, forma celular).
2. Diferenças diagnósticas cruciais (critérios objetivos que separam inequivocamente as duas preparações).
3. Identificação de padrões normais vs potenciais anomalias / alterações patológicas ou artefactos.
4. Conclusão diagnóstica comparativa.

Responda exclusivamente em formato JSON com a estrutura especificada.`;
}

export const COMPARE_SCHEMA = {
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
};

/* ───────────────────────────── Tutor / chat ──────────────────────────── */

export function personaInstruction(rolePersona: string): string {
  if (rolePersona === 'academic_tutor') {
    return 'Você é um professor tutor universitário de Histologia Geral e dos Sistemas Orgânicos. O seu objetivo é guiar didaticamente o estudante, decompondo estruturas em critérios observáveis e incentivando o raciocínio dedutivo.';
  }
  if (rolePersona === 'lab_histotechnologist') {
    return 'Você é um especialista sénior em Histotecnologia, Colorações Especiais e Imuno-histoquímica. O seu foco é a química dos corantes, fixação tecidual, artefactos de corte e técnicas avançadas de marcação molecular.';
  }
  return 'Você é um médico patologista e professor catedrático de Histologia e Anatomia Patológica.';
}

export function chatSystemInstruction(tissueContext: string | undefined, rolePersona: string): string {
  return `${personaInstruction(rolePersona)}
Você atua dentro da plataforma médica e de aprendizagem HistoScope AI.
Contexto do corte histológico sob análise: ${tissueContext || 'Histologia Geral Humana'}.
Instruções:
- Responda sempre em Português com rigor científico e terminologia histológica médica formal.
- Seja explicativo, estruturado e didático. Se oportuno, utilize marcadores e realces para clarificar.
- Considere que o utilizador está a observar uma lâmina histológica e pode tirar dúvidas sobre morfologia nuclear, citoplasma, matriz extracelular ou diagnósticos diferenciais.`;
}
