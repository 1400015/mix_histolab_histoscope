// Local histology engine bridge (Histolab CV pipeline).
// Calls the Python engine via child_process — works fully offline,
// no GEMINI_API_KEY required.

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENGINE_DIR = path.resolve(__dirname, '..', 'engine');
const PY = process.env.PYTHON_BIN || 'python3';

export interface LocalAnalysis {
  tissue: string;
  tissue_confidence: number;
  evidence: { type: string; confidence: number; criteria: string[] }[];
  features: Record<string, number>;
}

export function engineAvailable(): boolean {
  return true; // python3 + cv2 required; failures degrade gracefully at call time
}

function runEngine(request: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PY, [path.join(ENGINE_DIR, 'engine_cli.py')], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`engine exited ${code}: ${err || out}`));
      }
      try {
        const parsed = JSON.parse(out);
        if (!parsed.ok) return reject(new Error(parsed.error || 'engine error'));
        resolve(parsed);
      } catch (e: any) {
        reject(new Error(`engine output parse error: ${e.message}`));
      }
    });
    proc.on('error', reject);
    proc.stdin.write(JSON.stringify(request));
    proc.stdin.end();
  });
}

// Analyze an image file on disk with the local CV pipeline.
export function localAnalyze(imagePath: string): Promise<LocalAnalysis> {
  return runEngine({ action: 'analyze', imagePath }).then((r) => r.analysis);
}


// Analyze a base64 image: write to a temp file, then run the pipeline.
import os from 'os';
import fs from 'fs';
export async function localAnalyzeBase64(imageBase64: string): Promise<LocalAnalysis> {
  const clean = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  const tmp = path.join(os.tmpdir(), `histoscope_${Date.now()}.jpg`);
  fs.writeFileSync(tmp, Buffer.from(clean, 'base64'));
  try {
    return await localAnalyze(tmp);
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
