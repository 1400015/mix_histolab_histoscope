export type TissueFamily = 'Epitelial' | 'Conjuntivo' | 'Muscular' | 'Nervoso' | 'Órgãos e Sistemas' | 'Sangue e Linfóide';

export interface PinpointCoordinate {
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  width?: number; // 0 - 100 percentage
  height?: number; // 0 - 100 percentage
  label: string;
}

export interface CellularConstituent {
  name: string;
  cellularCategory: string; // ex: 'Célula Funcional', 'Matriz Extracelular', 'Núcleo / Organelo', 'Estrutura Especializada'
  morphologyDescription: string;
  nuclearCharacteristics: string;
  stainingAffinity: string; // ex: 'Basofílica (Roxo/Azul)', 'Eosinofílica (Rosa)', 'PAS-positiva'
  functionalSignificance: string;
  pinpoint?: PinpointCoordinate;
}

export interface DifferentialDiagnosisItem {
  confusedWith: string;
  howToDistinguish: string;
}

export interface DiagnosticCriteria {
  keyIdentificationRules: string[];
  differentialDiagnosis: DifferentialDiagnosisItem[];
  artifactsAndCaveats: string[];
}

export interface StainingAnalysis {
  stainName: string;
  basophilicElements: string;
  acidophilicElements: string;
  chemicalRationale: string;
}

export interface TissueClassification {
  primaryTissue: string;
  tissueFamily: string;
  probableOrgan: string;
  confidenceLevel: string;
  stainType: string;
  magnificationEstimate?: string;
  generalDescription: string;
}

export interface AcademicQuizQuestion {
  id?: string;
  // B6: perguntas dissertativas ("open") com resposta modelo e
  // autoavaliação "acertei/errei" pelo aluno — não auto-corrigíveis.
  questionType?: 'multiple_choice' | 'fill_blank' | 'open';
  question: string;
  options: string[];
  correctOptionIndex: number;
  // Para 'open': resposta modelo esperada (não é opção, é referência).
  modelAnswer?: string;
  acceptableAnswers?: string[];
  explanation: string;
  category: string; // 'Identificação Estrutural' | 'Histoquímica' | 'Diagnóstico Diferencial' | 'Fisiopatologia'
  difficulty?: string; // 'Iniciação' | 'Intermédio' | 'Avançado'
  targetStructure?: string;
  pinpointCoordinate?: PinpointCoordinate;
}

export interface UserAnnotation {
  id: string;
  label: string;
  category?: string;
  notes?: string;
  color?: string;
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  width: number; // 0 - 100 percentage
  height: number; // 0 - 100 percentage
  timestamp: string;
}

export interface ComparisonDifferenceItem {
  feature: string;
  primarySampleObservation: string;
  referenceObservation: string;
  diagnosticSignificance: string;
}

export interface ComparisonResult {
  comparisonSummary: string;
  similarities: string[];
  differences: ComparisonDifferenceItem[];
  patternAnalysis: string;
  potentialAnomaliesOrVariations: string[];
  diagnosticConclusion: string;
}

export interface QuizAttempt {
  id: string;
  date: string;
  tissueName: string;
  totalQuestions: number;
  score: number;
  percentage: number;
  difficulty: string;
}

export interface UserProgress {
  totalQuizzesTaken: number;
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  averagePercentage: number;
  history: QuizAttempt[];
}

export interface HistologyAnalysis {
  tissueClassification: TissueClassification;
  stainingAnalysis: StainingAnalysis;
  cellularConstituents: CellularConstituent[];
  diagnosticCriteria: DiagnosticCriteria;
  academicQuizQuestions: AcademicQuizQuestion[];
}

export interface ReferenceTissueSlide {
  id: string;
  title: string;
  tissueFamily: TissueFamily;
  organ: string;
  staining: string;
  magnification: string;
  thumbnailSvg: string; // Rich SVG markup representing the realistic histological slide
  description: string;
  analysis: HistologyAnalysis;
}
