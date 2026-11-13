import { query } from '@database/connection';
import { adminProductExclusion, adminProductSearch } from '@models/adminProductSearch';

type Association = 'category' | 'subcategory';

export async function associationProductsList(
  empresaId: number,
  associationId: number,
  association: Association,
  search: string,
  exclude: string,
  page: number,
  limit: number,
) {
  const table = association === 'category' ? 'aux_categorias_produtos' : 'aux_subcategorias_produtos';
  const idColumn = association === 'category' ? 'id_categoria' : 'id_subcategoria';
  const searchFilter = adminProductSearch(search);
  const exclusionFilter = adminProductExclusion(exclude);
  const where = `FROM produtos WHERE id_empresa = ?${searchFilter.sql}${exclusionFilter.sql}`;
  const values = [empresaId, ...searchFilter.values, ...exclusionFilter.values];
  const linked = `EXISTS (SELECT 1 FROM ${table} link
    WHERE link.id_empresa = produtos.id_empresa AND link.id_produto = produtos.id_produto
      AND link.${idColumn} = ?)`;
  const [counts, items, links] = await Promise.all([
    query(`SELECT COUNT(*) AS total ${where}`, values) as Promise<Array<{ total: number }>>,
    query(`SELECT id_produto, produto, codigo ${where}
      ORDER BY ${linked} DESC, data_inclusao DESC, id_produto DESC LIMIT ? OFFSET ?`,
      [...values, associationId, limit, (page - 1) * limit]) as Promise<Array<{ id_produto: number; produto: string; codigo: string }>>,
    query(`SELECT id_produto FROM ${table} WHERE id_empresa = ? AND ${idColumn} = ?`,
      [empresaId, associationId]) as Promise<Array<{ id_produto: number }>>,
  ]);
  const total = Number(counts[0].total);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit), linked_ids: links.map((row) => Number(row.id_produto)) };
}
