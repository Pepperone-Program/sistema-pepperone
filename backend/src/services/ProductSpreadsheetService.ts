import ExcelJS from 'exceljs';
import { query } from '@database/connection';
import { adminProductSearch } from '@models/adminProductSearch';
import { PRODUTO_COLUMNS } from '@models/selectColumns';

export type SpreadsheetModel = 'produtos' | 'categorias' | 'subcategorias' | 'publicos-alvos';
export type SpreadsheetFilters = {
  search?: string;
  habilitado?: string;
  site?: string;
  promocao?: string;
  categorias?: number[];
};

type ExportRow = Record<string, unknown>;

const PRODUCT_COLUMNS = PRODUTO_COLUMNS.split(',').map((column) => column.trim()).filter(Boolean);
const MODELS: Record<SpreadsheetModel, { join: string; columns: string[] }> = {
  produtos: { join: '', columns: [] },
  categorias: {
    join: 'INNER JOIN aux_categorias_produtos rel ON rel.id_empresa = p.id_empresa AND rel.id_produto = p.id_produto INNER JOIN categorias item ON item.id_empresa = rel.id_empresa AND item.id_categoria = rel.id_categoria',
    columns: ['item.id_categoria AS vinculo_id', 'item.categoria AS vinculo_nome'],
  },
  subcategorias: {
    join: 'INNER JOIN aux_subcategorias_produtos rel ON rel.id_empresa = p.id_empresa AND rel.id_produto = p.id_produto INNER JOIN subcategorias item ON item.id_empresa = rel.id_empresa AND item.id_subcategoria = rel.id_subcategoria',
    columns: ['item.id_subcategoria AS vinculo_id', 'item.subcategoria AS vinculo_nome', 'item.id_categoria AS categoria_id'],
  },
  'publicos-alvos': {
    join: 'INNER JOIN aux_publicos_alvos_produtos rel ON rel.id_produto = p.id_produto INNER JOIN publicos_alvos item ON item.id_publico_alvo = rel.id_publico_alvo',
    columns: ['item.id_publico_alvo AS vinculo_id', 'item.publico_alvo AS vinculo_nome'],
  },
};

function cellValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  // Keep database strings as text, including values that Excel would evaluate as formulas.
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return text;
}

export class ProductSpreadsheetService {
  static async generate(empresaId: number, model: SpreadsheetModel, filters: SpreadsheetFilters): Promise<Buffer> {
    const config = MODELS[model];
    const where = ['p.id_empresa = ?'];
    const values: Array<string | number> = [empresaId];

    if (model === 'produtos') {
      const search = adminProductSearch(filters.search);
      if (search.sql) where.push(search.sql.replace(/^ AND /, '').replace(/\bid_produto\b/g, 'p.id_produto').replace(/\bcodigo\b/g, 'p.codigo').replace(/\bproduto\b/g, 'p.produto'));
      values.push(...search.values);
      for (const field of ['habilitado', 'site', 'promocao'] as const) {
        if (filters[field]) {
          where.push(`p.${field} = ?`);
          values.push(filters[field]);
        }
      }
      if (filters.categorias?.length) {
        const placeholders = filters.categorias.map(() => '?').join(',');
        where.push(`EXISTS (SELECT 1 FROM aux_categorias_produtos acp WHERE acp.id_empresa = p.id_empresa AND acp.id_produto = p.id_produto AND acp.id_categoria IN (${placeholders}))`);
        values.push(...filters.categorias);
      }
    }

    const headers = [...PRODUCT_COLUMNS, 'url_imagem_principal', ...(model === 'produtos' ? [] : ['vinculo_id', 'vinculo_nome']), ...(model === 'subcategorias' ? ['categoria_id'] : [])];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Produtos');
    sheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(Math.max(header.length + 3, 16), 42) }));
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    const selected = PRODUCT_COLUMNS.map((column) => `p.${column}`).join(', ');
    const extra = config.columns.length ? `, ${config.columns.join(', ')}` : '';
    const sql = `SELECT ${selected}${extra}, COALESCE((SELECT NULLIF(ip.url_imagem, '') FROM imagens_produtos ip WHERE ip.id_produto = p.id_produto ORDER BY ip.ordem_imagem ASC, ip.id_imagem ASC LIMIT 1), NULLIF(p.imagem, '')) AS url_imagem_principal FROM produtos p ${config.join} WHERE ${where.join(' AND ')} ORDER BY p.id_produto ASC${model === 'produtos' ? '' : ', vinculo_id ASC'} LIMIT ? OFFSET ?`;
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      const rows = await query(sql, [...values, pageSize, offset]) as ExportRow[];
      for (const row of rows) {
        const output: Record<string, string | number | null> = {};
        for (const header of headers) output[header] = cellValue(row[header]);
        sheet.addRow(output);
      }
      if (rows.length < pageSize) break;
      offset += rows.length;
    }
    const result = await workbook.xlsx.writeBuffer();
    return Buffer.from(result);
  }
}
