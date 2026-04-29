import { Router } from 'express';
import { CategoriaController } from '@controllers/CategoriaController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { categoriaSchema, vincularProdutoSchema } from '@utils/validation';

const router = Router();
const updateCategoriaSchema = categoriaSchema.fork(
  Object.keys(categoriaSchema.describe().keys),
  (schema) => schema.optional()
);

router.post(
  '/',
  authMiddleware,
  validationMiddleware(categoriaSchema),
  CategoriaController.create
);

router.get(
  '/',
  authMiddleware,
  CategoriaController.list
);

router.get(
  '/:id/subcategorias',
  authMiddleware,
  CategoriaController.listSubcategorias
);

router.get(
  '/:id/produtos',
  authMiddleware,
  CategoriaController.listProdutos
);

router.post(
  '/:id/produtos',
  authMiddleware,
  validationMiddleware(vincularProdutoSchema),
  CategoriaController.vincularProduto
);

router.delete(
  '/:id/produtos/:produtoId',
  authMiddleware,
  CategoriaController.desvincularProduto
);

router.get(
  '/:id',
  authMiddleware,
  CategoriaController.getById
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateCategoriaSchema),
  CategoriaController.update
);

router.delete(
  '/:id',
  authMiddleware,
  CategoriaController.delete
);

export default router;
