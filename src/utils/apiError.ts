/**
 * Erros da API traduzidos para linguagem de utilizador (2026-09-29).
 *
 * O servidor passou a diferenciar 413 (imagem grande), 429 (rate limit),
 * 501 (falta GEMINI_API_KEY) e 503 (fila do motor cheia). Sem isto, cada
 * componente mostrava `HTTP 501` ou uma mensagem genérica e a razão real
 * perdia-se.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const STATUS_HINTS: Record<number, string> = {
  413: 'Imagem demasiado grande para o servidor. Reduz a resolução e tenta novamente.',
  429: 'Demasiados pedidos seguidos. Aguarda alguns segundos e tenta novamente.',
  501: 'Esta funcionalidade precisa do GEMINI_API_KEY no servidor. Usa a alternativa offline indicada.',
  503: 'O motor local está ocupado com outras lâminas. Tenta novamente dentro de instantes.',
};

/** Lê o corpo do erro (se houver) e devolve sempre um `ApiError` legível. */
export async function readApiError(response: Response, fallback: string): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; details?: string }
    | null;
  const detail = response.status >= 500 ? body?.details : undefined;
  const message = body?.error || detail || STATUS_HINTS[response.status] || fallback;
  return new ApiError(response.status, message);
}

/** Mensagem legível para qualquer erro de fetch (timeout incluído). */
export function describeError(err: unknown, fallback = 'Erro inesperado.'): string {
  if (err instanceof ApiError) return err.message;
  const named = err as { name?: string; message?: string } | null;
  if (named?.name === 'TimeoutError' || named?.name === 'AbortError') {
    return 'O pedido excedeu o tempo limite. Tenta novamente.';
  }
  return named?.message || fallback;
}
