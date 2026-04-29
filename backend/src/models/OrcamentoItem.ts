import { query } from '@database/connection';
import {
  OrcamentoItem,
  CreateOrcamentoItemDTO,
  UpdateOrcamentoItemDTO,
} from '@/types/orcamento-item';

export class OrcamentoItemModel {
  static async create(
    data: CreateOrcamentoItemDTO
  ): Promise<any> {
    const sql = `
      INSERT INTO orcamentos_itens (
        id_orcamento, data_orcamento, id_produto, codigo, produto,
        produto_cor, id_tipo_gravacao, gravacao_cores, quantidade,
        bv, preco_unitario, margem_lucro, preco_unitario_final,
        preco_unitario_aprovado, preco_unitario_frete, frete_diluido
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const values = [
      data.id_orcamento,
      data.data_orcamento || new Date(),
      data.id_produto,
      data.codigo,
      data.produto,
      data.produto_cor || null,
      data.id_tipo_gravacao || null,
      data.gravacao_cores,
      data.quantidade,
      data.bv || null,
      data.preco_unitario || null,
      data.margem_lucro || null,
      data.preco_unitario_final || null,
      data.preco_unitario_aprovado || null,
      data.preco_unitario_frete || null,
      data.frete_diluido || 'N',
    ];

    const result = await query(sql, values);
    return (result as any).insertId;
  }

  static async findById(itemId: number): Promise<OrcamentoItem | null> {
    const sql = 'SELECT * FROM orcamentos_itens WHERE id_item = ?';
    const result = await query(sql, [itemId]);
    return (result as any[])[0] || null;
  }

  static async findByOrcamentoId(
    orcamentoId: number
  ): Promise<OrcamentoItem[]> {
    const sql = 'SELECT * FROM orcamentos_itens WHERE id_orcamento = ? ORDER BY id_item ASC';
    const result = await query(sql, [orcamentoId]);
    return result as OrcamentoItem[];
  }

  static async update(
    itemId: number,
    data: UpdateOrcamentoItemDTO
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      updates.push(`${key} = ?`);
      values.push(value ?? null);
    });

    values.push(itemId);

    const sql = `
      UPDATE orcamentos_itens
      SET ${updates.join(', ')}
      WHERE id_item = ?
    `;

    const result = await query(sql, values);
    return (result as any).affectedRows > 0;
  }

  static async delete(itemId: number): Promise<boolean> {
    const sql = 'DELETE FROM orcamentos_itens WHERE id_item = ?';
    const result = await query(sql, [itemId]);
    return (result as any).affectedRows > 0;
  }

  static async deleteByOrcamentoId(orcamentoId: number): Promise<boolean> {
    const sql = 'DELETE FROM orcamentos_itens WHERE id_orcamento = ?';
    const result = await query(sql, [orcamentoId]);
    return (result as any).affectedRows > 0;
  }
}
