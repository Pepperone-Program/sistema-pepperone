import { Router } from 'express';
import { DataPromocionalController } from '@controllers/DataPromocionalController';
import { authMiddleware } from '@middleware/auth';
import { validationMiddleware } from '@middleware/validation';
import { dataPromocionalSchema, vincularProdutoSchema } from '@utils/validation';

const router = Router();
const updateDataPromocionalSchema = dataPromocionalSchema.fork(
  Object.keys(dataPromocionalSchema.describe().keys),
  (schema) => schema.optional()
);

router.post(
  '/',
  authMiddleware,
  validationMiddleware(dataPromocionalSchema),
  DataPromocionalController.create
);

router.get(
  '/',
  authMiddleware,
  DataPromocionalController.list
);

router.get(
  '/:id/produtos',
  authMiddleware,
  DataPromocionalController.listProdutos
);

router.post(
  '/:id/produtos',
  authMiddleware,
  validationMiddleware(vincularProdutoSchema),
  DataPromocionalController.vincularProduto
);

router.delete(
  '/:id/produtos/:produtoId',
  authMiddleware,
  DataPromocionalController.desvincularProduto
);

router.get(
  '/:id',
  authMiddleware,
  DataPromocionalController.getById
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateDataPromocionalSchema),
  DataPromocionalController.update
);

router.delete(
  '/:id',
  authMiddleware,
  DataPromocionalController.delete
);

export default router;
