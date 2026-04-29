import { ProdutoModel } from '@models/Produto';
import type { Produto, CreateProdutoDTO, UpdateProdutoDTO } from '@/types/produto';
import { throwError } from '@utils/helpers';

export class ProdutoService {
  static async createProduto(
    empresaId: number,
    data: CreateProdutoDTO
  ): Promise<Produto> {
    const existente = await ProdutoModel.searchByCodigo(empresaId, data.codigo);
    if (existente) {
      throwError('DUPLICATE_CODIGO', 'Produto com esse código já existe', 409);
    }

    const id = await ProdutoModel.create(empresaId, data);
    const produto = await ProdutoModel.findById(empresaId, id);

    if (!produto) {
      throwError('CREATE_FAILED', 'Falha ao criar produto', 500);
    }

    return produto as Produto;
  }

  static async getProdutoById(
    empresaId: number,
    produtoId: number
  ): Promise<Produto> {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);
    }

    return produto as Produto;
  }

  static async listProdutos(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ items: Produto[]; total: number; page: number; limit: number }> {
    const { items, total } = await ProdutoModel.findAll(
      empresaId,
      page,
      limit,
      search
    );

    return {
      items,
      total,
      page,
      limit,
    };
  }

  static async updateProduto(
    empresaId: number,
    produtoId: number,
    data: UpdateProdutoDTO
  ): Promise<Produto> {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);
    }

    if (data.codigo && data.codigo !== produto?.codigo) {
      const existente = await ProdutoModel.searchByCodigo(
        empresaId,
        data.codigo
      );
      if (existente) {
        throwError('DUPLICATE_CODIGO', 'Código de produto já existe', 409);
      }
    }

    await ProdutoModel.update(empresaId, produtoId, data);
    const updated = await ProdutoModel.findById(empresaId, produtoId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar produto', 500);
    }

    return updated as Produto;
  }

  static async deleteProduto(
    empresaId: number,
    produtoId: number
  ): Promise<void> {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);
    }

    const success = await ProdutoModel.delete(empresaId, produtoId);

    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar produto', 500);
    }
  }
}
