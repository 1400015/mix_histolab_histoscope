// B4: repetição espaçada (SM-2 simplificado) sobre as perguntas do quiz.
// Cada pergunta é identificada pelo texto normalizado; o histórico SM-2
// persiste em localStorage e as perguntas falhadas voltam com prioridade.

export interface SRSRecord {
  easiness: number;
  intervalDays: number;
  repetitions: number;
  dueAt: number;
  misses: number;
  lastSeen: number;
}

const SRS_KEY = 'histoscope_srs';

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function questionKey(question: { question: string }): string {
  return normalizeKey(question.question);
}

export function getSRSMap(): Record<string, SRSRecord> {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SRSRecord>) : {};
  } catch {
    return {};
  }
}

function saveSRSMap(map: Record<string, SRSRecord>): void {
  try {
    localStorage.setItem(SRS_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Erro ao guardar o histórico de repetição espaçada:', e);
  }
}

// SM-2 simplificado: qualidade 5 (acerto) ou 2 (erro).
// Intervalos: erro → 0 dias (revisão imediata); acertos consecutivos
// → 1 → 6 → intervalo_anterior × fator de facilidade.
export function recordSRSAnswer(key: string, correct: boolean): SRSRecord {
  const map = getSRSMap();
  const prev: SRSRecord = map[key] ?? {
    easiness: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: 0,
    misses: 0,
    lastSeen: 0,
  };
  const q = correct ? 5 : 2;
  const easiness = Math.max(
    1.3,
    prev.easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );
  let intervalDays: number;
  if (!correct) {
    intervalDays = 0;
  } else if (prev.repetitions === 0) {
    intervalDays = 1;
  } else if (prev.repetitions === 1) {
    intervalDays = 6;
  } else {
    intervalDays = Math.round(prev.intervalDays * easiness);
  }
  const record: SRSRecord = {
    easiness,
    intervalDays,
    repetitions: correct ? prev.repetitions + 1 : 0,
    dueAt: Date.now() + intervalDays * 24 * 60 * 60 * 1000,
    misses: prev.misses + (correct ? 0 : 1),
    lastSeen: Date.now(),
  };
  map[key] = record;
  saveSRSMap(map);
  return record;
}

// Prioridade de estudo: perguntas vencidas (dueAt no passado) primeiro,
// depois as que têm falhas acumuladas, depois as nunca vistas.
function srsPriority(record: SRSRecord | undefined): number {
  if (!record) return 50;
  const now = Date.now();
  if (record.dueAt <= now) return record.misses > 0 ? 0 : 20;
  return 50 + Math.min(record.misses, 5) * -1 + Math.min((record.dueAt - now) / (24 * 60 * 60 * 1000), 30);
}

export function isDueForReview(record: SRSRecord | undefined): boolean {
  if (!record) return false;
  return record.misses > 0 || record.dueAt <= Date.now();
}

// Reordena as perguntas de uma sessão: as falhadas/vencidas primeiro.
export function prioritizeQuestions<T extends { question: string }>(questions: T[]): T[] {
  const map = getSRSMap();
  return [...questions].sort((a, b) => {
    const pa = srsPriority(map[questionKey(a)]);
    const pb = srsPriority(map[questionKey(b)]);
    return pa - pb;
  });
}
