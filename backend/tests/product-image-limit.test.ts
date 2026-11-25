import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/models/Produto', () => ({
  ProdutoModel: {
    findById: vi.fn(),
    findImagesByProductId: vi.fn(),
    insertImage: vi.fn(),
  },
}));

import { ProdutoModel } from '../src/models/Produto';
import { MAX_PRODUCT_IMAGES, ProdutoImageService } from '../src/services/ProdutoImageService';

const image = { mimetype: 'image/jpeg', buffer: Buffer.from('image') } as Express.Multer.File;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ProdutoModel.findById).mockResolvedValue({ id_produto: 9 } as never);
});

describe('product image limit', () => {
  it('rejects uploads that would exceed 15 images before writing to storage', async () => {
    expect(MAX_PRODUCT_IMAGES).toBe(15);
    vi.mocked(ProdutoModel.findImagesByProductId).mockResolvedValue(Array(14).fill({}) as never);
    await expect(ProdutoImageService.upload(7, 9, [image, image])).rejects.toMatchObject({
      code: 'PRODUCT_IMAGE_LIMIT', statusCode: 400,
    });
    expect(ProdutoModel.insertImage).not.toHaveBeenCalled();
  });

  it('rejects an additional image when the product already has 15', async () => {
    vi.mocked(ProdutoModel.findImagesByProductId).mockResolvedValue(Array(15).fill({}) as never);
    await expect(ProdutoImageService.upload(7, 9, [image])).rejects.toMatchObject({
      code: 'PRODUCT_IMAGE_LIMIT', statusCode: 400,
    });
    expect(ProdutoModel.insertImage).not.toHaveBeenCalled();
  });
});
