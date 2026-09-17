"use client";

import { CategoryProductsModal } from "./category-products-modal";

export function SubcategoryProductsModal({
  subcategoryId,
  subcategoryName,
  onClose,
}: {
  subcategoryId: number;
  subcategoryName: string;
  onClose: () => void;
}) {
  return (
    <CategoryProductsModal
      categoryId={subcategoryId}
      categoryName={subcategoryName}
      entityLabel="subcategoria"
      onClose={onClose}
      productsEndpoint={`/api/v1/subcategorias/${subcategoryId}/produtos`}
    />
  );
}
