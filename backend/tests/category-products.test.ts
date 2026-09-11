import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/database/connection', () => ({ getConnection: vi.fn(), query: vi.fn() }));
vi.mock('../src/models/Categoria', () => ({ CategoriaModel: { findById: vi.fn() } }));
vi.mock('../src/models/Produto', () => ({ ProdutoModel: { findAll: vi.fn() } }));
import { getConnection, query } from '../src/database/connection';
import { CategoriaModel } from '../src/models/Categoria';
import { CategoryProductsService } from '../src/services/CategoryProductsService';
import { adminProductSearch } from '../src/models/adminProductSearch';

const connection = { beginTransaction: vi.fn(), execute: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConnection).mockResolvedValue(connection as any);
  vi.mocked(CategoriaModel.findById).mockResolvedValue({ id_categoria: 8 } as any);
  connection.execute.mockImplementation(async (sql: string, values: number[]) => {
    if (sql.startsWith('SELECT TABLE_NAME')) return [[...Array(5)].map(() => ({ ENGINE: 'InnoDB' }))];
    expect(values[0]).toBe(7);
    if (sql.startsWith('SELECT id_categoria')) return [[{ id_categoria: 8 }]];
    if (sql.startsWith('SELECT id_produto FROM produtos')) return [values.slice(1).map((id) => ({ id_produto: id }))];
    if (sql.startsWith('SELECT id_produto, id_categoria')) return [[{ id_produto: 2, id_categoria: 3 }, { id_produto: 3, id_categoria: 8 }]];
    if (sql.startsWith('SELECT DISTINCT asp')) return [values.includes(2) ? [{ id_produto: 2 }] : []];
    return [{ affectedRows: 1 }];
  });
});

describe('transactional category assignment', () => {
  it('assigns uncategorized products, replaces previous links, and preserves correct links', async () => {
    expect(await CategoryProductsService.assign(7, 8, [3, 2, 1, 1])).toEqual({ processed: 3, changed: 2 });
    const insert = connection.execute.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO aux_categorias'));
    expect(insert?.[1]).toEqual([7, 8, 1, 7, 8, 2]);
    const lock = connection.execute.mock.calls.find(([sql]) => sql.startsWith('SELECT id_produto FROM produtos'));
    expect(lock?.[1]).toEqual([7, 1, 2, 3]);
    expect(lock?.[0]).toContain('ORDER BY id_produto FOR UPDATE');
    const cleanup = connection.execute.mock.calls.find(([sql]) => sql.startsWith('DELETE asp'));
    expect(cleanup?.[0]).toContain('s.id_empresa = asp.id_empresa');
    expect(cleanup?.[0]).toContain('s.id_categoria <> ?');
    expect(cleanup?.[1]).toEqual([7, 1, 2, 3, 8]);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it('rejects foreign or missing IDs before any mutation, including a later chunk', async () => {
    const original = connection.execute.getMockImplementation()!;
    connection.execute.mockImplementation(async (sql, values) => {
      if (sql.startsWith('SELECT id_produto FROM produtos') && values.includes(501)) return [[]];
      return original(sql, values);
    });
    await expect(CategoryProductsService.assign(7, 8, Array.from({ length: 501 }, (_, i) => i + 1))).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    expect(connection.execute.mock.calls.some(([sql]) => /^(INSERT|DELETE|UPDATE)/.test(sql))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('is idempotent for a product already assigned only to the target category', async () => {
    expect(await CategoryProductsService.assign(7, 8, [3, 3])).toEqual({ processed: 1, changed: 0 });
    expect(connection.execute.mock.calls.some(([sql]) => /^(INSERT INTO|DELETE FROM) aux_categorias/.test(sql))).toBe(false);
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it('rolls back all changes when an insert fails', async () => {
    const original = connection.execute.getMockImplementation()!;
    connection.execute.mockImplementation(async (sql, values) => {
      if (sql.startsWith('INSERT')) throw new Error('write failed');
      return original(sql, values);
    });
    await expect(CategoryProductsService.assign(7, 8, [1, 2])).rejects.toThrow('write failed');
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it('rejects invalid input before opening a transaction', async () => {
    await expect(CategoryProductsService.assign(7, 8, [])).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    await expect(CategoryProductsService.assign(7, 8, [NaN])).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    expect(getConnection).not.toHaveBeenCalled();
  });

  it('refuses nontransactional tables before changing any data', async () => {
    connection.execute.mockResolvedValue([[{ ENGINE: 'MyISAM' }]]);
    await expect(CategoryProductsService.assign(7, 8, [1])).rejects.toMatchObject({ code: 'CATEGORY_TRANSACTION_UNAVAILABLE' });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it('select-all snapshots the entire matching set with the same search criteria', async () => {
    vi.mocked(query).mockResolvedValue(Array.from({ length: 120 }, (_, i) => ({ id_produto: i + 1 })));
    const result = await CategoryProductsService.available(7, 8, 'caderno', 1, true);
    expect(result.produto_ids).toHaveLength(120);
    expect(query).toHaveBeenCalledWith(expect.stringContaining(adminProductSearch('caderno').sql), [7, '%caderno%', '%caderno%', 50001]);
    expect(adminProductSearch('12').values).toEqual([12, '%12%', '%12%']);
    expect(adminProductSearch('100%_').values).toEqual(['%100!%!_%', '%100!%!_%']);
  });
});
