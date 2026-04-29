import { query } from '@database/connection';
import type { Grupo, GrupoPermissao, GrupoUsuario } from '@/types/grupo-permissao';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 100);
const normalizePage = (page: number): number => Math.max(page, 1);

export class GrupoPermissaoModel {
  static async findGrupos(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ items: Grupo[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let filter = '';
    const values: any[] = [empresaId, empresaId];

    if (search) {
      filter = 'WHERE grupo LIKE ?';
      values.push(`%${search}%`);
    }

    const baseSql = `
      FROM (
        SELECT grupo FROM aux_grupos_permissoes WHERE id_empresa = ?
        UNION
        SELECT grupo FROM aux_grupos_usuarios WHERE id_empresa = ?
      ) grupos
      ${filter}
    `;

    const countResult = await query(`SELECT COUNT(*) as total ${baseSql}`, values);
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT
          grupos.grupo,
          ? as id_empresa,
          (
            SELECT COUNT(*)
            FROM aux_grupos_permissoes gp
            WHERE gp.id_empresa = ? AND gp.grupo = grupos.grupo
          ) as total_permissoes,
          (
            SELECT COUNT(*)
            FROM aux_grupos_usuarios gu
            WHERE gu.id_empresa = ? AND gu.grupo = grupos.grupo
          ) as total_usuarios
        ${baseSql}
        ORDER BY grupos.grupo ASC
        LIMIT ? OFFSET ?
      `,
      [
        empresaId,
        empresaId,
        empresaId,
        ...values,
        safeLimit,
        (safePage - 1) * safeLimit,
      ]
    );

    return { items: items as Grupo[], total };
  }

  static async findPermissao(
    empresaId: number,
    grupo: string,
    permissao: string
  ): Promise<GrupoPermissao | null> {
    const sql = `
      SELECT id_empresa, grupo, permissao
      FROM aux_grupos_permissoes
      WHERE id_empresa = ? AND grupo = ? AND permissao = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, grupo, permissao]);
    return (result as GrupoPermissao[])[0] || null;
  }

  static async addPermissao(
    empresaId: number,
    grupo: string,
    permissao: string
  ): Promise<GrupoPermissao> {
    const sql = `
      INSERT INTO aux_grupos_permissoes (id_empresa, grupo, permissao)
      VALUES (?, ?, ?)
    `;
    await query(sql, [empresaId, grupo, permissao]);
    return { id_empresa: empresaId, grupo, permissao };
  }

  static async removePermissao(
    empresaId: number,
    grupo: string,
    permissao: string
  ): Promise<boolean> {
    const sql = `
      DELETE FROM aux_grupos_permissoes
      WHERE id_empresa = ? AND grupo = ? AND permissao = ?
    `;
    const result = await query(sql, [empresaId, grupo, permissao]);
    return (result as any).affectedRows > 0;
  }

  static async findPermissoes(
    empresaId: number,
    grupo: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: GrupoPermissao[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const values = [empresaId, grupo];
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM aux_grupos_permissoes
        WHERE id_empresa = ? AND grupo = ?
      `,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_empresa, grupo, permissao
        FROM aux_grupos_permissoes
        WHERE id_empresa = ? AND grupo = ?
        ORDER BY permissao ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as GrupoPermissao[], total };
  }

  static async usuarioExists(empresaId: number, usuarioId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM usuarios
      WHERE id_empresa = ? AND id_usuario = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, usuarioId]);
    return (result as any[]).length > 0;
  }

  static async findUsuarioGrupo(
    empresaId: number,
    grupo: string,
    usuarioId: number
  ): Promise<GrupoUsuario | null> {
    const sql = `
      SELECT id_empresa, id_usuario, grupo
      FROM aux_grupos_usuarios
      WHERE id_empresa = ? AND grupo = ? AND id_usuario = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, grupo, usuarioId]);
    return (result as GrupoUsuario[])[0] || null;
  }

  static async addUsuario(
    empresaId: number,
    grupo: string,
    usuarioId: number
  ): Promise<GrupoUsuario> {
    const sql = `
      INSERT INTO aux_grupos_usuarios (id_empresa, id_usuario, grupo)
      VALUES (?, ?, ?)
    `;
    await query(sql, [empresaId, usuarioId, grupo]);
    return { id_empresa: empresaId, id_usuario: usuarioId, grupo };
  }

  static async removeUsuario(
    empresaId: number,
    grupo: string,
    usuarioId: number
  ): Promise<boolean> {
    const sql = `
      DELETE FROM aux_grupos_usuarios
      WHERE id_empresa = ? AND grupo = ? AND id_usuario = ?
    `;
    const result = await query(sql, [empresaId, grupo, usuarioId]);
    return (result as any).affectedRows > 0;
  }

  static async findUsuarios(
    empresaId: number,
    grupo: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: GrupoUsuario[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const values = [empresaId, grupo];
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM aux_grupos_usuarios
        WHERE id_empresa = ? AND grupo = ?
      `,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_empresa, id_usuario, grupo
        FROM aux_grupos_usuarios
        WHERE id_empresa = ? AND grupo = ?
        ORDER BY id_usuario ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as GrupoUsuario[], total };
  }

  static async findGruposByUsuario(
    empresaId: number,
    usuarioId: number
  ): Promise<GrupoUsuario[]> {
    const sql = `
      SELECT id_empresa, id_usuario, grupo
      FROM aux_grupos_usuarios
      WHERE id_empresa = ? AND id_usuario = ?
      ORDER BY grupo ASC
    `;
    const result = await query(sql, [empresaId, usuarioId]);
    return result as GrupoUsuario[];
  }

  static async findPermissoesByUsuario(
    empresaId: number,
    usuarioId: number
  ): Promise<GrupoPermissao[]> {
    const sql = `
      SELECT DISTINCT gp.id_empresa, gp.grupo, gp.permissao
      FROM aux_grupos_usuarios gu
      INNER JOIN aux_grupos_permissoes gp
        ON gp.id_empresa = gu.id_empresa
       AND gp.grupo = gu.grupo
      WHERE gu.id_empresa = ? AND gu.id_usuario = ?
      ORDER BY gp.grupo ASC, gp.permissao ASC
    `;
    const result = await query(sql, [empresaId, usuarioId]);
    return result as GrupoPermissao[];
  }
}
