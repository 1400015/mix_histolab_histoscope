import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { resetRateLimits } from '../server/guards';

/**
 * Testes de contrato das rotas (2026-09-29).
 *
 * Cobrem o que o review apontou como não testado: as guardas de entrada e as
 * respostas de erro (400/404/429/501). Nenhum caso válido é testado aqui de
 * propósito: os caminhos felizes chamam o motor Python (numpy + OpenCV) e não
 * podem correr no CI Node. O `app` é importado diretamente, sem abrir o
 * servidor de desenvolvimento do Vite.
 */

let server: Server;
let baseUrl = '';

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const json = async (res: Response): Promise<any> => res.json();

beforeAll(async () => {
  // Sem chave Gemini os endpoints de IA caem no caminho offline/501 de forma
  // determinística, independentemente do .env do ambiente.
  delete process.env.GEMINI_API_KEY;
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  resetRateLimits();
  delete process.env.AI_RATE_LIMIT_MAX;
});

describe('cabeçalhos de segurança', () => {
  it('responde com nosniff e sem framing', async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('expõe capacidades e carga do motor', async () => {
    const body = await json(await fetch(`${baseUrl}/api/status`));
    expect(body.gemini).toBe(false);
    expect(body.engine).toEqual({ active: 0, queued: 0 });
  });
});

describe('validação de payload', () => {
  it('rejeita análise sem imagem', async () => {
    const res = await post('/api/analyze-histology', {});
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/Nenhuma imagem/);
  });

  it('rejeita imagem que não é base64', async () => {
    const res = await post('/api/analyze-histology', { imageBase64: 'isto não é uma imagem!!!' });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/base64/);
  });

  it('rejeita chat sem mensagens de texto', async () => {
    const res = await post('/api/chat', { messages: [{ role: 'user' }] });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/não têm texto/);
  });

  it('rejeita quiz offline sem análise local aproveitável', async () => {
    const res = await post('/api/generate-quiz', { analysis: { semTissue: true } });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/tissue/);
  });

  it('devolve 400 em JSON malformado', async () => {
    const res = await fetch(`${baseUrl}/api/analyze-histology`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ isto não é json }',
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/malformado/);
  });
});

describe('galeria', () => {
  it('lista as micrografias da galeria', async () => {
    const body = await json(await fetch(`${baseUrl}/api/gallery`));
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).toHaveProperty('provenance');
  });

  it('devolve 404 para lâmina desconhecida (sem tocar no motor)', async () => {
    const res = await fetch(`${baseUrl}/api/gallery/nao_existe/analysis`);
    expect(res.status).toBe(404);
    expect((await json(res)).error).toMatch(/desconhecida/);
  });
});

describe('referências à galeria na comparação offline', () => {
  it('devolve 404 quando a lâmina de referência não existe', async () => {
    const res = await post('/api/compare-local', { imageBase64: 'AAAA', galleryKey: '../../etc/passwd' });
    expect(res.status).toBe(404);
    expect((await json(res)).error).toMatch(/referência/);
  });

  it('devolve 404 numa referência gallery: forjada na amostra', async () => {
    const res = await post('/api/compare-local', {
      imageBase64: 'gallery:../../etc/passwd',
      galleryKey: 'liver',
    });
    expect(res.status).toBe(404);
    expect((await json(res)).error).toMatch(/amostra/);
  });
});

describe('endpoints Gemini sem chave', () => {
  it('compare-slides devolve 501 com a alternativa offline', async () => {
    const res = await post('/api/compare-slides', { primarySlide: { title: 'a' }, referenceSlide: { title: 'b' } });
    expect(res.status).toBe(501);
    expect((await json(res)).error).toMatch(/Comparação Offline/);
  });

  it('ask-tutor devolve 501 a apontar para /api/chat', async () => {
    const res = await post('/api/ask-tutor', { question: 'O que é isto?' });
    expect(res.status).toBe(501);
    expect((await json(res)).error).toMatch(/api\/chat/);
  });

  it('compare-slides exige as duas lâminas antes de olhar para a chave', async () => {
    const res = await post('/api/compare-slides', { primarySlide: { title: 'a' } });
    expect(res.status).toBe(400);
  });
});

describe('limite de pedidos por IP', () => {
  it('devolve 429 com Retry-After depois do máximo', async () => {
    process.env.AI_RATE_LIMIT_MAX = '2';
    resetRateLimits();

    const first = await post('/api/ask-tutor', { question: 'a' });
    const second = await post('/api/ask-tutor', { question: 'b' });
    const third = await post('/api/ask-tutor', { question: 'c' });

    expect(first.status).toBe(501);
    expect(second.status).toBe(501);
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toMatch(/^\d+$/);
    expect((await json(third)).error).toMatch(/Demasiados pedidos/);
  });

  it('não conta a janela de um endpoint no limiter de outro', async () => {
    process.env.AI_RATE_LIMIT_MAX = '1';
    resetRateLimits();

    expect((await post('/api/ask-tutor', { question: 'a' })).status).toBe(501);
    expect((await post('/api/ask-tutor', { question: 'b' })).status).toBe(429);
    // O limiter geral de /api tem orçamento próprio.
    expect((await fetch(`${baseUrl}/api/status`)).status).toBe(200);
  });
});
