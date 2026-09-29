/**
 * Validação de payloads dos endpoints (2026-09-29).
 *
 * Antes, `req.body.imageBase64` ia direto para o Gemini e para o disco
 * (`localAnalyzeBase64` escreve um ficheiro temporário): um valor não-string
 * rebentava no Buffer.from com um 500 opaco, e uma string enorme era gravada
 * antes de qualquer verificação. Estas guardas falham cedo, com 400 e uma
 * mensagem que a UI consegue mostrar.
 */

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const DATA_URL_PREFIX = /^data:image\/[a-z0-9.+-]+;base64,/i;
const BASE64_BODY = /^[A-Za-z0-9+/]+={0,2}$/;
const GALLERY_REF = 'gallery:';
// Caminho público das micrografias: é isto que a UI deixa em `slideImageSrc`
// quando a lâmina ativa veio da galeria.
const GALLERY_IMAGE_PATH = /^\/gallery-images\/([A-Za-z0-9_-]+)\.jpg$/;

/** Teto da imagem descodificada (o corpo JSON tem o seu próprio limite). */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export interface ImageOptions {
  field?: string;
  /** Aceita a referência `gallery:<key>` usada pela comparação offline. */
  allowGalleryRef?: boolean;
}

/**
 * Normaliza um campo de imagem: aceita data URL ou base64 puro, devolve o
 * base64 já limpo (sem prefixo nem espaços) ou um erro legível.
 */
export function validateImageBase64(value: unknown, opts: ImageOptions = {}): Validated<string> {
  const field = opts.field ?? 'imageBase64';

  if (opts.allowGalleryRef && typeof value === 'string' && value.startsWith(GALLERY_REF)) {
    const key = value.slice(GALLERY_REF.length).trim();
    if (!key) return { ok: false, error: `O campo ${field} tem uma referência de galeria vazia.` };
    return { ok: true, value: `${GALLERY_REF}${key}` };
  }

  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: `Nenhuma imagem foi fornecida no campo ${field}.` };
  }

  const data = value.replace(DATA_URL_PREFIX, '').replace(/\s+/g, '');
  if (!data) {
    return { ok: false, error: `O campo ${field} não contém dados de imagem.` };
  }

  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Imagem demasiado grande (${mb(bytes)} MB); o limite é ${mb(MAX_IMAGE_BYTES)} MB.`,
    };
  }

  if (!BASE64_BODY.test(data)) {
    return { ok: false, error: `O campo ${field} não é base64 válido — envia uma imagem PNG ou JPEG.` };
  }

  return { ok: true, value: data };
}

/**
 * Normaliza o campo de imagem que os endpoints recebem. Além de data URL e
 * base64 puro, aceita as referências à galeria (`gallery:<key>` e
 * `/gallery-images/<key>.jpg`) — antes, o quiz e o tutor enviavam o caminho da
 * lâmina da galeria como se fosse base64 e o Gemini recebia lixo.
 */
export function validateIncomingImage(value: unknown, opts: ImageOptions = {}): Validated<string> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith(GALLERY_REF)) {
      const key = trimmed.slice(GALLERY_REF.length).trim();
      if (!key) return { ok: false, error: `O campo ${opts.field ?? 'imageBase64'} tem uma referência de galeria vazia.` };
      return { ok: true, value: `${GALLERY_REF}${key}` };
    }
    const pathMatch = GALLERY_IMAGE_PATH.exec(trimmed);
    if (pathMatch) return { ok: true, value: `${GALLERY_REF}${pathMatch[1]}` };
  }
  return validateImageBase64(value, opts);
}

/** String opcional com teto de tamanho (evita prompts/descrições sem limite). */
export function readOptionalString(value: unknown, maxLength = 2_000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/** Número opcional dentro de um intervalo (ex.: count de perguntas). */
export function readOptionalInt(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export interface ChatTurn {
  role?: string;
  text?: string;
  content?: string;
}

/** Valida o array `messages` do /api/chat (antes só se verificava o comprimento). */
export function validateChatMessages(value: unknown): Validated<ChatTurn[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: 'Nenhuma mensagem foi fornecida.' };
  }
  const turns: ChatTurn[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const turn = raw as Record<string, unknown>;
    const text = readOptionalString(turn.text ?? turn.content, 8_000);
    if (!text) continue;
    turns.push({ role: typeof turn.role === 'string' ? turn.role : undefined, text });
  }
  if (!turns.length) {
    return { ok: false, error: 'As mensagens enviadas não têm texto.' };
  }
  return { ok: true, value: turns.slice(-40) };
}

/** A análise local crua que o quiz offline precisa (tem de trazer `tissue`). */
export function validateLocalAnalysis(value: unknown): Validated<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Análise local ausente ou inválida no campo "analysis".' };
  }
  const analysis = value as Record<string, unknown>;
  if (typeof analysis.tissue !== 'string' || !analysis.tissue) {
    return { ok: false, error: 'A análise local não traz o campo "tissue" — corre primeiro a análise da lâmina.' };
  }
  return { ok: true, value: analysis };
}
