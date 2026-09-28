import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, getConnectionMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getConnectionMock: vi.fn(),
}));

vi.mock('@/database/connection', () => ({
  query: queryMock,
  getConnection: getConnectionMock,
}));

import { OrcamentoModel } from '@/models/Orcamento';

const quote = {
  data_orcamento: '2026-09-28',
  endereco: 'Rua A',
  email: 'cliente@example.com',
  contato: 'Maria',
};

const createConnection = (existingId?: number) => {
  const execute = vi.fn(async (sql: string) => {
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
    if (sql.includes('SELECT i.id_orcamento')) {
      return [existingId ? [{ id_orcamento: existingId }] : []];
    }
    if (sql.includes('INSERT INTO orcamentos (')) return [{ insertId: 321 }];
    return [{}];
  });

  return {
    execute,
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
  };
};

describe('OrcamentoModel.createIdempotent', () => {
  beforeEach(() => {
    queryMock.mockResolvedValue([]);
    getConnectionMock.mockReset();
  });

  it('commits the quote and its idempotency identity in the same transaction', async () => {
    const connection = createConnection();
    getConnectionMock.mockResolvedValue(connection);

    await expect(
      OrcamentoModel.createIdempotent(1, quote, 'a'.repeat(64), 86400)
    ).resolves.toEqual({ id: 321, created: true });

    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.execute.mock.calls.some(([sql]) =>
      String(sql).includes('INSERT INTO orcamentos_idempotencia')
    )).toBe(true);
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it('returns the original quote without inserting on a repeated identity', async () => {
    const connection = createConnection(777);
    getConnectionMock.mockResolvedValue(connection);

    await expect(
      OrcamentoModel.createIdempotent(1, quote, 'b'.repeat(64), 86400)
    ).resolves.toEqual({ id: 777, created: false });

    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.execute.mock.calls.some(([sql]) =>
      String(sql).includes('INSERT INTO orcamentos (')
    )).toBe(false);
  });

  it('rolls back and releases the connection after a transactional failure', async () => {
    const connection = createConnection();
    connection.execute.mockImplementation(async (sql: string) => {
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (sql.includes('SELECT i.id_orcamento')) return [[]];
      if (sql.includes('INSERT INTO orcamentos (')) throw new Error('insert failed');
      return [{}];
    });
    getConnectionMock.mockResolvedValue(connection);

    await expect(
      OrcamentoModel.createIdempotent(1, quote, 'c'.repeat(64), 86400)
    ).rejects.toThrow('insert failed');

    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
