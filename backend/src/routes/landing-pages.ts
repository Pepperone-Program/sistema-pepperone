import { Router } from 'express';
import { query } from '@database/connection';
import { authMiddleware, AuthenticatedRequest } from '@middleware/auth';
import { errorResponse, paginatedResponse, successResponse } from '@utils/response';

const router = Router();
router.use(authMiddleware);

function values(body: Record<string, unknown>) {
  const titulo = String(body.titulo || '').trim();
  const url = String(body.url || '').trim();
  const descricao = String(body.descricao || '').trim();
  const habilitado = body.habilitado === 'N' ? 'N' : 'S';
  try {
    const parsed = new URL(url);
    if (!titulo || !['http:', 'https:'].includes(parsed.protocol)) return null;
  } catch { return null; }
  if (titulo.length > 255 || url.length > 2048 || descricao.length > 60000) return null;
  return { titulo, url, descricao, habilitado };
}

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '10'), 10) || 10));
    const search = `%${String(req.query.search || '').trim()}%`;
    const args: Array<string | number> = [req.user!.id_empresa, search, search];
    let where = 'WHERE id_empresa = ? AND (titulo LIKE ? OR url LIKE ?)';
    if (req.query.habilitado === 'S' || req.query.habilitado === 'N') {
      where += ' AND habilitado = ?';
      args.push(req.query.habilitado);
    }
    const counts = await query(`SELECT COUNT(*) AS total FROM landing_pages ${where}`, args) as Array<{ total: number }>;
    const rows = await query(`SELECT id_landing_page, titulo, url, descricao, habilitado FROM landing_pages ${where} ORDER BY id_landing_page DESC LIMIT ? OFFSET ?`, [...args, limit, (page - 1) * limit]);
    paginatedResponse(res, rows as unknown[], Number(counts[0].total), page, limit);
  } catch (error) { errorResponse(res, 'LANDING_LIST_ERROR', (error as Error).message, 500); }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  const data = values(req.body);
  if (!data) { errorResponse(res, 'INVALID_LANDING', 'Informe um título e uma URL HTTP ou HTTPS válida.', 400); return; }
  try {
    const result = await query('INSERT INTO landing_pages (id_empresa, titulo, url, descricao, habilitado) VALUES (?, ?, ?, ?, ?)', [req.user!.id_empresa, data.titulo, data.url, data.descricao, data.habilitado]) as { insertId: number };
    successResponse(res, { id_landing_page: result.insertId, ...data }, 'Landing page criada', 201);
  } catch (error) { errorResponse(res, 'LANDING_CREATE_ERROR', (error as Error).message, 500); }
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const data = values(req.body);
  const id = Number(req.params.id);
  if (!data || !Number.isSafeInteger(id) || id < 1) { errorResponse(res, 'INVALID_LANDING', 'Informe dados válidos.', 400); return; }
  try {
    const result = await query('UPDATE landing_pages SET titulo = ?, url = ?, descricao = ?, habilitado = ? WHERE id_empresa = ? AND id_landing_page = ?', [data.titulo, data.url, data.descricao, data.habilitado, req.user!.id_empresa, id]) as { affectedRows: number };
    if (!result.affectedRows) { errorResponse(res, 'NOT_FOUND', 'Landing page não encontrada.', 404); return; }
    successResponse(res, { id_landing_page: id, ...data });
  } catch (error) { errorResponse(res, 'LANDING_UPDATE_ERROR', (error as Error).message, 500); }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { errorResponse(res, 'INVALID_ID', 'Identificador inválido.', 400); return; }
  try {
    const result = await query('DELETE FROM landing_pages WHERE id_empresa = ? AND id_landing_page = ?', [req.user!.id_empresa, id]) as { affectedRows: number };
    if (!result.affectedRows) { errorResponse(res, 'NOT_FOUND', 'Landing page não encontrada.', 404); return; }
    successResponse(res, { id_landing_page: id });
  } catch (error) { errorResponse(res, 'LANDING_DELETE_ERROR', (error as Error).message, 500); }
});

export default router;
