import { Router } from 'express';
import { ProdutoController } from '@controllers/ProdutoController';
import { authMiddleware, authIfPresentMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { productSchema } from '@utils/validation';
import multer from 'multer';
import { SearchController } from '@controllers/SearchController';
import { ProductSpreadsheetService, type SpreadsheetModel } from '@services/ProductSpreadsheetService';

const router = Router();
const spreadsheetModels = new Set<SpreadsheetModel>(['produtos', 'categorias', 'subcategorias', 'publicos-alvos']);

router.get('/planilhas/:modelo', authMiddleware, async (req, res) => {
  try {
    const model = req.params.modelo as SpreadsheetModel;
    if (!spreadsheetModels.has(model)) {
      res.status(400).json({ success: false, message: 'Modelo de planilha inválido' });
      return;
    }
    const getText = (key: string) => typeof req.query[key] === 'string' ? String(req.query[key]).trim() : '';
    const search = getText('search');
    if (search.length > 200) {
      res.status(400).json({ success: false, message: 'A busca deve ter até 200 caracteres' });
      return;
    }
    const filters: { search?: string; habilitado?: string; site?: string; promocao?: string; categorias?: number[] } = {};
    if (model === 'produtos') {
      filters.search = search;
      for (const field of ['habilitado', 'site', 'promocao'] as const) {
        const value = getText(field);
        if (value && value !== 'S' && value !== 'N') {
          res.status(400).json({ success: false, message: `Filtro ${field} inválido` });
          return;
        }
        filters[field] = value;
      }
      const rawCategories = getText('categorias');
      if (rawCategories) {
        const parts = rawCategories.split(',');
        if (parts.length > 100 || parts.some((part) => !/^[1-9]\d*$/.test(part) || !Number.isSafeInteger(Number(part)))) {
          res.status(400).json({ success: false, message: 'Categorias inválidas' });
          return;
        }
        filters.categorias = [...new Set(parts.map(Number))];
      }
    }
    const empresaId = (req as import('@middleware/auth').AuthenticatedRequest).user?.id_empresa;
    if (!empresaId) {
      res.status(403).json({ success: false, message: 'Empresa não identificada' });
      return;
    }
    const file = await ProductSpreadsheetService.generate(empresaId, model, filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="produtos-${model}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(file);
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Falha ao gerar planilha' });
  }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 8,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Apenas imagens sao permitidas'));
  },
});

router.post(
  '/',
  authIfPresentMiddleware,
  validationMiddleware(productSchema),
  ProdutoController.create
);

router.get(
  '/:id/images',
  authIfPresentMiddleware,
  ProdutoController.listImages
);

router.get(
  '/:id/links',
  authIfPresentMiddleware,
  ProdutoController.listLinks
);

router.post(
  '/:id/images',
  authMiddleware,
  upload.array('images', 8),
  ProdutoController.uploadImages
);

router.put(
  '/:id/images/reorder',
  authMiddleware,
  ProdutoController.reorderImages
);

router.get(
  '/:id/images/:filename/view',
  authMiddleware,
  ProdutoController.viewImage
);

router.delete(
  '/:id/images/:filename',
  authMiddleware,
  ProdutoController.removeImage
);

router.get(
  '/site/busca',
  ProdutoController.searchSite
);

router.get(
  '/site',
  ProdutoController.listSite
);

router.get('/search/debug', authMiddleware, SearchController.debug);
router.get('/search/metrics', authMiddleware, SearchController.metrics);
router.get('/search/dictionary', authMiddleware, SearchController.listDictionary);
router.post('/search/dictionary', authMiddleware, SearchController.upsertDictionary);
router.delete('/search/dictionary/:id', authMiddleware, SearchController.deleteDictionary);
router.post('/search/events', SearchController.recordInteraction);

router.get(
  '/:id',
  authIfPresentMiddleware,
  ProdutoController.getById
);

router.get(
  '/',
  authIfPresentMiddleware,
  ProdutoController.list
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(productSchema.fork(
    Object.keys(productSchema.describe().keys),
    (schema) => schema.optional()
  )),
  ProdutoController.update
);

router.delete(
  '/:id',
  authMiddleware,
  ProdutoController.delete
);

export default router;

