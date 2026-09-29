import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSRSMap,
  isDueForReview,
  prioritizeQuestions,
  questionKey,
  recordSRSAnswer,
} from '../src/utils/spacedRepetition';

const q = (text: string) => ({ question: text });

// Ambiente node: localStorage tem de ser simulado (stub em memoria).
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
});

describe('spacedRepetition (B4)', () => {
  afterEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  it('normaliza a chave da pergunta (acentos, maiusculas, pontuacao)', () => {
    expect(questionKey(q('Qual é o Tecido?'))).toBe('qualeotecido');
    expect(questionKey(q('qual o tecido'))).toBe('qualotecido');
  });

  it('erro reseta repeticoes e marca revisao imediata', () => {
    const rec = recordSRSAnswer('k1', false);
    expect(rec.repetitions).toBe(0);
    expect(rec.misses).toBe(1);
    expect(rec.intervalDays).toBe(0);
    expect(rec.dueAt).toBeLessThanOrEqual(Date.now());
    expect(isDueForReview(rec)).toBe(true);
  });

  it('acertos consecutivos aumentam o intervalo (SM-2: 1, 6, n x EF)', () => {
    const r1 = recordSRSAnswer('k2', true);
    expect(r1.intervalDays).toBe(1);
    const r2 = recordSRSAnswer('k2', true);
    expect(r2.intervalDays).toBe(6);
    const r3 = recordSRSAnswer('k2', true);
    expect(r3.intervalDays).toBeGreaterThan(6);
    expect(r3.easiness).toBeGreaterThanOrEqual(1.3);
  });

  it('prioriza perguntas falhadas a frente das novas', () => {
    recordSRSAnswer(questionKey(q('Pergunta falhada')), false);
    const sorted = prioritizeQuestions([q('Pergunta nova'), q('Pergunta falhada')]);
    expect(sorted[0].question).toBe('Pergunta falhada');
  });

  it('mantem o registo em localStorage', () => {
    recordSRSAnswer('k3', true);
    expect(getSRSMap()['k3']).toBeDefined();
    expect(getSRSMap()['k3'].intervalDays).toBe(1);
  });
});
