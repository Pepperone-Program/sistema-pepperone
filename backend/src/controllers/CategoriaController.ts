import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { CategoriaService, SubcategoriaService } from '@services/CategoriaService';
import { errorResponse, paginatedResponse, successResponse } from '@utils/response';

const getEmpresaId = (req: AuthenticatedRequest): number => req.user?.id_empresa || 1;
const getPage = (req: AuthenticatedRequest): number => parseInt((req.query.page as string) || '1', 10);
const getLimit = (req: AuthenticatedRequest): number => parseInt((req.query.limit as string) || '10', 10);

export class CategoriaController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categoria = await CategoriaService.createCategoria(getEmpresaId(req), req.body);
      successResponse(res, categoria, 'Categoria criada com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categoria = await CategoriaService.getCategoriaById(
        getEmpresaId(req),
        parseInt(req.params.id, 10)
      );
      successResponse(res, categoria);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await CategoriaService.listCategorias(
        getEmpresaId(req),
        getPage(req),
        getLimit(req),
        req.query.search as string | undefined,
        req.query.habilitado as string | undefined
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Categorias listadas com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categoria = await CategoriaService.updateCategoria(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      successResponse(res, categoria, 'Categoria atualizada com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await CategoriaService.deleteCategoria(getEmpresaId(req), parseInt(req.params.id, 10));
      successResponse(res, null, 'Categoria deletada com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listSubcategorias(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await SubcategoriaService.listSubcategorias(
        getEmpresaId(req),
        getPage(req),
        getLimit(req),
        req.query.search as string | undefined,
        parseInt(req.params.id, 10),
        req.query.habilitado as string | undefined
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Subcategorias listadas com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listProdutos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await CategoriaService.listProdutos(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        getPage(req),
        getLimit(req)
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Produtos da categoria listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async vincularProduto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const vinculo = await CategoriaService.vincularProduto(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      successResponse(res, vinculo, 'Produto vinculado a categoria com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async desvincularProduto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await CategoriaService.desvincularProduto(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        parseInt(req.params.produtoId, 10)
      );
      successResponse(res, null, 'Produto desvinculado da categoria com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}

export class SubcategoriaController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const subcategoria = await SubcategoriaService.createSubcategoria(
        getEmpresaId(req),
        req.body
      );
      successResponse(res, subcategoria, 'Subcategoria criada com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const subcategoria = await SubcategoriaService.getSubcategoriaById(
        getEmpresaId(req),
        parseInt(req.params.id, 10)
      );
      successResponse(res, subcategoria);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categoriaId = req.query.id_categoria
        ? parseInt(req.query.id_categoria as string, 10)
        : undefined;
      const result = await SubcategoriaService.listSubcategorias(
        getEmpresaId(req),
        getPage(req),
        getLimit(req),
        req.query.search as string | undefined,
        categoriaId,
        req.query.habilitado as string | undefined
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Subcategorias listadas com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const subcategoria = await SubcategoriaService.updateSubcategoria(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      successResponse(res, subcategoria, 'Subcategoria atualizada com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await SubcategoriaService.deleteSubcategoria(
        getEmpresaId(req),
        parseInt(req.params.id, 10)
      );
      successResponse(res, null, 'Subcategoria deletada com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listProdutos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await SubcategoriaService.listProdutos(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        getPage(req),
        getLimit(req)
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Produtos da subcategoria listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async vincularProduto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const vinculo = await SubcategoriaService.vincularProduto(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      successResponse(res, vinculo, 'Produto vinculado a subcategoria com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async desvincularProduto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await SubcategoriaService.desvincularProduto(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        parseInt(req.params.produtoId, 10)
      );
      successResponse(res, null, 'Produto desvinculado da subcategoria com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
