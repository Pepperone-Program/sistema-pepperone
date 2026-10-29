import { Router } from 'express';
import { TipoProdutoController } from '@controllers/TipoProdutoController';
import { authIfPresentMiddleware } from '@middleware/auth';

const router = Router();

router.get(
  '/',
  TipoProdutoController.list
);

router.get(
  '/habilitados',
  authIfPresentMiddleware,
  TipoProdutoController.listHabilitados
);

router.get(
  '/:id/catalogo',
  TipoProdutoController.catalogo
);

export default router;
