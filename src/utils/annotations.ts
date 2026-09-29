import type { UserAnnotation } from '../types/histology';

/**
 * Persistência das anotações — um único dono (2026-09-29).
 *
 * Antes havia dois escritores para a mesma chave
 * (`histoscope_annotations_<slideId>`): o `AnnotationSystem` gravava a lista
 * que tinha em mãos e o `App` gravava `[...userAnnotations, nova]` a partir de
 * um snapshot do render anterior. Duas caixas desenhadas em sequência e a
 * segunda gravação apagava a primeira. Agora toda a leitura e escrita passa
 * por aqui, e o estado vive só no `App`.
 */

const keyFor = (slideId: string): string => `histoscope_annotations_${slideId}`;

export function loadAnnotations(slideId: string): UserAnnotation[] {
  try {
    const raw = localStorage.getItem(keyFor(slideId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserAnnotation[]) : [];
  } catch (e) {
    console.warn('Anotações: não foi possível ler o histórico local.', e);
    return [];
  }
}

export function saveAnnotations(slideId: string, annotations: UserAnnotation[]): void {
  try {
    localStorage.setItem(keyFor(slideId), JSON.stringify(annotations));
  } catch (e) {
    console.warn('Anotações: não foi possível guardar (quota do localStorage?).', e);
  }
}
