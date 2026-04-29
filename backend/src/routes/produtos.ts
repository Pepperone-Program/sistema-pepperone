import { Router } from 'express';
import { ProdutoController } from '@controllers/ProdutoController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { productSchema } from '@utils/validation';

const router = Router();

router.post(
  '/',
  authMiddleware,
  validationMiddleware(productSchema),
  ProdutoController.create
);

router.get(
  '/:id',
  authMiddleware,
  ProdutoController.getById
);

router.get(
  '/',
  authMiddleware,
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
