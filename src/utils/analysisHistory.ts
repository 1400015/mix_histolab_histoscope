import type { HistologyAnalysis } from '../types/histology';
import { deleteThumbnail } from './thumbnailStore';

/** B2: histórico persistente de análises (localStorage). As análises
 * desapareciam no refresh — agora cada lâmina analisada fica guardada e pode
 * ser reaberta a partir do atlas.
 *
 * 2026-09-29: as miniaturas saíram daqui para o IndexedDB
 * (`utils/thumbnailStore`). Data URLs no localStorage esgotavam a quota de
 * ~5 MB e forçavam a apagar todas as miniaturas; o campo `thumbnail` fica só
 * por compatibilidade com entradas antigas já gravadas. */

export interface StoredAnalysis {
  id: string;
  title: string;
  staining: string;
  tissue: string;
  organ: string;
  confidence: string;
  mode: string;
  date: string;
  /** Legado: entradas antigas trazem a miniatura embutida em data URL. */
  thumbnail?: string;
  analysis: HistologyAnalysis;
  localFeatures?: Record<string, number> | null;
}

const KEY = 'histoscope_analysis_history';
const MAX_ITEMS = 30;
const THUMB_MAX = 320;

/** Reduz uma imagem (data URL) para uma thumbnail pequena — o IndexedDB não
 * tem o limite do localStorage, mas miniaturas grandes tornam o histórico
 * lento a desenhar. */
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
    while (items.length > MAX_ITEMS) {
      const dropped = items.pop();
      // A entrada sai do histórico; a miniatura não pode ficar órfã.
      if (dropped) void deleteThumbnail(dropped.id);
    }
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Histórico de análises: falha ao persistir.', e);
  }
}

export function deleteAnalysis(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listAnalyses().filter((i) => i.id !== id)));
  } catch (e) {
    console.warn('Histórico de análises: falha ao apagar.', e);
  }
  void deleteThumbnail(id);
}
