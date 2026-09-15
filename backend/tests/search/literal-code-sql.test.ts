import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../src/database/connection', () => ({ query: vi.fn() }));
import { query } from '../../src/database/connection';
import { ProdutoModel } from '../../src/models/Produto';

beforeEach(() => vi.resetAllMocks());

it.each([
  ['CM', '%CM%'], ['pEp', '%pEp%'], ['A%B_C!D', '%A!%B!_C!!D%'],
  ['A\\B/C', '%A\\B/C%'],
])('treats %s literally and scopes count and page to public tenant products', async (term, pattern) => {
  vi.mocked(query).mockResolvedValueOnce([{ total: '3500' }]).mockResolvedValueOnce([]);
  const result = await ProdutoModel.searchByCodigoLikeForSite(7, term, 102, 10);
  expect(result.total).toBe(3500);
  const calls = vi.mocked(query).mock.calls;
  for (const [sql, values] of calls) {
    expect(sql).toContain('id_empresa = ?');
    expect(sql).toContain("site = 'S'");
    expect(sql).toContain("habilitado = 'S'");
    expect(sql).toContain("LOWER(codigo) LIKE LOWER(?) ESCAPE '!'");
    expect(values?.slice(0, 2)).toEqual([7, pattern]);
  }
  expect(calls[1][0]).toContain('ORDER BY codigo ASC, id_produto ASC');
  expect(calls[1][1]).toEqual([7, pattern, 10, 1010]);
});

it('uses full equality for exact codes without inserting a prefix', async () => {
  vi.mocked(query).mockResolvedValueOnce([]);
  await ProdutoModel.searchByCodigoForSite(1, 'pepket1001');
  expect(vi.mocked(query).mock.calls[0][0]).toContain('LOWER(codigo) = LOWER(?)');
  expect(vi.mocked(query).mock.calls[0][1]).toEqual([1, 'pepket1001']);
});

it('treats the complete product-name phrase literally and scopes it to public tenant products', async () => {
  vi.mocked(query).mockResolvedValueOnce([{ total: '1' }]).mockResolvedValueOnce([]);

  const result = await ProdutoModel.searchForSite(7, ' Garrafa 100%_! Metal ', 3, 10);

  expect(result.total).toBe(1);
  const calls = vi.mocked(query).mock.calls;
  for (const [sql, values] of calls) {
    expect(sql).toContain('id_empresa = ?');
    expect(sql).toContain("site = 'S'");
    expect(sql).toContain("habilitado = 'S'");
    expect(sql).toContain("produto LIKE ? ESCAPE '!'");
    expect(values?.slice(0, 2)).toEqual([7, '%Garrafa 100!%!_!! Metal%']);
  }
  expect(calls[1][1]).toEqual([7, '%Garrafa 100!%!_!! Metal%', 'Garrafa 100%_! Metal', 'Garrafa 100!%!_!! Metal%', 10, 20]);
});
