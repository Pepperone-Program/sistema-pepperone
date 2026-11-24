import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/database/connection', () => ({ query }));
import { ProductSpreadsheetService } from '../src/services/ProductSpreadsheetService';

beforeEach(() => query.mockReset());

describe('product spreadsheets', () => {
  it('combines tenant, search and product filters in the general model', async () => {
    query.mockResolvedValueOnce([{ id_empresa: 7, id_produto: 12, produto: 'Mochila', codigo: '=1+1', url_imagem_principal: 'https://example.com/main.jpg' }]);
    const file = await ProductSpreadsheetService.generate(7, 'produtos', {
      search: 'mochila', habilitado: 'S', site: 'N', promocao: 'S', categorias: [2, 5],
    });
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('p.id_empresa = ?');
    expect(sql).toContain('p.habilitado = ?');
    expect(sql).toContain('p.site = ?');
    expect(sql).toContain('p.promocao = ?');
    expect(sql).toContain('acp.id_categoria IN (?,?)');
    expect(values).toEqual([7, '%mochila%', '%mochila%', 'S', 'N', 'S', 2, 5, 1000, 0]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    const sheet = workbook.getWorksheet('Produtos')!;
    const headers = (sheet.getRow(1).values as string[]);
    expect(sheet.getRow(2).getCell(headers.indexOf('url_imagem_principal')).value).toBe('https://example.com/main.jpg');
    expect(sheet.getRow(2).getCell(headers.indexOf('codigo')).value).toBe('=1+1');
  });

  it('exports one row per association without applying general filters', async () => {
    query.mockResolvedValueOnce([
      { id_empresa: 7, id_produto: 12, vinculo_id: 2, vinculo_nome: 'Viagem' },
      { id_empresa: 7, id_produto: 12, vinculo_id: 5, vinculo_nome: 'Escola' },
    ]);
    const file = await ProductSpreadsheetService.generate(7, 'categorias', { site: 'S' });
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('INNER JOIN aux_categorias_produtos');
    expect(sql).not.toContain('p.site = ?');
    expect(values).toEqual([7, 1000, 0]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    const sheet = workbook.getWorksheet('Produtos')!;
    expect(sheet.rowCount).toBe(3);
    const headers = sheet.getRow(1).values as string[];
    expect(sheet.getRow(2).getCell(headers.indexOf('vinculo_nome')).value).toBe('Viagem');
    expect(sheet.getRow(3).getCell(headers.indexOf('vinculo_nome')).value).toBe('Escola');
  });
});
