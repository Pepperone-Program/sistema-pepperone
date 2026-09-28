import { getConnection, query } from '@database/connection';
import type { Orcamento, CreateOrcamentoDTO, UpdateOrcamentoDTO } from '@/types/orcamento';
import type { Subcategoria } from '@/types/categoria';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ORCAMENTO_COLUMNS } from './selectColumns';

export class OrcamentoModel {
  private static idempotencyTableReady: Promise<void> | null = null;

  private static ensureIdempotencyTable(): Promise<void> {
    if (!this.idempotencyTableReady) {
      this.idempotencyTableReady = query(`
        CREATE TABLE IF NOT EXISTS orcamentos_idempotencia (
          fingerprint CHAR(64) NOT NULL PRIMARY KEY,
          id_empresa INT NOT NULL,
          id_orcamento INT NOT NULL,
          expira_em DATETIME NOT NULL,
          criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_orcamentos_idempotencia_expira (expira_em),
          INDEX idx_orcamentos_idempotencia_orcamento (id_empresa, id_orcamento)
        ) ENGINE=InnoDB
      `).then(() => undefined).catch((error) => {
        this.idempotencyTableReady = null;
        throw error;
      });
    }
    return this.idempotencyTableReady;
  }

  static async ensureIdempotencyInfrastructure(): Promise<void> {
    await this.ensureIdempotencyTable();
    await query('SELECT fingerprint FROM orcamentos_idempotencia LIMIT 1');
  }

  private static insertValues(empresaId: number, data: CreateOrcamentoDTO): any[] {
    return [
      empresaId,
      data.data_orcamento || new Date(),
      data.fantasia || null,
      data.endereco,
      data.endereco_n || null,
      data.endereco_compl || null,
      data.bairro || null,
      data.cep || null,
      data.cidade || null,
      data.uf || null,
      data.pais || null,
      data.tel || null,
      data.tel2 || null,
      data.site || null,
      data.email,
      data.obs || null,
      data.contato,
      data.id_condicao || null,
      data.id_vendedor || null,
      data.frete || 'E',
      data.frete_valor || null,
      data.diluir_frete || 'N',
      data.nivel || '',
      data.entrega || '',
      data.id_captacao || null,
      data.logotipo || null,
      data.layout || null,
      data.layout_aprovado || 'N',
    ];
  }

  private static async insert(
    connection: PoolConnection,
    empresaId: number,
    data: CreateOrcamentoDTO
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO orcamentos (
        id_empresa, data_orcamento, fantasia, endereco, endereco_n,
        endereco_compl, bairro, cep, cidade, uf, pais, tel, tel2,
        site, email, obs, contato, id_condicao, id_vendedor, frete,
        frete_valor, diluir_frete, nivel, entrega, id_captacao,
        logotipo, layout, layout_aprovado
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, this.insertValues(empresaId, data));
    return result.insertId;
  }

  static async createIdempotent(
    empresaId: number,
    data: CreateOrcamentoDTO,
    fingerprint: string,
    ttlSeconds: number
  ): Promise<{ id: number; created: boolean }> {
    await this.ensureIdempotencyTable();
    const connection = await getConnection();
    const lockName = `orcamento:${fingerprint.slice(0, 48)}`;
    let locked = false;

    try {
      const [lockRows] = await connection.execute<RowDataPacket[]>(
        'SELECT GET_LOCK(?, 10) AS acquired',
        [lockName]
      );
      locked = Number(lockRows[0]?.acquired) === 1;
      if (!locked) {
        const error = new Error('Nao foi possivel obter a trava de idempotencia do orcamento') as Error & {
          code: string;
          statusCode: number;
        };
        error.code = 'IDEMPOTENCY_LOCK_TIMEOUT';
        error.statusCode = 503;
        throw error;
      }

      const [existingRows] = await connection.execute<RowDataPacket[]>(`
        SELECT i.id_orcamento
        FROM orcamentos_idempotencia i
        INNER JOIN orcamentos o
          ON o.id_empresa = i.id_empresa AND o.id_orcamento = i.id_orcamento
        WHERE i.fingerprint = ? AND i.expira_em > NOW()
        LIMIT 1
      `, [fingerprint]);
      const existingId = Number(existingRows[0]?.id_orcamento);
      if (Number.isInteger(existingId) && existingId > 0) {
        return { id: existingId, created: false };
      }

      await connection.beginTransaction();
      const id = await this.insert(connection, empresaId, data);
      await connection.execute(`
        INSERT INTO orcamentos_idempotencia (fingerprint, id_empresa, id_orcamento, expira_em)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ON DUPLICATE KEY UPDATE
          id_empresa = VALUES(id_empresa),
          id_orcamento = VALUES(id_orcamento),
          expira_em = VALUES(expira_em),
          criado_em = CURRENT_TIMESTAMP
      `, [fingerprint, empresaId, id, ttlSeconds]);
      await connection.commit();
      return { id, created: true };
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      if (locked) {
        await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
      }
      connection.release();
    }
  }
  static async findSubcategoriasByCategorias(
    empresaId: number,
    categoriaIds: number[]
  ): Promise<Subcategoria[]> {
    if (categoriaIds.length === 0) return [];

    const placeholders = categoriaIds.map(() => '?').join(', ');
    const sql = `
      SELECT id_empresa, id_categoria, id_subcategoria, subcategoria,
             descricao, icon, habilitado, ordem
      FROM subcategorias
      WHERE id_empresa = ?
        AND id_categoria IN (${placeholders})
        AND habilitado = 'S'
      ORDER BY id_categoria ASC, ordem ASC, subcategoria ASC, id_subcategoria ASC
    `;

    const rows = await query(sql, [empresaId, ...categoriaIds]);
    return rows as Subcategoria[];
  }

  static async findTopCategoriasOrcadas(
    empresaId: number,
    days: 30 | 90
  ): Promise<Array<{ id_categoria: number; categoria: string; total: number }>> {
    const sql = `
      SELECT
        c.id_categoria,
        c.categoria,
        COUNT(*) AS total
      FROM orcamentos o
      INNER JOIN orcamentos_itens oi ON oi.id_orcamento = o.id_orcamento
      INNER JOIN aux_categorias_produtos acp
        ON acp.id_empresa = o.id_empresa
       AND acp.id_produto = oi.id_produto
      INNER JOIN categorias c
        ON c.id_empresa = acp.id_empresa
       AND c.id_categoria = acp.id_categoria
      WHERE o.id_empresa = ?
        AND o.data_orcamento >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${days} DAY)
        AND c.habilitado = 'S'
      GROUP BY c.id_categoria, c.categoria
      ORDER BY total DESC, c.categoria ASC, c.id_categoria ASC
      LIMIT 5
    `;

    const rows = await query(sql, [empresaId]);
    return (rows as Array<{ id_categoria: number; categoria: string; total: number }>).map(
      (row) => ({
        id_categoria: Number(row.id_categoria),
        categoria: row.categoria,
        total: Number(row.total),
      })
    );
  }
  static async findById(
    empresaId: number,
    orcamentoId: number
  ): Promise<Orcamento | null> {
    const sql = `SELECT ${ORCAMENTO_COLUMNS} FROM orcamentos WHERE id_empresa = ? AND id_orcamento = ?`;
    const result = await query(sql, [empresaId, orcamentoId]);
    return (result as any[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string,
    data?: string
  ): Promise<{ items: Orcamento[]; total: number }> {
    let where = 'FROM orcamentos WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      const numericSearch = Number(search);
      where += ` AND (fantasia LIKE ? OR email LIKE ? OR contato LIKE ?${Number.isInteger(numericSearch) ? ' OR id_orcamento = ?' : ''})`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
      if (Number.isInteger(numericSearch)) values.push(numericSearch);
    }

    if (data) {
      where += ' AND DATE(data_orcamento) = ?';
      values.push(data);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total ${where}`,
      values
    );
    const total = (countResult as any[])[0].total;

    const offset = (page - 1) * limit;
    const sql = `SELECT ${ORCAMENTO_COLUMNS} ${where} ORDER BY data_orcamento DESC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const items = await query(sql, values);
    return { items: items as Orcamento[], total };
  }

  static async findByCliente(
    empresaId: number,
    clienteId: number,
    page: number = 1,
    limit: number = 100
  ): Promise<{ items: Orcamento[]; total: number }> {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const values = [empresaId, String(clienteId)];

    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM orcamentos
        WHERE id_empresa = ? AND id_cliente = ?
      `,
      values
    );
    const total = (countResult as any[])[0].total;

    const items = await query(
      `
        SELECT ${ORCAMENTO_COLUMNS}
        FROM orcamentos
        WHERE id_empresa = ? AND id_cliente = ?
        ORDER BY data_orcamento DESC, id_orcamento DESC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );

    return { items: items as Orcamento[], total };
  }

  static async update(
    empresaId: number,
    orcamentoId: number,
    data: UpdateOrcamentoDTO
  ): Promise<boolean> {
    const allowedFields = new Set([
      'id_cliente',
      'data_orcamento',
      'fantasia',
      'endereco',
      'endereco_n',
      'endereco_compl',
      'bairro',
      'cep',
      'cidade',
      'uf',
      'pais',
      'tel',
      'tel2',
      'site',
      'email',
      'obs',
      'contato',
      'id_condicao',
      'id_vendedor',
      'frete',
      'frete_valor',
      'diluir_frete',
      'nivel',
      'entrega',
      'id_captacao',
      'logotipo',
      'layout',
      'layout_aprovado',
    ]);
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (!allowedFields.has(key)) return;
      updates.push(`${key} = ?`);
      values.push(value ?? null);
    });

    if (!updates.length) {
      return false;
    }

    values.push(empresaId, orcamentoId);

    const sql = `
      UPDATE orcamentos
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_orcamento = ?
    `;

    const result = await query(sql, values);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, orcamentoId: number): Promise<boolean> {
    const sql = 'DELETE FROM orcamentos WHERE id_empresa = ? AND id_orcamento = ?';
    const result = await query(sql, [empresaId, orcamentoId]);
    return (result as any).affectedRows > 0;
  }
}
