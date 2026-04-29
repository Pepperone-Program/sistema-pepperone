import { PublicoAlvoModel } from '@models/PublicoAlvo';
import type {
  CreatePublicoAlvoDTO,
  PublicoAlvo,
  PublicoAlvoProduto,
  UpdatePublicoAlvoDTO,
  VincularPublicoAlvoProdutoDTO,
} from '@/types/publico-alvo';
import { throwError } from '@utils/helpers';

export class PublicoAlvoService {
  static async createPublicoAlvo(data: CreatePublicoAlvoDTO): Promise<PublicoAlvo> {
    if (data.id_publico_alvo !== undefined) {
      const existentePorId = await PublicoAlvoModel.findById(data.id_publico_alvo);
      if (existentePorId) {
        throwError('DUPLICATE_PUBLICO_ALVO_ID', 'Publico-alvo com esse ID ja existe', 409);
      }
    }

    const existente = await PublicoAlvoModel.findByName(data.publico_alvo);
    if (existente) {
      throwError('DUPLICATE_PUBLICO_ALVO', 'Publico-alvo ja existe', 409);
    }

    const id = await PublicoAlvoModel.create(data);
    const publicoAlvo = await PublicoAlvoModel.findById(id);

    if (!publicoAlvo) {
      throwError('CREATE_FAILED', 'Falha ao criar publico-alvo', 500);
    }

    return publicoAlvo as PublicoAlvo;
  }

  static async getPublicoAlvoById(publicoAlvoId: number): Promise<PublicoAlvo> {
    const publicoAlvo = await PublicoAlvoModel.findById(publicoAlvoId);

    if (!publicoAlvo) {
      throwError('PUBLICO_ALVO_NOT_FOUND', 'Publico-alvo nao encontrado', 404);
    }

    return publicoAlvo as PublicoAlvo;
  }

  static async listPublicosAlvos(
    page: number = 1,
    limit: number = 10,
    search?: string,
    habilitado?: string
  ): Promise<{ items: PublicoAlvo[]; total: number; page: number; limit: number }> {
    const { items, total } = await PublicoAlvoModel.findAll(
      page,
      limit,
      search,
      habilitado
    );

    return { items, total, page, limit };
  }

  static async updatePublicoAlvo(
    publicoAlvoId: number,
    data: UpdatePublicoAlvoDTO
  ): Promise<PublicoAlvo> {
    const publicoAlvo = await this.getPublicoAlvoById(publicoAlvoId);

    if (data.publico_alvo && data.publico_alvo !== publicoAlvo.publico_alvo) {
      const existente = await PublicoAlvoModel.findByName(data.publico_alvo);
      if (existente && existente.id_publico_alvo !== publicoAlvoId) {
        throwError('DUPLICATE_PUBLICO_ALVO', 'Publico-alvo ja existe', 409);
      }
    }

    await PublicoAlvoModel.update(publicoAlvoId, data);
    const updated = await PublicoAlvoModel.findById(publicoAlvoId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar publico-alvo', 500);
    }

    return updated as PublicoAlvo;
  }

  static async deletePublicoAlvo(publicoAlvoId: number): Promise<void> {
    await this.getPublicoAlvoById(publicoAlvoId);

    if (await PublicoAlvoModel.hasProdutos(publicoAlvoId)) {
      throwError(
        'PUBLICO_ALVO_HAS_PRODUTOS',
        'Publico-alvo possui produtos vinculados',
        409
      );
    }

    const success = await PublicoAlvoModel.delete(publicoAlvoId);
    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar publico-alvo', 500);
    }
  }

  static async vincularProduto(
    empresaId: number,
    publicoAlvoId: number,
    data: VincularPublicoAlvoProdutoDTO
  ): Promise<PublicoAlvoProduto> {
    await this.getPublicoAlvoById(publicoAlvoId);

    if (!(await PublicoAlvoModel.produtoExists(empresaId, data.id_produto))) {
      throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
    }

    const existente = await PublicoAlvoModel.findProdutoLink(
      publicoAlvoId,
      data.id_produto
    );

    if (existente) {
      return existente;
    }

    return PublicoAlvoModel.addProduto(publicoAlvoId, data.id_produto);
  }

  static async desvincularProduto(
    publicoAlvoId: number,
    produtoId: number
  ): Promise<void> {
    await this.getPublicoAlvoById(publicoAlvoId);
    const success = await PublicoAlvoModel.removeProduto(publicoAlvoId, produtoId);

    if (!success) {
      throwError(
        'VINCULO_NOT_FOUND',
        'Vinculo entre publico-alvo e produto nao encontrado',
        404
      );
    }
  }

  static async listProdutos(
    publicoAlvoId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: PublicoAlvoProduto[]; total: number; page: number; limit: number }> {
    await this.getPublicoAlvoById(publicoAlvoId);
    const { items, total } = await PublicoAlvoModel.findProdutos(
      publicoAlvoId,
      page,
      limit
    );

    return { items, total, page, limit };
  }
}
