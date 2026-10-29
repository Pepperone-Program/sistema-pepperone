import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/database/connection', () => ({ query: vi.fn() }));
import { query } from '../src/database/connection';
import dashboard from '../src/routes/dashboard';
import landingPages from '../src/routes/landing-pages';
import categorias from '../src/routes/categorias';
import { authIfPresentMiddleware, authMiddleware } from '../src/middleware/auth';
import { ProdutoModel } from '../src/models/Produto';

function response() {
  const res: any = { statusCode: 200, body: null };
  res.status = vi.fn((status: number) => { res.statusCode = status; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

function handler(router: any, path: string, method: string) {
  return router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
}

beforeEach(() => vi.clearAllMocks());

describe('dashboard', () => {
  it('scopes category counts to the authenticated company and fills missing days', async () => {
    vi.mocked(query).mockImplementation(async (sql: string, args?: unknown[]) => {
      if (sql.includes('CURDATE() AS')) return [{ today: '2026-03-01' }];
      if (sql.includes("DATE_FORMAT(CURDATE()")) return [{ today: '2026-03-01' }];
      if (sql.includes('DATE_FORMAT(data_orcamento')) {
        expect(args).toEqual([7, '2026-01-31', '2026-03-02']);
        return [{ dia: '2026-02-28', total: 2 }];
      }
      if (sql.includes('AS banners_ativos')) {
        expect(args).toEqual([7, 7, 7, 7]);
        return [{ produtos: 4, categorias: 2, orcamentos: 3, banners_ativos: 1 }];
      }
      expect(args).toEqual([7]);
      return [{ id_categoria: 1, categoria: 'A', total: 1 }];
    });
    const res = response();
    await handler(dashboard, '/', 'get')({ user: { id_empresa: 7 }, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.orcamentos_dia).toHaveLength(30);
    expect(res.body.data.indicadores).toEqual({ produtos: 4, categorias: 2, orcamentos: 3, banners_ativos: 1 });
    expect(res.body.data.orcamentos_dia.at(-2)).toEqual({ dia: '2026-02-28', total: 2 });
    expect(res.body.data.orcamentos_dia.at(-1)).toEqual({ dia: '2026-03-01', total: 0 });
    const sql = vi.mocked(query).mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('COUNT(DISTINCT o.id_orcamento)');
    expect(sql).toContain('COUNT(DISTINCT p.id_produto)');
    expect(sql).toContain('aux_subcategorias_produtos');
    expect(sql).toContain('s.id_empresa = asp.id_empresa');
  });

  it('rejects periods larger than 366 days', async () => {
    vi.mocked(query).mockResolvedValue([{ today: '2026-03-01' }] as any);
    const res = response();
    await handler(dashboard, '/', 'get')({ user: { id_empresa: 7 }, query: { start: '2020-01-01', end: '2026-03-01' } }, res);
    expect(res.statusCode).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('landing pages', () => {
  it('rejects unsafe URLs before writing', async () => {
    const res = response();
    await handler(landingPages, '/', 'post')({ user: { id_empresa: 7 }, body: { titulo: 'Teste', url: 'javascript:alert(1)' } }, res);
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('restricts edits to the authenticated company', async () => {
    vi.mocked(query).mockResolvedValue({ affectedRows: 0 } as any);
    const res = response();
    await handler(landingPages, '/:id', 'put')({ user: { id_empresa: 7 }, params: { id: '9' }, body: { titulo: 'Teste', url: 'https://example.com' } }, res);
    expect(res.statusCode).toBe(404);
    expect(vi.mocked(query).mock.calls[0][1]?.slice(-2)).toEqual([7, 9]);
  });
});

describe('category covers', () => {
  it('requires authentication before accepting an upload', () => {
    const route = (categorias as any).stack.find((layer: any) => layer.route?.path === '/:id/capa').route;
    expect(route.stack[0].handle).toBe(authMiddleware);
    const res = response();
    const next = vi.fn();
    route.stack[0].handle({ headers: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optional public authentication', () => {
  it('allows anonymous reads but rejects an invalid supplied token', () => {
    const anonymousNext = vi.fn();
    authIfPresentMiddleware({ headers: {} } as any, response(), anonymousNext);
    expect(anonymousNext).toHaveBeenCalledOnce();
    const res = response();
    const invalidNext = vi.fn();
    authIfPresentMiddleware({ headers: { authorization: 'Bearer invalid' } } as any, res, invalidNext);
    expect(res.statusCode).toBe(401);
    expect(invalidNext).not.toHaveBeenCalled();
  });
});

describe('product links', () => {
  it('scopes category and subcategory links to the product company', async () => {
    vi.mocked(query).mockResolvedValue([] as any);
    await ProdutoModel.findProductLinks(7, 15);
    const calls = vi.mocked(query).mock.calls;
    expect(calls[0][0]).toContain('acp.id_empresa = ?');
    expect(calls[0][1]).toEqual([7, 15]);
    expect(calls[1][0]).toContain('asp.id_empresa = ?');
    expect(calls[1][1]).toEqual([7, 15]);
  });
});
