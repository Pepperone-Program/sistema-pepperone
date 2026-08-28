import { afterAll, describe, expect, it } from 'vitest';
import { closeDatabasePool, query } from '../../src/database/connection';

describe.skipIf(process.env.SEARCH_INTEGRATION !== 'true')('search database integration', () => {
  afterAll(closeDatabasePool);

  it('has the expected search schema and tenant-scoped public documents', async () => {
    const tables = await query(`SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('product_search_documents','search_dictionary','search_events')`) as Array<{ TABLE_NAME: string }>;
    expect(tables).toHaveLength(3);
    const leaks = await query(`SELECT COUNT(*) total FROM product_search_documents psd
      INNER JOIN produtos p ON p.id_empresa = psd.id_empresa AND p.id_produto = psd.id_produto
      WHERE psd.id_empresa <> p.id_empresa`) as Array<{ total: number }>;
    expect(Number(leaks[0].total)).toBe(0);
  });
});
