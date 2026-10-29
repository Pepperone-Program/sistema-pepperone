import { Router } from 'express';
import { query } from '@database/connection';
import { authMiddleware, AuthenticatedRequest } from '@middleware/auth';
import { errorResponse, successResponse } from '@utils/response';

const router = Router();

// The union makes a product a member of its direct categories and of the
// parent categories of its subcategories, without counting the pair twice.
const membership = `(
  SELECT id_empresa, id_categoria, id_produto FROM aux_categorias_produtos
  UNION
  SELECT asp.id_empresa, s.id_categoria, asp.id_produto
  FROM aux_subcategorias_produtos asp
  INNER JOIN subcategorias s ON s.id_empresa = asp.id_empresa AND s.id_subcategoria = asp.id_subcategoria
) membership`;

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const empresaId = req.user!.id_empresa;
  try {
    const clock = await query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
    const today = (clock as Array<{ today: string }>)[0].today;
    const defaultStart = new Date(`${today}T00:00:00Z`);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
    const start = typeof req.query.start === 'string' ? req.query.start : defaultStart.toISOString().slice(0, 10);
    const end = typeof req.query.end === 'string' ? req.query.end : today;
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validDate(start) || !validDate(end)) { errorResponse(res, 'INVALID_DATE', 'Informe datas válidas.', 400); return; }
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const dayCount = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (dayCount < 1 || dayCount > 366) { errorResponse(res, 'INVALID_RANGE', 'Escolha um período de até 366 dias.', 400); return; }
    const exclusiveEnd = new Date(endDate);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    const [quoted, products, daily, totals] = await Promise.all([
      query(`SELECT c.id_categoria, c.categoria, COUNT(DISTINCT o.id_orcamento) AS total
        FROM orcamentos o
        JOIN orcamentos_itens oi ON oi.id_orcamento = o.id_orcamento
        JOIN ${membership} ON membership.id_empresa = o.id_empresa AND membership.id_produto = oi.id_produto
        JOIN categorias c ON c.id_empresa = membership.id_empresa AND c.id_categoria = membership.id_categoria
        WHERE o.id_empresa = ? GROUP BY c.id_categoria, c.categoria
        ORDER BY total DESC, c.categoria ASC LIMIT 10`, [empresaId]),
      query(`SELECT c.id_categoria, c.categoria, COUNT(DISTINCT p.id_produto) AS total
        FROM ${membership}
        JOIN produtos p ON p.id_empresa = membership.id_empresa AND p.id_produto = membership.id_produto
        JOIN categorias c ON c.id_empresa = membership.id_empresa AND c.id_categoria = membership.id_categoria
        WHERE membership.id_empresa = ? GROUP BY c.id_categoria, c.categoria
        ORDER BY total DESC, c.categoria ASC LIMIT 10`, [empresaId]),
      query(`SELECT DATE_FORMAT(data_orcamento, '%Y-%m-%d') AS dia, COUNT(*) AS total
        FROM orcamentos WHERE id_empresa = ? AND data_orcamento >= ?
        AND data_orcamento < ?
        GROUP BY DATE(data_orcamento) ORDER BY dia`, [empresaId, start, exclusiveEnd.toISOString().slice(0, 10)]),
      query(`SELECT
        (SELECT COUNT(*) FROM produtos WHERE id_empresa = ?) AS produtos,
        (SELECT COUNT(*) FROM categorias WHERE id_empresa = ?) AS categorias,
        (SELECT COUNT(*) FROM orcamentos WHERE id_empresa = ?) AS orcamentos,
        (SELECT COUNT(*) FROM banners WHERE id_empresa = ? AND habilitado = 'S') AS banners_ativos`, [empresaId, empresaId, empresaId, empresaId]),
    ]);
    const dailyTotals = new Map((daily as Array<{ dia: string; total: number }>).map(row => [row.dia, Number(row.total)]));
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + index);
      const dia = date.toISOString().slice(0, 10);
      return { dia, total: dailyTotals.get(dia) || 0 };
    });
    const indicators = (totals as Array<{ produtos: number; categorias: number; orcamentos: number; banners_ativos: number }>)[0];
    successResponse(res, { categorias_orcamentos: quoted, categorias_produtos: products, orcamentos_dia: days, indicadores: {
      produtos: Number(indicators.produtos), categorias: Number(indicators.categorias),
      orcamentos: Number(indicators.orcamentos), banners_ativos: Number(indicators.banners_ativos),
    } });
  } catch (error) {
    const err = error as Error;
    errorResponse(res, 'DASHBOARD_ERROR', err.message, 500);
  }
});

export default router;
