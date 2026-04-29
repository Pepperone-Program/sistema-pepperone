import { query } from '@database/connection';
import type {
  Categoria,
  CategoriaProduto,
  CreateCategoriaDTO,
  CreateSubcategoriaDTO,
  Subcategoria,
  SubcategoriaProduto,
  UpdateCategoriaDTO,
  UpdateSubcategoriaDTO,
} from '@/types/categoria';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 100);
const normalizePage = (page: number): number => Math.max(page, 1);

export class CategoriaModel {
  static async create(empresaId: number, data: CreateCategoriaDTO): Promise<number> {
    const columns = ['id_empresa', 'categoria', 'descricao', 'icon', 'habilitado'];
    const placeholders = ['?', '?', '?', '?', '?'];
    const values: any[] = [
      empresaId,
      data.categoria,
      data.descricao || null,
      data.icon || null,
      data.habilitado || 'S',
    ];

    if (data.id_categoria !== undefined) {
      columns.splice(1, 0, 'id_categoria');
      placeholders.splice(1, 0, '?');
      values.splice(1, 0, data.id_categoria);
    }

    const sql = `
      INSERT INTO categorias (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    const result = await query(sql, values);
    return data.id_categoria ?? (result as any).insertId;
  }

  static async findById(empresaId: number, categoriaId: number): Promise<Categoria | null> {
    const sql = `
      SELECT id_empresa, id_categoria, categoria, descricao, icon, habilitado
      FROM categorias
      WHERE id_empresa = ? AND id_categoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoriaId]);
    return (result as Categoria[])[0] || null;
  }

  static async findByName(empresaId: number, categoria: string): Promise<Categoria | null> {
    const sql = `
      SELECT id_empresa, id_categoria, categoria, descricao, icon, habilitado
      FROM categorias
      WHERE id_empresa = ? AND LOWER(categoria) = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoria.trim().toLowerCase()]);
    return (result as Categoria[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
    habilitado?: string
  ): Promise<{ items: Categoria[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = 'WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      where += ' AND (categoria LIKE ? OR descricao LIKE ?)';
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern);
    }

    if (habilitado) {
      where += ' AND habilitado = ?';
      values.push(habilitado);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM categorias ${where}`,
      values
    );
    const total = (countResult as any[])[0].total;

    const sql = `
      SELECT id_empresa, id_categoria, categoria, descricao, icon, habilitado
      FROM categorias
      ${where}
      ORDER BY categoria ASC
      LIMIT ? OFFSET ?
    `;
    const items = await query(sql, [...values, safeLimit, (safePage - 1) * safeLimit]);
    return { items: items as Categoria[], total };
  }

  static async update(
    empresaId: number,
    categoriaId: number,
    data: UpdateCategoriaDTO
  ): Promise<boolean> {
    const allowedColumns = ['categoria', 'descricao', 'icon', 'habilitado'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedColumns.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value ?? null);
      }
    }

    if (updates.length === 0) return true;

    const sql = `
      UPDATE categorias
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_categoria = ?
    `;
    const result = await query(sql, [...values, empresaId, categoriaId]);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, categoriaId: number): Promise<boolean> {
    const sql = 'DELETE FROM categorias WHERE id_empresa = ? AND id_categoria = ?';
    const result = await query(sql, [empresaId, categoriaId]);
    return (result as any).affectedRows > 0;
  }

  static async hasSubcategorias(empresaId: number, categoriaId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM subcategorias
      WHERE id_empresa = ? AND id_categoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoriaId]);
    return (result as any[]).length > 0;
  }

  static async hasProdutos(empresaId: number, categoriaId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM aux_categorias_produtos
      WHERE id_empresa = ? AND id_categoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoriaId]);
    return (result as any[]).length > 0;
  }

  static async produtoExists(empresaId: number, produtoId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM produtos
      WHERE id_empresa = ? AND id_produto = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, produtoId]);
    return (result as any[]).length > 0;
  }

  static async findProdutoLink(
    empresaId: number,
    categoriaId: number,
    produtoId: number
  ): Promise<CategoriaProduto | null> {
    const sql = `
      SELECT id_empresa, id_categoria, id_produto
      FROM aux_categorias_produtos
      WHERE id_empresa = ? AND id_categoria = ? AND id_produto = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoriaId, produtoId]);
    return (result as CategoriaProduto[])[0] || null;
  }

  static async addProduto(
    empresaId: number,
    categoriaId: number,
    produtoId: number
  ): Promise<CategoriaProduto> {
    const sql = `
      INSERT INTO aux_categorias_produtos (id_empresa, id_categoria, id_produto)
      VALUES (?, ?, ?)
    `;
    await query(sql, [empresaId, categoriaId, produtoId]);
    return { id_empresa: empresaId, id_categoria: categoriaId, id_produto: produtoId };
  }

  static async removeProduto(
    empresaId: number,
    categoriaId: number,
    produtoId: number
  ): Promise<boolean> {
    const sql = `
      DELETE FROM aux_categorias_produtos
      WHERE id_empresa = ? AND id_categoria = ? AND id_produto = ?
    `;
    const result = await query(sql, [empresaId, categoriaId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async findProdutos(
    empresaId: number,
    categoriaId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: CategoriaProduto[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const values = [empresaId, categoriaId];
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM aux_categorias_produtos
        WHERE id_empresa = ? AND id_categoria = ?
      `,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_empresa, id_categoria, id_produto
        FROM aux_categorias_produtos
        WHERE id_empresa = ? AND id_categoria = ?
        ORDER BY id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as CategoriaProduto[], total };
  }
}

export class SubcategoriaModel {
  static async create(empresaId: number, data: CreateSubcategoriaDTO): Promise<number> {
    const columns = [
      'id_empresa',
      'id_categoria',
      'subcategoria',
      'descricao',
      'icon',
      'habilitado',
      'ordem',
    ];
    const placeholders = ['?', '?', '?', '?', '?', '?', '?'];
    const values: any[] = [
      empresaId,
      data.id_categoria,
      data.subcategoria,
      data.descricao || null,
      data.icon || null,
      data.habilitado || 'S',
      data.ordem ?? 0,
    ];

    if (data.id_subcategoria !== undefined) {
      columns.splice(2, 0, 'id_subcategoria');
      placeholders.splice(2, 0, '?');
      values.splice(2, 0, data.id_subcategoria);
    }

    const sql = `
      INSERT INTO subcategorias (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    const result = await query(sql, values);
    return data.id_subcategoria ?? (result as any).insertId;
  }

  static async findById(empresaId: number, subcategoriaId: number): Promise<Subcategoria | null> {
    const sql = `
      SELECT id_empresa, id_categoria, id_subcategoria, subcategoria, descricao, icon, habilitado, ordem
      FROM subcategorias
      WHERE id_empresa = ? AND id_subcategoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, subcategoriaId]);
    return (result as Subcategoria[])[0] || null;
  }

  static async findByName(
    empresaId: number,
    categoriaId: number,
    subcategoria: string
  ): Promise<Subcategoria | null> {
    const sql = `
      SELECT id_empresa, id_categoria, id_subcategoria, subcategoria, descricao, icon, habilitado, ordem
      FROM subcategorias
      WHERE id_empresa = ? AND id_categoria = ? AND LOWER(subcategoria) = ?
      LIMIT 1
    `;
    const result = await query(
      sql,
      [empresaId, categoriaId, subcategoria.trim().toLowerCase()]
    );
    return (result as Subcategoria[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoriaId?: number,
    habilitado?: string
  ): Promise<{ items: Subcategoria[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = 'WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (categoriaId) {
      where += ' AND id_categoria = ?';
      values.push(categoriaId);
    }

    if (search) {
      where += ' AND (subcategoria LIKE ? OR descricao LIKE ?)';
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern);
    }

    if (habilitado) {
      where += ' AND habilitado = ?';
      values.push(habilitado);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM subcategorias ${where}`,
      values
    );
    const total = (countResult as any[])[0].total;

    const sql = `
      SELECT id_empresa, id_categoria, id_subcategoria, subcategoria, descricao, icon, habilitado, ordem
      FROM subcategorias
      ${where}
      ORDER BY ordem ASC, subcategoria ASC
      LIMIT ? OFFSET ?
    `;
    const items = await query(sql, [...values, safeLimit, (safePage - 1) * safeLimit]);
    return { items: items as Subcategoria[], total };
  }

  static async update(
    empresaId: number,
    subcategoriaId: number,
    data: UpdateSubcategoriaDTO
  ): Promise<boolean> {
    const allowedColumns = [
      'id_categoria',
      'subcategoria',
      'descricao',
      'icon',
      'habilitado',
      'ordem',
    ];
    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedColumns.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value ?? null);
      }
    }

    if (updates.length === 0) return true;

    const sql = `
      UPDATE subcategorias
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_subcategoria = ?
    `;
    const result = await query(sql, [...values, empresaId, subcategoriaId]);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, subcategoriaId: number): Promise<boolean> {
    const sql = 'DELETE FROM subcategorias WHERE id_empresa = ? AND id_subcategoria = ?';
    const result = await query(sql, [empresaId, subcategoriaId]);
    return (result as any).affectedRows > 0;
  }

  static async hasProdutos(empresaId: number, subcategoriaId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM aux_subcategorias_produtos
      WHERE id_empresa = ? AND id_subcategoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, subcategoriaId]);
    return (result as any[]).length > 0;
  }

  static async findProdutoLink(
    empresaId: number,
    subcategoriaId: number,
    produtoId: number
  ): Promise<SubcategoriaProduto | null> {
    const sql = `
      SELECT id_empresa, id_subcategoria, id_produto
      FROM aux_subcategorias_produtos
      WHERE id_empresa = ? AND id_subcategoria = ? AND id_produto = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, subcategoriaId, produtoId]);
    return (result as SubcategoriaProduto[])[0] || null;
  }

  static async addProduto(
    empresaId: number,
    subcategoriaId: number,
    produtoId: number
  ): Promise<SubcategoriaProduto> {
    const sql = `
      INSERT INTO aux_subcategorias_produtos (id_empresa, id_subcategoria, id_produto)
      VALUES (?, ?, ?)
    `;
    await query(sql, [empresaId, subcategoriaId, produtoId]);
    return { id_empresa: empresaId, id_subcategoria: subcategoriaId, id_produto: produtoId };
  }

  static async removeProduto(
    empresaId: number,
    subcategoriaId: number,
    produtoId: number
  ): Promise<boolean> {
    const sql = `
      DELETE FROM aux_subcategorias_produtos
      WHERE id_empresa = ? AND id_subcategoria = ? AND id_produto = ?
    `;
    const result = await query(sql, [empresaId, subcategoriaId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async findProdutos(
    empresaId: number,
    subcategoriaId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: SubcategoriaProduto[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const values = [empresaId, subcategoriaId];
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM aux_subcategorias_produtos
        WHERE id_empresa = ? AND id_subcategoria = ?
      `,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_empresa, id_subcategoria, id_produto
        FROM aux_subcategorias_produtos
        WHERE id_empresa = ? AND id_subcategoria = ?
        ORDER BY id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as SubcategoriaProduto[], total };
  }
}
