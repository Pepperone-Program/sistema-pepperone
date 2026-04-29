import { query } from '@database/connection';
import type { Produto, CreateProdutoDTO, UpdateProdutoDTO } from '@/types/produto';

export class ProdutoModel {
  static async create(
    empresaId: number,
    data: CreateProdutoDTO
    ): Promise<any> {
    const sql = `
      INSERT INTO produtos (
        id_empresa, id_tipo_produto, produto, descricao, codigo,
        id_tipo_gravacao_padrao, altura, largura, profundidade, peso,
        caixa1, caixa2, caixa3, caixa4, caixa5, ncm, imagem,
        data_inclusao, data_inicial, data_final, obs, site,
        sugerir_sempre, lancamento, promocao, premium, marketplace,
        video, habilitado, cod_forn
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const values = [
      empresaId,
      data.id_tipo_produto,
      data.produto,
      data.descricao || null,
      data.codigo,
      data.id_tipo_gravacao_padrao || 0,
      data.altura || null,
      data.largura || null,
      data.profundidade || null,
      data.peso || null,
      data.caixa1 || null,
      data.caixa2 || null,
      data.caixa3 || null,
      data.caixa4 || null,
      data.caixa5 || null,
      data.ncm || null,
      data.imagem || null,
      data.data_inicial || null,
      data.data_final || null,
      data.obs || null,
      data.site || 'N',
      data.sugerir_sempre || 'N',
      data.lancamento || 'N',
      data.promocao || 'N',
      data.premium || 'N',
      data.marketplace || 'N',
      data.video || null,
      data.habilitado || 'S',
      data.cod_forn || null,
    ];

    const result = await query(sql, values);
    return (result as any).insertId;
  }

  static async findById(
    empresaId: number,
    produtoId: number
  ): Promise<Produto | null> {
    const sql = 'SELECT * FROM produtos WHERE id_empresa = ? AND id_produto = ?';
    const result = await query(sql, [empresaId, produtoId]);
    return (result as any[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ items: Produto[]; total: number }> {
    let sql = 'SELECT * FROM produtos WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      sql += ` AND (produto LIKE ? OR codigo LIKE ? OR descricao LIKE ?)`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
    }

    const countResult = await query(
      sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
      values
    );
    const total = (countResult as any[])[0].total;

    const offset = (page - 1) * limit;
    sql += ` ORDER BY data_modificacao DESC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const items = await query(sql, values);
    return { items: items as Produto[], total };
  }

  static async update(
    empresaId: number,
    produtoId: number,
    data: UpdateProdutoDTO
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      updates.push(`${key} = ?`);
      values.push(value ?? null);
    });

    updates.push('data_modificacao = NOW()');
    values.push(empresaId, produtoId);

    const sql = `
      UPDATE produtos
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_produto = ?
    `;

    const result = await query(sql, values);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, produtoId: number): Promise<boolean> {
    const sql = 'DELETE FROM produtos WHERE id_empresa = ? AND id_produto = ?';
    const result = await query(sql, [empresaId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async searchByCodigo(
    empresaId: number,
    codigo: string
  ): Promise<Produto | null> {
    const sql =
      'SELECT * FROM produtos WHERE id_empresa = ? AND codigo = ? LIMIT 1';
    const result = await query(sql, [empresaId, codigo]);
    return (result as any[])[0] || null;
  }
}
