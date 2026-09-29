// Local histology engine bridge (Histolab CV pipeline).
// Calls the Python engine via child_process — works fully offline,
// no GEMINI_API_KEY required.
//
// Contratos (2026-09-28, correcção dos bugs do review):
// - Binário Python resolvido por sonda (--version) com candidatos por
//   plataforma (Windows: `python`/`py`, que são os nomes reais; `python3`
//   quase nunca existe lá). Cache da resolução.
// - stdin TEM handler de 'error' (sem ele, EPIPE = uncaughtException =
//   servidor morto) e o spawn tem timeout com kill.
// - localAnalysisToHistology/mapLocalQuestions traduzem o motor para o
//   contrato HistologyAnalysis da UI — o modo offline deixa de rebentar
//   o frontend (ImageUploaderModal lia tissueClassification inexistente).

import { spawn } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Em dev o ficheiro vive em engine/ (dirname = engine). Em produção o bundle corre
// de dist/, e o motor fica na raiz do projeto — tenta ambos.
const DEV_ENGINE = path.resolve(__dirname);
const PROD_ENGINE = path.resolve(__dirname, '..', 'engine');
const ENGINE_DIR = fs.existsSync(path.join(DEV_ENGINE, 'engine_cli.py'))
  ? DEV_ENGINE
  : PROD_ENGINE;

export interface LocalAnalysis {
  tissue: string;
  tissue_confidence: number;
  evidence: { type: string; confidence: number; criteria: string[] }[];
  features: Record<string, number>;
  // Segmentação de núcleos sobre a lâmina (JPEG base64) — a UI mostra-a
  // por cima da imagem com um toggle (melhoria 2026-09-28).
  overlay_png_b64?: string;
  scale_estimate?: { px_per_mm: number; source: string; note: string };
  // B5: métricas individuais por núcleo segmentado (até 800), em coordenadas
  // de pixel da imagem original — usadas pelo overlay interativo da UI.
  nuclei?: NucleusMetrics[];
}

/** Métricas morfométricas de um único núcleo segmentado (B5). */
export interface NucleusMetrics {
  x: number;
  y: number;
  area: number;
  perimeter: number;
  circularity: number;
  elongation: number;
}

/** Formas mínimas do contrato da UI (ver src/types/histology.ts) —
 * duplicadas aqui de propósito: o frontend não pode importar código do
 * servidor e vice-versa. */
export interface LocalHistologyAnalysis {
  tissueClassification: {
    primaryTissue: string;
    tissueFamily: string;
    probableOrgan: string;
    confidenceLevel: string;
    stainType: string;
    magnificationEstimate?: string;
    generalDescription: string;
  };
  stainingAnalysis: {
    stainName: string;
    basophilicElements: string;
    acidophilicElements: string;
    chemicalRationale: string;
  };
  cellularConstituents: unknown[];
  diagnosticCriteria: {
    keyIdentificationRules: string[];
    differentialDiagnosis: unknown[];
    artifactsAndCaveats: string[];
  };
  academicQuizQuestions: unknown[];
}

export interface LocalQuizQuestion {
  id?: string;
  questionType: 'multiple_choice' | 'fill_blank' | 'open';
  question: string;
  options: string[];
  correctOptionIndex: number;
  acceptableAnswers?: string[];
  explanation: string;
  category: string;
  difficulty?: string;
}

/** Bloco — resolução do binário Python. Candidatos por plataforma porque o
 * `python3` do Linux não existe no Windows (lá é `python` ou o launcher
 * `py`). PYTHON_BIN do .env tem prioridade absoluta. Resolvido uma vez. */
const PY_CANDIDATES = process.env.PYTHON_BIN
  ? [process.env.PYTHON_BIN]
  : process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

let resolvedPy: string | null = null;

async function resolvePython(): Promise<string> {
  if (resolvedPy) return resolvedPy;
  for (const cand of PY_CANDIDATES) {
    const ok = await new Promise<boolean>((res) => {
      try {
        const probe = spawn(cand, ['--version'], { stdio: 'ignore' });
        probe.on('error', () => res(false));
        probe.on('close', (code) => res(code === 0));
      } catch {
        res(false);
      }
    });
    if (ok) {
      resolvedPy = cand;
      return cand;
    }
  }
  throw new Error(
    `Python não encontrado (tentados: ${PY_CANDIDATES.join(', ')}). ` +
    'Instala Python 3 com `pip install -r engine/requirements.txt`.',
  );
}

const ENGINE_TIMEOUT_MS = 90_000; // imagens grandes em máquinas lentas

function runEngine(request: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    void resolvePython().then((py) => {
      const proc = spawn(py, [path.join(ENGINE_DIR, 'engine_cli.py')], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let out = '';
      let err = '';
      let settled = false;
      const timer = setTimeout(() => {
        proc.kill();
        done(() => reject(new Error(`engine timeout após ${ENGINE_TIMEOUT_MS / 1000}s`)));
      }, ENGINE_TIMEOUT_MS);
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      // Sem este handler, um EPIPE no stdin (processo morto a meio da
      // escrita) sobe como uncaughtException e MATA o servidor Express.
      proc.stdin.on('error', (e) => done(() => reject(new Error(`engine stdin: ${e.message}`))));
      proc.stdout.on('data', (d) => (out += d));
      proc.stderr.on('data', (d) => (err += d));
      proc.on('close', (code) => {
        done(() => {
          if (code !== 0) return reject(new Error(`engine exited ${code}: ${err || out}`));
          try {
            const parsed = JSON.parse(out);
            if (!parsed.ok) return reject(new Error(parsed.error || 'engine error'));
            resolve(parsed);
          } catch (e: any) {
            reject(new Error(`engine output parse error: ${e.message}`));
          }
        });
      });
      proc.on('error', (e) => done(() => reject(e)));
      proc.stdin.write(JSON.stringify(request));
      proc.stdin.end();
    }, reject);
  });
}

// Analyze an image file on disk with the local CV pipeline.
export function localAnalyze(imagePath: string, magnification?: string): Promise<LocalAnalysis> {
  return runEngine({ action: 'analyze', imagePath, magnification }).then((r) => r.analysis);
}

// Analyze a base64 image: write to a temp file, then run the pipeline.
export async function localAnalyzeBase64(imageBase64: string, magnification?: string): Promise<LocalAnalysis> {
  const clean = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  const tmp = path.join(os.tmpdir(), `histoscope_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`);
  fs.writeFileSync(tmp, Buffer.from(clean, 'base64'));
  try {
    return await localAnalyze(tmp, magnification);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// Generate questions from a local analysis (offline quiz generator).
export function localQuestions(
  analysis: LocalAnalysis,
  n = 6,
  difficulty = 'medium'
): Promise<any[]> {
  return runEngine({ action: 'questions', analysis, n, difficulty }).then((r) => r.questions);
}

// Offline rule-based tutor (fallback when no GEMINI_API_KEY).
export function localChat(
  message: string,
  tissue?: string,
  features?: Record<string, number>
): Promise<{ reply: string; suggestions: string[] }> {
  return runEngine({ action: 'chat', message, tissue, features });
}

/** Bloco — tradução do motor local para o contrato HistologyAnalysis da UI.
 * Deve produzir: tissueClassification SEMPRE preenchido (o ImageUploaderModal
 * lê result.tissueClassification.primaryTissue sem guarda — bug corrigido
 * 2026-09-28), com o estado "indeterminate" apresentado como tal. */
const TISSUE_PT: Record<string, { name: string; family: string; organ: string }> = {
  epithelial: { name: 'Tecido Epitelial', family: 'Epitelial', organ: 'Não determinado pela análise local' },
  connective: { name: 'Tecido Conjuntivo', family: 'Conjuntivo', organ: 'Não determinado pela análise local' },
  muscular: { name: 'Tecido Muscular', family: 'Muscular', organ: 'Não determinado pela análise local' },
  nervous: { name: 'Tecido Nervoso', family: 'Nervoso', organ: 'Não determinado pela análise local' },
  adipose: { name: 'Tecido Adiposo', family: 'Órgãos e Sistemas', organ: 'Tecido adiposo (subcutâneo/visceral)' },
  liver: { name: 'Parênquima Hepático', family: 'Órgãos e Sistemas', organ: 'Fígado' },
  cartilage: { name: 'Tecido Cartilagíneo', family: 'Conjuntivo', organ: 'Cartilagem (hibrina/matriz extracelular)' },
  kidney: { name: 'Parênquima Renal', family: 'Órgãos e Sistemas', organ: 'Rim (córtes medular/cortical)' },
  lung: { name: 'Parênquima Pulmonar', family: 'Órgãos e Sistemas', organ: 'Pulmão (alvéolos/septos interalveolares)' },
  indeterminate: { name: 'Indeterminado', family: 'Órgãos e Sistemas', organ: 'Não determinado pela análise local' },
};

export function localAnalysisToHistology(a: LocalAnalysis): LocalHistologyAnalysis {
  const f = a.features;
  const t = TISSUE_PT[a.tissue] ?? { name: a.tissue, family: 'Órgãos e Sistemas', organ: 'Não determinado pela análise local' };
  const pct = Math.round((a.tissue_confidence ?? 0) * 100);
  const isIndeterminate = a.tissue === 'indeterminate';
  const description = isIndeterminate
    ? `Análise local indeterminada (${pct}%): ${(a.evidence[0]?.criteria ?? ['campo sem características histológicas classificáveis']).join(' ')}. Carrega uma lâmina H&E com tecido visível ou usa o modo Gemini para análise enriquecida.`
    : `Classificação determinística do motor local de visão por computador: ${t.name} com ${pct}% de confiança. Métricas objetivas: ${f.n_nuclei} núcleos segmentados (≈${f.nuclei_per_mm2}/mm²), área mediana ${f.median_nucleus_area} px², circularidade mediana ${f.median_circularity}, elongação mediana ${f.median_elongation}, razão de estroma ${f.stromal_ratio} e espaços claros ${f.empty_ratio}.`;

  return {
    tissueClassification: {
      primaryTissue: t.name,
      tissueFamily: t.family,
      probableOrgan: t.organ,
      confidenceLevel: `${pct}% (motor local)`,
      stainType: 'H&E (presumido — desconvolução de cor)',
      magnificationEstimate: a.scale_estimate
        ? `${a.scale_estimate.source === 'magnification' ? 'Ampliação indicada' : 'Padrão'} ≈${Math.round(a.scale_estimate.px_per_mm)} px/mm`
        : '—',
      generalDescription: description,
    },
    stainingAnalysis: {
      stainName: 'H&E (presumido)',
      basophilicElements: `Canal de hematoxilina médio ${f.hematoxylin_mean} — núcleos e cromatina`,
      acidophilicElements: `Canal de eosina médio ${f.eosin_mean} — citoplasma, colagénio e matriz`,
      chemicalRationale: 'Separação por desconvolução de cor (Ruifrok & Johnston) no espaço de densidade ótica.',
    },
    // O motor CV não identifica células individuais nomeadas — a UI mostra
    // a análise morfométrica; identificação celular fica para o modo Gemini.
    cellularConstituents: [],
    diagnosticCriteria: {
      keyIdentificationRules: a.evidence.flatMap((e) =>
        e.criteria.map((c) => `[${e.type} · ${(e.confidence * 100).toFixed(0)}%] ${c}`),
      ),
      differentialDiagnosis: [],
      artifactsAndCaveats: [
        'Contagem automática subestima núcleos sobrepostos e cortes tangenciais.',
        `Escala ${a.scale_estimate ? `${Math.round(a.scale_estimate.px_per_mm)} px/mm (${a.scale_estimate.source})` : '500 px/mm (padrão)'} — estimativa aproximada; densidades absolutas requerem calibração com micrómetro de lâmina.`,
      ],
    },
    academicQuizQuestions: [],
  };
}

/** Bloco — tradução das perguntas do motor (type/answer) para o contrato da
 * UI (questionType/correctOptionIndex). Só MCQ: as "open" não são auto-
 * corrigíveis (a UI dava-as sempre como erradas — bug corrigido 2026-09-28). */
export function mapLocalQuestions(qs: any[]): LocalQuizQuestion[] {
  const difficultyPT: Record<string, string> = {
    easy: 'Iniciação', medium: 'Intermédio', hard: 'Avançado',
  };
  return qs
    .filter((q) => (q.type === 'mcq' || q.type === 'fill_blank' || q.type === 'open') && (Array.isArray(q.options) || q.type === 'open'))
    .map((q, i) => {
      // B6: perguntas dissertativas — resposta modelo + autoavaliação na UI.
      if (q.type === 'open') {
        return {
          id: `local_${i + 1}`,
          questionType: 'open' as const,
          question: String(q.question ?? ''),
          options: [],
          correctOptionIndex: -1,
          modelAnswer: String(q.answer ?? ''),
          explanation: String(q.explanation ?? ''),
          category: String(q.topic ?? 'histologia'),
          difficulty: difficultyPT[q.difficulty] ?? 'Intermédio',
        };
      }
      const idx = q.options.indexOf(q.answer);
      if (q.type === 'fill_blank') {
        return {
          id: `local_${i + 1}`,
          questionType: 'fill_blank' as const,
          question: String(q.question ?? ''),
          options: q.options.map(String),
          correctOptionIndex: idx >= 0 ? idx : 0,
          acceptableAnswers: Array.isArray(q.acceptableAnswers)
            ? q.acceptableAnswers.map(String)
            : [String(q.answer ?? '')],
          explanation: String(q.explanation ?? ''),
          category: String(q.topic ?? 'histologia'),
          difficulty: difficultyPT[q.difficulty] ?? 'Intermédio',
        };
      }
      return {
        id: `local_${i + 1}`,
        questionType: 'multiple_choice' as const,
        question: String(q.question ?? ''),
        options: q.options.map(String),
        // answer é TEXTO no motor; a UI espera o ÍNDICE — sem este mapeamento
        // todas as respostas seriam dadas como erradas.
        correctOptionIndex: idx >= 0 ? idx : 0,
        explanation: String(q.explanation ?? ''),
        category: String(q.topic ?? 'histologia'),
        difficulty: difficultyPT[q.difficulty] ?? 'Intermédio',
      };
    });
}

// Format local features as a compact prompt-context block for Gemini grounding.
export function featuresToPromptContext(a: LocalAnalysis): string {
  const f = a.features;
  return [
    `Classificação local (CV determinística): ${a.tissue} (confiança ${(a.tissue_confidence * 100).toFixed(0)}%)`,
    `Núcleos: ${f.n_nuclei}; densidade ${f.nuclei_per_mm2}/mm²; área mediana ${f.median_nucleus_area}px²; CV ${f.nucleus_area_cv}`,
    `Circularidade mediana ${f.median_circularity}; elongação mediana ${f.median_elongation}`,
    `Razão de estroma ${f.stromal_ratio}; espaços claros ${f.empty_ratio}; H ${f.hematoxylin_mean}; E ${f.eosin_mean}`,
    'Evidência: ' + a.evidence.map((e) => `${e.type} (${(e.confidence * 100).toFixed(0)}%): ${e.criteria.join('; ')}`).join(' | '),
  ].join('\n');
}

/** Bloco — comparação offline (B1): métricas do motor local lado a lado com
 * deltas, sem qualquer chamada a Gemini. Preenche o mesmo contrato
 * ComparisonResult da UI para o SlideComparisonModal funcionar offline. */
export interface LocalComparisonResult {
  comparisonSummary: string;
  similarities: string[];
  differences: {
    feature: string;
    primarySampleObservation: string;
    referenceObservation: string;
    diagnosticSignificance: string;
  }[];
  patternAnalysis: string;
  potentialAnomaliesOrVariations: string[];
  diagnosticConclusion: string;
}

const fmtRatio = (v: number): string => `${(v * 100).toFixed(1)}%`;

export function buildLocalComparison(
  primary: LocalAnalysis,
  reference: LocalAnalysis,
  primaryLabel = 'Amostra em estudo',
  referenceLabel = 'Lâmina de referência',
): LocalComparisonResult {
  const p = primary.features;
  const r = reference.features;
  const ratio = (a: number, b: number): string => {
    if (!b) return '—';
    const x = a / b;
    if (x >= 1) return `${x.toFixed(1)}×`;
    return `${(1 / x).toFixed(1)}× menor`;
  };
  const sameTissue = primary.tissue === reference.tissue;
  const similarities: string[] = [];
  const anomalies: string[] = [];
  if (sameTissue) {
    similarities.push(
      `Ambas classificadas pelo motor local como "${primary.tissue}" (${(primary.tissue_confidence * 100).toFixed(0)}% vs ${(reference.tissue_confidence * 100).toFixed(0)}%).`,
    );
  } else {
    anomalies.push(
      `Classificação tecidular divergente: ${primaryLabel} = "${primary.tissue}" (${(primary.tissue_confidence * 100).toFixed(0)}%) vs ${referenceLabel} = "${reference.tissue}" (${(reference.tissue_confidence * 100).toFixed(0)}%) — sugere tecidos ou órgãos distintos.`,
    );
  }
  if (Math.abs(p.median_nucleus_area - r.median_nucleus_area) / Math.max(r.median_nucleus_area, 1) < 0.3) {
    similarities.push(`Área nuclear mediana semelhante (${p.median_nucleus_area}px² vs ${r.median_nucleus_area}px², diferença <30%).`);
  } else {
    anomalies.push(
      `Área nuclear mediana ${ratio(p.median_nucleus_area, r.median_nucleus_area)} face à referência (${p.median_nucleus_area}px² vs ${r.median_nucleus_area}px²) — diferenças de tamanho nuclear podem refletir atipia, ampliação diferente ou tipo celular distinto.`,
    );
  }
  if (Math.abs(p.median_circularity - r.median_circularity) < 0.15) {
    similarities.push(`Forma nuclear comparável (circularidade ${p.median_circularity.toFixed(2)} vs ${r.median_circularity.toFixed(2)}).`);
  } else {
    anomalies.push(
      `Circularidade nuclear diferente (${p.median_circularity.toFixed(2)} vs ${r.median_circularity.toFixed(2)}) — núcleos mais alongados sugerem músculo, tecido conjuntivo ou atipia.`,
    );
  }
  const differences = [
    {
      feature: 'Densidade nuclear (núcleos/mm²)',
      primarySampleObservation: `${p.nuclei_per_mm2.toFixed(0)}/mm²`,
      referenceObservation: `${r.nuclei_per_mm2.toFixed(0)}/mm²`,
      diagnosticSignificance: `Densidade ${ratio(p.nuclei_per_mm2, r.nuclei_per_mm2)} face à referência — densidades elevadas sugerem epitélios ou tumores; baixas, estroma ou parênquima paucicelular.`,
    },
    {
      feature: 'Área nuclear mediana',
      primarySampleObservation: `${p.median_nucleus_area} px²`,
      referenceObservation: `${r.median_nucleus_area} px²`,
      diagnosticSignificance: `${ratio(p.median_nucleus_area, r.median_nucleus_area)} — varia com atipia, ampliação e tipo celular.`,
    },
    {
      feature: 'Elongação nuclear mediana',
      primarySampleObservation: p.median_elongation.toFixed(2),
      referenceObservation: r.median_elongation.toFixed(2),
      diagnosticSignificance: 'Elongação >2.5 é típica de núcleos fusiformes (músculo liso, fibroblastos).',
    },
    {
      feature: 'Razão de estroma (matriz/células)',
      primarySampleObservation: fmtRatio(p.stromal_ratio),
      referenceObservation: fmtRatio(r.stromal_ratio),
      diagnosticSignificance: `Estroma ${ratio(p.stromal_ratio, r.stromal_ratio)} — estroma abundante sugere tecido conjuntivo ou reação dessoplásica.`,
    },
    {
      feature: 'Espaços claros (vacúolos/lúmens/ar)',
      primarySampleObservation: fmtRatio(p.empty_ratio),
      referenceObservation: fmtRatio(r.empty_ratio),
      diagnosticSignificance: `Espaços claros ${ratio(p.empty_ratio, r.empty_ratio)} — >45% sugere adiposo; 28–45% com septos finos, pulmão.`,
    },
    {
      feature: 'Basofilia (hematoxilina média)',
      primarySampleObservation: p.hematoxylin_mean.toFixed(0),
      referenceObservation: r.hematoxylin_mean.toFixed(0),
      diagnosticSignificance: `Basofilia ${ratio(p.hematoxylin_mean, r.hematoxylin_mean)} — elevada indica nuclearidade intensa (p. ex. córtex renal, linfoma).`,
    },
    {
      feature: 'Eosinofilia (eosina média)',
      primarySampleObservation: p.eosin_mean.toFixed(0),
      referenceObservation: r.eosin_mean.toFixed(0),
      diagnosticSignificance: `Eosinofilia ${ratio(p.eosin_mean, r.eosin_mean)} — citoplasma e matriz proteicos (colagénio, fibras musculares).`,
    },
  ];
  const summary = sameTissue
    ? `Comparação offline do motor local (sem IA na nuvem): ${primaryLabel} e ${referenceLabel} classificam-se como "${primary.tissue}", com diferenças quantitativas locais — densidade nuclear ${ratio(p.nuclei_per_mm2, r.nuclei_per_mm2)}, estroma ${ratio(p.stromal_ratio, r.stromal_ratio)} e espaços claros ${ratio(p.empty_ratio, r.empty_ratio)} face à referência.`
    : `Comparação offline do motor local (sem IA na nuvem): ${primaryLabel} classifica-se como "${primary.tissue}" e ${referenceLabel} como "${reference.tissue}". Métricas: densidade nuclear ${p.nuclei_per_mm2.toFixed(0)}/mm² vs ${r.nuclei_per_mm2.toFixed(0)}/mm²; estroma ${fmtRatio(p.stromal_ratio)} vs ${fmtRatio(r.stromal_ratio)}; espaços claros ${fmtRatio(p.empty_ratio)} vs ${fmtRatio(r.empty_ratio)}.`;
  return {
    comparisonSummary: summary,
    similarities,
    differences,
    patternAnalysis: `Padrão morfométrico da amostra: ${p.n_nuclei} núcleos, densidade ${p.nuclei_per_mm2.toFixed(0)}/mm², circularidade ${p.median_circularity.toFixed(2)}, elongação ${p.median_elongation.toFixed(2)}. Referência: ${r.n_nuclei} núcleos, densidade ${r.nuclei_per_mm2.toFixed(0)}/mm², circularidade ${r.median_circularity.toFixed(2)}, elongação ${r.median_elongation.toFixed(2)}.`,
    potentialAnomaliesOrVariations: anomalies,
    diagnosticConclusion: sameTissue
      ? `O motor local considera os dois campos do mesmo tipo tecidular (${primary.tissue}); as diferenças quantitativas acima devem-se a variação de campo, ampliação ou coloração. Comparações absolutas exigem calibração de escala (ver ampliação no upload).`
      : `O motor local considera os campos de tipos tecidulares distintos (${primary.tissue} vs ${reference.tissue}); este é o resultado de regras morfométricas determinísticas — para diagnóstico diferencial fino, usa o modo Gemini.`,
  };
}
