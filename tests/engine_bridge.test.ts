import { describe, expect, it } from 'vitest';
import {
  buildLocalComparison,
  localAnalysisToHistology,
  mapLocalQuestions,
  type LocalAnalysis,
} from '../engine/engine_bridge';

const baseAnalysis = (overrides: Partial<LocalAnalysis> = {}): LocalAnalysis => ({
  tissue: 'liver',
  tissue_confidence: 0.57,
  evidence: [
    { type: 'liver', confidence: 0.57, criteria: ['critério A', 'critério B'] },
  ],
  features: {
    n_nuclei: 100,
    nuclei_per_mm2: 44.4,
    median_nucleus_area: 51,
    nucleus_area_cv: 1.39,
    median_circularity: 0.91,
    median_elongation: 1.5,
    stromal_ratio: 0.27,
    empty_ratio: 0.18,
    hematoxylin_mean: 5.8,
    eosin_mean: 76.8,
  },
  ...overrides,
});

describe('mapLocalQuestions (contrato motor → UI)', () => {
  it('traduz answer (texto) para correctOptionIndex (índice)', () => {
    const qs = [
      {
        type: 'mcq',
        question: 'Qual o tecido?',
        options: ['Fígado', 'Rim', 'Pele'],
        answer: 'Rim',
        explanation: 'exp',
        topic: 'tecidos',
        difficulty: 'medium',
      },
    ];
    const mapped = mapLocalQuestions(qs);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].correctOptionIndex).toBe(1);
    expect(mapped[0].questionType).toBe('multiple_choice');
  });

  it('descarta perguntas malformadas (sem options) e mantém as open (autoavaliação)', () => {
    const qs = [
      { type: 'open', question: 'Descreve', answer: 'x', explanation: '', topic: 't' },
      { type: 'mcq', question: 'Sem options', answer: 'x', explanation: '', topic: 't' },
      { type: 'mcq', question: 'Ok', options: ['A', 'B'], answer: 'B', explanation: 'e', topic: 't' },
    ];
    const mapped = mapLocalQuestions(qs);
    expect(mapped).toHaveLength(2);
    expect(mapped[mapped.length - 1].question).toBe('Ok');
    expect(mapped.find((m) => m.questionType === 'open')).toBeDefined();
  });

  it('mapeia fill_blank com acceptableAnswers', () => {
    const qs = [
      {
        type: 'fill_blank',
        question: 'O ___ cora núcleos',
        options: ['colágeno', 'azul', 'eosina'],
        answer: 'azul',
        acceptableAnswers: ['azul', 'hematoxilina'],
        explanation: 'e',
        topic: 't',
      },
    ];
    const mapped = mapLocalQuestions(qs);
    expect(mapped[0].questionType).toBe('fill_blank');
    expect(mapped[0].correctOptionIndex).toBe(1);
    expect(mapped[0].acceptableAnswers).toContain('hematoxilina');
  });

  it('responde a answer ausente com índice 0 (não rebenta)', () => {
    const qs = [{ type: 'mcq', question: 'Q', options: ['A', 'B'], answer: 'Z', explanation: '', topic: 't' }];
    const mapped = mapLocalQuestions(qs);
    expect(mapped[0].correctOptionIndex).toBe(0);
  });
});

describe('localAnalysisToHistology (contrato offline → UI)', () => {
  it('preenche tissueClassification SEMPRE (leitura sem guarda na UI)', () => {
    const h = localAnalysisToHistology(baseAnalysis());
    expect(h.tissueClassification.primaryTissue).toBe('Parênquima Hepático');
    expect(h.tissueClassification.tissueFamily).toBe('Órgãos e Sistemas');
    expect(h.tissueClassification.confidenceLevel).toContain('57%');
    expect(h.diagnosticCriteria.keyIdentificationRules.length).toBeGreaterThan(0);
  });

  it('indeterminate é apresentado como tal, não como tecido válido', () => {
    const h = localAnalysisToHistology(
      baseAnalysis({ tissue: 'indeterminate', tissue_confidence: 0.0 }),
    );
    expect(h.tissueClassification.primaryTissue).toBe('Indeterminado');
  });

  it('inclui as novas classes A3 (cartilage/kidney/lung)', () => {
    for (const t of ['cartilage', 'kidney', 'lung']) {
      const h = localAnalysisToHistology(baseAnalysis({ tissue: t }));
      expect(h.tissueClassification.primaryTissue).not.toBe(t);
    }
  });

  it('usa scale_estimate quando presente (A2)', () => {
    const h = localAnalysisToHistology(
      baseAnalysis({
        scale_estimate: { px_per_mm: 1280, source: 'magnification', note: 'estimativa' },
      }),
    );
    expect(h.tissueClassification.magnificationEstimate).toContain('1280');
    expect(h.diagnosticCriteria.artifactsAndCaveats.join(' ')).toContain('1280');
  });
});

describe('buildLocalComparison (B1)', () => {
  const ref = baseAnalysis({
    tissue: 'kidney',
    tissue_confidence: 0.46,
    features: {
      n_nuclei: 112,
      nuclei_per_mm2: 50,
      median_nucleus_area: 48,
      nucleus_area_cv: 1.1,
      median_circularity: 0.89,
      median_elongation: 1.4,
      stromal_ratio: 0.017,
      empty_ratio: 0.0,
      hematoxylin_mean: 138,
      eosin_mean: 55,
    },
  });

  it('produz o contrato ComparisonResult completo', () => {
    const c = buildLocalComparison(baseAnalysis(), ref);
    expect(c.comparisonSummary).toBeTruthy();
    expect(c.similarities).toBeInstanceOf(Array);
    expect(c.differences.length).toBe(7);
    expect(c.differences[0]).toHaveProperty('feature');
    expect(c.differences[0]).toHaveProperty('primarySampleObservation');
    expect(c.differences[0]).toHaveProperty('referenceObservation');
    expect(c.differences[0]).toHaveProperty('diagnosticSignificance');
    expect(c.patternAnalysis).toBeTruthy();
    expect(c.diagnosticConclusion).toBeTruthy();
  });

  it('tecidos diferentes → anomalia com ambas as classificações', () => {
    const c = buildLocalComparison(baseAnalysis(), ref);
    expect(c.potentialAnomaliesOrVariations[0]).toContain('liver');
    expect(c.potentialAnomaliesOrVariations[0]).toContain('kidney');
  });

  it('tecidos iguais → semelhança registada', () => {
    const c = buildLocalComparison(baseAnalysis(), baseAnalysis({ tissue_confidence: 0.6 }), 'A', 'B');
    expect(c.similarities.some((s) => s.includes('liver'))).toBe(true);
    expect(c.diagnosticConclusion).toContain('liver');
  });

  it('deltas com divisão por zero não rebentam', () => {
    const zeroRef = baseAnalysis({
      tissue: 'indeterminate',
      tissue_confidence: 0,
      features: {
        n_nuclei: 0,
        nuclei_per_mm2: 0,
        median_nucleus_area: 0,
        nucleus_area_cv: 0,
        median_circularity: 0,
        median_elongation: 0,
        stromal_ratio: 0,
        empty_ratio: 0,
        hematoxylin_mean: 0,
        eosin_mean: 0,
      },
    });
    const c = buildLocalComparison(baseAnalysis(), zeroRef);
    expect(c.differences.length).toBe(7);
  });
});
