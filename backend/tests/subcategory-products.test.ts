import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/database/connection', () => ({ getConnection: vi.fn(), query: vi.fn() }));
vi.mock('../src/models/Categoria', () => ({ SubcategoriaModel: { findById: vi.fn() } }));
vi.mock('../src/models/Produto', () => ({ ProdutoModel: { findAll: vi.fn() } }));

import { getConnection, query } from '../src/database/connection';
import { SubcategoriaModel } from '../src/models/Categoria';
import { SubcategoryProductsService } from '../src/services/SubcategoryProductsService';
import { adminProductSearch } from '../src/models/adminProductSearch';

const connection = {
  beginTransaction: vi.fn(), execute: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConnection).mockResolvedValue(connection as any);
  vi.mocked(SubcategoriaModel.findById).mockResolvedValue({ id_subcategoria: 9 } as any);
  connection.execute.mockImplementation(async (sql: string, values: number[]) => {
    if (sql.startsWith('SELECT TABLE_NAME')) return [[...Array(3)].map(() => ({ ENGINE: 'InnoDB' }))];
    expect(values[0]).toBe(7);
    if (sql.startsWith('SELECT id_subcategoria')) return [[{ id_subcategoria: 9 }]];
    if (sql.startsWith('SELECT id_produto FROM produtos')) return [values.slice(1).map((id) => ({ id_produto: id }))];
    if (sql.startsWith('SELECT id_produto FROM aux_subcategorias_produtos')) return [[{ id_produto: 3 }]];
    return [{ affectedRows: 1 }];
  });
});

describe('transactional subcategory assignment', () => {
  it('adds only missing links and preserves existing category and subcategory links', async () => {
    expect(await SubcategoryProductsService.assign(7, 9, [3, 2, 1, 1])).toEqual({ processed: 3, changed: 2 });
    const insert = connection.execute.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO aux_subcategorias_produtos'));
    expect(insert?.[1]).toEqual([7, 9, 1, 7, 9, 2]);
    expect(connection.execute.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it('is idempotent when every selected product is already linked', async () => {
    expect(await SubcategoryProductsService.assign(7, 9, [3, 3])).toEqual({ processed: 1, changed: 0 });
    expect(connection.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO aux_subcategorias_produtos'))).toBe(false);
  });

  it('rejects a missing or foreign product before any insertion', async () => {
    const original = connection.execute.getMockImplementation()!;
    connection.execute.mockImplementation(async (sql, values) => {
      if (sql.startsWith('SELECT id_produto FROM produtos') && values.includes(501)) return [[]];
      return original(sql, values);
    });
    await expect(SubcategoryProductsService.assign(7, 9, [1, 501])).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    expect(connection.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('rolls back when the insertion fails', async () => {
    const original = connection.execute.getMockImplementation()!;
    connection.execute.mockImplementation(async (sql, values) => {
      if (sql.startsWith('INSERT')) throw new Error('write failed');
      return original(sql, values);
    });
    await expect(SubcategoryProductsService.assign(7, 9, [1])).rejects.toThrow('write failed');
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('refuses nontransactional tables before beginning a transaction', async () => {
    connection.execute.mockResolvedValue([[{ ENGINE: 'MyISAM' }]]);
    await expect(SubcategoryProductsService.assign(7, 9, [1])).rejects.toMatchObject({ code: 'CATEGORY_TRANSACTION_UNAVAILABLE' });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
  });

  it('snapshots all matching products with the shared name search and escaped wildcards', async () => {
    vi.mocked(query).mockResolvedValue(Array.from({ length: 120 }, (_, index) => ({ id_produto: index + 1 })) as any);
    const result = await SubcategoryProductsService.available(7, 9, 'caderno', 1, true);
    expect(result.produto_ids).toHaveLength(120);
    expect(query).toHaveBeenCalledWith(expect.stringContaining(adminProductSearch('caderno').sql), [7, '%caderno%', '%caderno%', 50001]);
    expect(adminProductSearch('100%_').values).toEqual(['%100!%!_%', '%100!%!_%']);
  });
});
