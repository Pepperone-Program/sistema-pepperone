import { getConnection, query } from '@database/connection';
import { SubcategoriaModel } from '@models/Categoria';
import { ProdutoModel } from '@models/Produto';
import { adminProductSearch } from '@models/adminProductSearch';
import { throwError } from '@utils/helpers';

export const SUBCATEGORY_SELECTION_LIMIT = 50_000;

export class SubcategoryProductsService {
  static async available(empresaId: number, subcategoriaId: number, search: string, page: number, idsOnly: boolean) {
    if (!Number.isSafeInteger(subcategoriaId) || subcategoriaId <= 0 || !await SubcategoriaModel.findById(empresaId, subcategoriaId)) {
      throwError('SUBCATEGORIA_NOT_FOUND', 'Subcategoria nao encontrada', 404);
    }
    if (search.length > 200) throwError('INVALID_SEARCH', 'Informe ate 200 caracteres', 400);

    if (idsOnly) {
      const filter = adminProductSearch(search);
      const rows = await query(`SELECT id_produto FROM produtos WHERE id_empresa = ?${filter.sql}
        ORDER BY id_produto LIMIT ?`, [empresaId, ...filter.values, SUBCATEGORY_SELECTION_LIMIT + 1]) as Array<{ id_produto: number }>;
      if (rows.length > SUBCATEGORY_SELECTION_LIMIT) {
        throwError('SELECTION_TOO_LARGE', 'Refine o filtro para selecionar ate 50000 produtos', 422);
      }
      return { produto_ids: rows.map((row) => Number(row.id_produto)) };
    }

    const limit = 30;
    const [products, links] = await Promise.all([
      ProdutoModel.findAll(empresaId, page, limit, search),
      query('SELECT id_produto FROM aux_subcategorias_produtos WHERE id_empresa = ? AND id_subcategoria = ?', [empresaId, subcategoriaId]) as Promise<Array<{ id_produto: number }>>,
    ]);
    return { ...products, page, limit, totalPages: Math.ceil(products.total / limit), linked_ids: links.map((row) => Number(row.id_produto)) };
  }

  static async assign(empresaId: number, subcategoriaId: number, requestedIds: number[]) {
    if (!Number.isSafeInteger(subcategoriaId) || subcategoriaId <= 0) {
      throwError('INVALID_SUBCATEGORY', 'Subcategoria invalida', 400);
    }
    if (!Array.isArray(requestedIds) || !requestedIds.length || requestedIds.length > SUBCATEGORY_SELECTION_LIMIT
      || requestedIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throwError('INVALID_SELECTION', 'Selecione de 1 a 50000 produtos validos', 400);
    }

    const ids = [...new Set(requestedIds)].sort((a, b) => a - b);
    const connection = await getConnection();
    let transactionStarted = false;
    try {
      const [engines] = await connection.execute(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('produtos','subcategorias','aux_subcategorias_produtos')`);
      const tables = engines as Array<{ TABLE_NAME: string; ENGINE: string }>;
      if (tables.length !== 3 || tables.some((table) => table.ENGINE?.toUpperCase() !== 'INNODB')) {
        throwError('CATEGORY_TRANSACTION_UNAVAILABLE', 'A atribuicao em lote ainda nao esta disponivel. A estrutura transacional do banco precisa ser atualizada.', 409);
      }

      await connection.beginTransaction();
      transactionStarted = true;
      const [subcategories] = await connection.execute(
        'SELECT id_subcategoria FROM subcategorias WHERE id_empresa = ? AND id_subcategoria = ? LOCK IN SHARE MODE',
        [empresaId, subcategoriaId]
      );
      if (!(subcategories as unknown[]).length) throwError('SUBCATEGORIA_NOT_FOUND', 'Subcategoria nao encontrada', 404);

      const chunks: number[][] = [];
      for (let start = 0; start < ids.length; start += 500) {
        const chunk = ids.slice(start, start + 500);
        chunks.push(chunk);
        const [rows] = await connection.execute(`SELECT id_produto FROM produtos WHERE id_empresa = ?
          AND id_produto IN (${chunk.map(() => '?').join(',')}) ORDER BY id_produto FOR UPDATE`, [empresaId, ...chunk]);
        if ((rows as unknown[]).length !== chunk.length) {
          throwError('INVALID_SELECTION', 'Um ou mais produtos nao existem nesta empresa. Atualize a selecao.', 422);
        }
      }

      let changed = 0;
      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',');
        const [links] = await connection.execute(`SELECT id_produto FROM aux_subcategorias_produtos
          WHERE id_empresa = ? AND id_subcategoria = ? AND id_produto IN (${placeholders}) FOR UPDATE`, [empresaId, subcategoriaId, ...chunk]);
        const linked = new Set((links as Array<{ id_produto: number }>).map((row) => Number(row.id_produto)));
        const missing = chunk.filter((id) => !linked.has(id));
        if (missing.length) {
          await connection.execute(`INSERT INTO aux_subcategorias_produtos (id_empresa, id_subcategoria, id_produto)
            VALUES ${missing.map(() => '(?,?,?)').join(',')}`, missing.flatMap((id) => [empresaId, subcategoriaId, id]));
          changed += missing.length;
        }
      }
      await connection.commit();
      return { processed: ids.length, changed };
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
