// C4: i18n mínimo pt/en — dicionário central e hook leve de idioma.
// Cobertura inicial: navegação principal e títulos dos painéis; o conteúdo
// pedagógico (análises, quizzes, tutor) permanece em português por ora.

export type Lang = 'pt' | 'en';

export interface Strings {
  appTitle: string;
  appSubtitle: string;
  newImage: string;
  compareSide: string;
  compareTitle: string;
  atlas: string;
  atlasTitle: string;
  quiz: string;
  quizTitle: string;
  progress: string;
  progressTitle: string;
  tutorTitle: string;
}

export const STRINGS: Record<Lang, Strings> = {
  pt: {
    appTitle: 'HistoScope AI',
    appSubtitle: 'Patologia & Treino',
    newImage: 'Nova Imagem',
    compareSide: 'Comparar Lado a Lado',
    compareTitle: 'Comparação Lado a Lado com Lâminas de Referência',
    atlas: 'Atlas de Tecidos',
    atlasTitle: 'Atlas de Lâminas de Referência',
    quiz: 'Avaliação',
    quizTitle: 'Avaliação Académica & Treino',
    progress: 'Progresso',
    progressTitle: 'Progresso e Histórico de Testes',
    tutorTitle: 'Tutor Universitário de Histologia',
  },
  en: {
    appTitle: 'HistoScope AI',
    appSubtitle: 'Pathology & Training',
    newImage: 'New Image',
    compareSide: 'Side-by-Side Comparison',
    compareTitle: 'Side-by-side comparison with reference slides',
    atlas: 'Tissue Atlas',
    atlasTitle: 'Reference slide atlas',
    quiz: 'Assessment',
    quizTitle: 'Academic assessment & training',
    progress: 'Progress',
    progressTitle: 'Progress and test history',
    tutorTitle: 'University histology tutor',
  },
};

const LANG_KEY = 'histoscope_lang';

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'pt') return saved;
  } catch { /* noop */ }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) {
    return 'en';
  }
  return 'pt';
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch { /* noop */ }
}

export function t(lang: Lang): Strings {
  return STRINGS[lang];
}
