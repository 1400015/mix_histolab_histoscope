import type { NextFunction, Request, Response } from 'express';

/**
 * Endurecimento do servidor (2026-09-29).
 *
 * Três problemas reais que isto resolve, sem somar dependências a um servidor
 * que corre em contentor mínimo:
 *  - os endpoints que gastam quota Gemini estavam abertos a qualquer visitante;
 *  - `express.json({ limit: '40mb' })` deixava dois pedidos simultâneos
 *    ocuparem centenas de MB de heap só a parsear base64;
 *  - cada pedido fazia spawn de um processo Python sem teto — 10 pedidos em
 *    paralelo = 10 pipelines OpenCV a competir pelos mesmos cores.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Limite do corpo JSON: 20 MB chegam para uma micrografia em base64. */
export const JSON_BODY_LIMIT = `${envInt('MAX_JSON_BODY_MB', 20)}mb`;

/* ------------------------------------------------------------------ *
 * Cabeçalhos de segurança
 * ------------------------------------------------------------------ */

const isProduction = () => process.env.NODE_ENV === 'production';

// A CSP só é enviada em produção: em dev o Vite injeta scripts inline e usa
// WebSocket para o HMR, e uma CSP estrita partiria o servidor de desenvolvimento.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self' data:",
  "connect-src 'self'",
].join('; ');

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction() && process.env.DISABLE_CSP !== '1') {
    res.setHeader('Content-Security-Policy', CSP);
  }
  next();
}

/* ------------------------------------------------------------------ *
 * Limite de pedidos por IP
 * ------------------------------------------------------------------ */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastPrune = 0;

function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'desconhecido';
}

function pruneBuckets(now: number): void {
  if (buckets.size < 1000 || now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Prefixo da chave — separa as janelas de endpoints diferentes. */
  name: string;
  max?: number;
  windowMs?: number;
  /** Variável de ambiente com o máximo (lida a cada pedido). */
  maxEnv?: string;
  defaultMax?: number;
}

/**
 * Janela fixa por IP. Os limites leem-se do ambiente a cada pedido (e não no
 * arranque), para poderem ser apertados em produção sem rebuild e reduzidos
 * nos testes.
 */
export function rateLimit({ name, max, windowMs, maxEnv, defaultMax }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const limit = max ?? envInt(maxEnv ?? 'RATE_LIMIT_MAX', defaultMax ?? 60);
    const window = windowMs ?? envInt('RATE_LIMIT_WINDOW_MS', 60_000);
    if (limit <= 0) return next();

    const now = Date.now();
    pruneBuckets(now);

    const key = `${name}:${clientIp(req)}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + window });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: `Demasiados pedidos em pouco tempo. Tenta novamente dentro de ${retryAfterSeconds} s.`,
        retryAfterSeconds,
      });
      return;
    }
    return next();
  };
}

/** Limiter dos endpoints que gastam quota Gemini (mais apertado: 12/min). */
export const aiRateLimit = () =>
  rateLimit({ name: 'ai', maxEnv: 'AI_RATE_LIMIT_MAX', defaultMax: 12 });

/** Limiter geral de /api (protege também o motor local). */
export const apiRateLimit = () => rateLimit({ name: 'api' });

/** Só para testes: limpa as janelas acumuladas. */
export function resetRateLimits(): void {
  buckets.clear();
}

/* ------------------------------------------------------------------ *
 * Fila do motor local (Python/OpenCV)
 * ------------------------------------------------------------------ */

let engineActive = 0;
const engineWaiters: Array<() => void> = [];

/** Erro 503 devolvido quando a fila do motor está cheia. */
export class EngineBusyError extends Error {
  readonly statusCode = 503;

  constructor(message = 'O motor local está a processar outras lâminas. Tenta novamente dentro de instantes.') {
    super(message);
    this.name = 'EngineBusyError';
  }
}

/**
 * Corre uma tarefa do motor respeitando ENGINE_MAX_CONCURRENCY (por defeito 2)
 * e recusando com 503 quando já há ENGINE_MAX_QUEUE (8) à espera.
 */
export async function runEngineTask<T>(task: () => Promise<T>): Promise<T> {
  const max = Math.max(1, envInt('ENGINE_MAX_CONCURRENCY', 2));
  const maxQueue = envInt('ENGINE_MAX_QUEUE', 8);

  if (engineActive >= max) {
    if (engineWaiters.length >= maxQueue) throw new EngineBusyError();
    await new Promise<void>((resolve) => engineWaiters.push(resolve));
  }

  engineActive += 1;
  try {
    return await task();
  } finally {
    engineActive -= 1;
    const nextWaiter = engineWaiters.shift();
    if (nextWaiter) nextWaiter();
  }
}

/** Estado da fila — exposto em /api/status para diagnóstico. */
export function engineLoad(): { active: number; queued: number } {
  return { active: engineActive, queued: engineWaiters.length };
}
