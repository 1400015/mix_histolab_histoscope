import type { HistologyAnalysis } from '../types/histology';

/** B2: histórico persistente de análises (localStorage). As análises
 * desapareciam no refresh — agora cada lâmina analisada fica guardada e pode
 * ser reaberta a partir do atlas. */

export interface StoredAnalysis {
  id: string;
  title: string;
  staining: string;
  tissue: string;
  organ: string;
  confidence: string;
  mode: string;
  date: string;
  // Thumbnail em data URL, reduzida para caber no quota do localStorage.
  thumbnail?: string;
  analysis: HistologyAnalysis;
  localFeatures?: Record<string, number> | null;
}

const KEY = 'histoscope_analysis_history';
const MAX_ITEMS = 30;
const THUMB_MAX = 320;

/** Reduz uma imagem (data URL) para uma thumbnail pequena — a quota do
 * localStorage (~5MB) não aguenta imagens a resolução completa. */
export function makeThumbnail(dataUrl: string, max = THUMB_MAX): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(undefined);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

export function listAnalyses(): StoredAnalysis[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAnalysis(entry: StoredAnalysis): void {
  try {
    const items = listAnalyses().filter((i) => i.id !== entry.id);
    items.unshift(entry);
    while (items.length > MAX_ITEMS) items.pop();
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    // Quota excedida: remove as thumbnails antigas e tenta outra vez.
    try {
      const trimmed = listAnalyses()
        .slice(0, 10)
        .map((i) => ({ ...i, thumbnail: undefined }));
      trimmed.unshift({ ...entry, thumbnail: undefined });
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      console.warn('Histórico de análises: falha ao persistir (quota).', e);
    }
  }
}

export function deleteAnalysis(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listAnalyses().filter((i) => i.id !== id)));
  } catch {
    /* ignore */
  }
}
