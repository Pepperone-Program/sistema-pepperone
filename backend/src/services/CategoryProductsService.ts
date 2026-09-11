import { getConnection, query } from '@database/connection';
import { CategoriaModel } from '@models/Categoria';
import { ProdutoModel } from '@models/Produto';
import { adminProductSearch } from '@models/adminProductSearch';
import { throwError } from '@utils/helpers';

export const CATEGORY_SELECTION_LIMIT = 50_000;

export class CategoryProductsService {
  static async available(empresaId: number, categoriaId: number, search: string, page: number, idsOnly: boolean) {
    if (!Number.isSafeInteger(categoriaId) || categoriaId <= 0 || !await CategoriaModel.findById(empresaId, categoriaId)) {
      throwError('CATEGORIA_NOT_FOUND', 'Categoria nao encontrada', 404);
    }
    if (search.length > 200) throwError('INVALID_SEARCH', 'Informe ate 200 caracteres', 400);
    if (idsOnly) {
      const filter = adminProductSearch(search);
      const rows = await query(`SELECT id_produto FROM produtos WHERE id_empresa = ?${filter.sql}
        ORDER BY id_produto LIMIT ?`, [empresaId, ...filter.values, CATEGORY_SELECTION_LIMIT + 1]) as Array<{ id_produto: number }>;
      if (rows.length > CATEGORY_SELECTION_LIMIT) throwError('SELECTION_TOO_LARGE', 'Refine o filtro para selecionar ate 50000 produtos', 422);
      return { produto_ids: rows.map((row) => Number(row.id_produto)) };
    }
    const limit = 30;
    const [products, links] = await Promise.all([
      ProdutoModel.findAll(empresaId, page, limit, search),
      query('SELECT id_produto FROM aux_categorias_produtos WHERE id_empresa = ? AND id_categoria = ?', [empresaId, categoriaId]) as Promise<Array<{ id_produto: number }>>,
    ]);
    return { ...products, page, limit, totalPages: Math.ceil(products.total / limit), linked_ids: links.map((row) => Number(row.id_produto)) };
  }

  static async assign(empresaId: number, categoriaId: number, requestedIds: number[]) {
    if (!Number.isSafeInteger(categoriaId) || categoriaId <= 0) throwError('INVALID_CATEGORY', 'Categoria invalida', 400);
    if (!Array.isArray(requestedIds) || !requestedIds.length || requestedIds.length > CATEGORY_SELECTION_LIMIT
      || requestedIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throwError('INVALID_SELECTION', 'Selecione de 1 a 50000 produtos validos', 400);
    }
    const ids = [...new Set(requestedIds)].sort((a, b) => a - b);
    const connection = await getConnection();
    let transactionStarted = false;
    try {
      const [engines] = await connection.execute(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('produtos','categorias','aux_categorias_produtos','subcategorias','aux_subcategorias_produtos')`);
      const tables = engines as Array<{ TABLE_NAME: string; ENGINE: string }>;
      if (tables.length !== 5 || tables.some((table) => table.ENGINE?.toUpperCase() !== 'INNODB')) {
        throwError('CATEGORY_TRANSACTION_UNAVAILABLE', 'A atribuicao em lote ainda nao esta disponivel. A estrutura transacional do banco precisa ser atualizada.', 409);
      }
      await connection.beginTransaction();
      transactionStarted = true;
      const [categories] = await connection.execute('SELECT id_categoria FROM categorias WHERE id_empresa = ? AND id_categoria = ? LOCK IN SHARE MODE', [empresaId, categoriaId]);
      if (!(categories as unknown[]).length) throwError('CATEGORIA_NOT_FOUND', 'Categoria nao encontrada', 404);
      // Lock and validate the entire selection before any write. Ascending IDs serialize overlapping batches.
      const chunks: number[][] = [];
      for (let start = 0; start < ids.length; start += 500) {
        const chunk = ids.slice(start, start + 500);
        chunks.push(chunk);
        const [rows] = await connection.execute(`SELECT id_produto FROM produtos WHERE id_empresa = ?
          AND id_produto IN (${chunk.map(() => '?').join(',')}) ORDER BY id_produto FOR UPDATE`, [empresaId, ...chunk]);
        if ((rows as unknown[]).length !== chunk.length) throwError('INVALID_SELECTION', 'Um ou mais produtos nao existem nesta empresa. Atualize a selecao.', 422);
      }
      const changed = new Set<number>();
      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',');
        const [links] = await connection.execute(`SELECT id_produto, id_categoria FROM aux_categorias_produtos
          WHERE id_empresa = ? AND id_produto IN (${placeholders}) FOR UPDATE`, [empresaId, ...chunk]);
        const byProduct = new Map<number, number[]>();
        for (const link of links as Array<{ id_produto: number; id_categoria: number }>) {
          const current = byProduct.get(Number(link.id_produto)) || [];
          current.push(Number(link.id_categoria));
          byProduct.set(Number(link.id_produto), current);
        }
        const replace = chunk.filter((id) => {
          const current = byProduct.get(id) || [];
          return current.length !== 1 || current[0] !== categoriaId;
        });
        for (const id of replace) changed.add(id);
        if (replace.length) {
          await connection.execute(`DELETE FROM aux_categorias_produtos WHERE id_empresa = ? AND id_produto IN (${replace.map(() => '?').join(',')})`, [empresaId, ...replace]);
          await connection.execute(`INSERT INTO aux_categorias_produtos (id_empresa, id_categoria, id_produto)
            VALUES ${replace.map(() => '(?,?,?)').join(',')}`, replace.flatMap((id) => [empresaId, categoriaId, id]));
        }
        const [incompatible] = await connection.execute(`SELECT DISTINCT asp.id_produto FROM aux_subcategorias_produtos asp
          LEFT JOIN subcategorias s ON s.id_empresa = asp.id_empresa AND s.id_subcategoria = asp.id_subcategoria
          WHERE asp.id_empresa = ? AND asp.id_produto IN (${placeholders}) AND (s.id_categoria IS NULL OR s.id_categoria <> ?)`, [empresaId, ...chunk, categoriaId]);
        for (const row of incompatible as Array<{ id_produto: number }>) changed.add(Number(row.id_produto));
        await connection.execute(`DELETE asp FROM aux_subcategorias_produtos asp
          LEFT JOIN subcategorias s ON s.id_empresa = asp.id_empresa AND s.id_subcategoria = asp.id_subcategoria
          WHERE asp.id_empresa = ? AND asp.id_produto IN (${placeholders}) AND (s.id_categoria IS NULL OR s.id_categoria <> ?)`, [empresaId, ...chunk, categoriaId]);
      }
      await connection.commit();
      return { processed: ids.length, changed: changed.size };
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
