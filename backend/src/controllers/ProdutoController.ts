import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { ProdutoService } from '@services/ProdutoService';
import { successResponse, paginatedResponse, errorResponse } from '@utils/response';

export class ProdutoController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const produto = await ProdutoService.createProduto(
        empresaId,
        req.body
      );

      successResponse(res, produto, 'Produto criado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const produto = await ProdutoService.getProdutoById(
        empresaId,
        parseInt(id, 10)
      );

      successResponse(res, produto);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const search = req.query.search as string | undefined;

      const result = await ProdutoService.listProdutos(
        empresaId,
        page,
        limit,
        search
      );

      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Produtos listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const produto = await ProdutoService.updateProduto(
        empresaId,
        parseInt(id, 10),
        req.body
      );

      successResponse(res, produto, 'Produto atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      await ProdutoService.deleteProduto(
        empresaId,
        parseInt(id, 10)
      );

      successResponse(res, null, 'Produto deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
