"use client";

import { apiFormRequest, apiRequest } from "@/lib/api";
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ProdutoImage = {
  id_imagem: number;
  id_produto: number;
  url_imagem: string;
  ordem_imagem: number;
  filename: string;
  ordem: number;
  url: string;
  version?: string;
  sources?: Array<"database">;
};

type Row = Record<string, unknown>;

type Props = {
  endpoint: string;
  produtoId: string | number;
  produtoNome?: unknown;
  onChanged?: () => Promise<void> | void;
};

export function ProductImagesPanel({
  endpoint,
  produtoId,
  produtoNome,
  onChanged,
}: Props) {
  const [images, setImages] = useState<ProdutoImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(
    new Set(),
  );
  const [error, setError] = useState("");

  const imageEndpoint = useMemo(
    () => `${endpoint}/${produtoId}/images`,
    [endpoint, produtoId],
  );

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<ProdutoImage[]>(imageEndpoint);
      setImages(response);
      setSelectedImageIds((current) => {
        const availableIds = new Set(response.map((image) => image.id_imagem));
        return new Set(
          [...current].filter((imageId) => availableIds.has(imageId)),
        );
      });
      setOrderChanged(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao carregar imagens",
      );
    } finally {
      setLoading(false);
    }
  }, [imageEndpoint]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  async function refreshAfterChange(nextImages: ProdutoImage[]) {
    setImages(nextImages);
    setSelectedImageIds((current) => {
      const availableIds = new Set(nextImages.map((image) => image.id_imagem));
      return new Set(
        [...current].filter((imageId) => availableIds.has(imageId)),
      );
    });
    setOrderChanged(false);
    await onChanged?.();
  }

  async function persistOrder() {
    setSaving(true);
    setError("");

    try {
      const response = await apiRequest<ProdutoImage[]>(
        `${imageEndpoint}/reorder`,
        {
          method: "PUT",
          body: JSON.stringify({
            imageIds: images.map((image) => image.id_imagem),
          }),
        },
      );
      await refreshAfterChange(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao reordenar imagens",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files = selectedFiles) {
    if (!files.length) return;

    setSaving(true);
    setError("");

    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));

    try {
      const response = await apiFormRequest<ProdutoImage[]>(
        imageEndpoint,
        formData,
      );
      setSelectedFiles([]);
      await refreshAfterChange(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagens");
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(image: ProdutoImage) {
    const confirmed = window.confirm(`Remover ${image.filename}?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiRequest<ProdutoImage[]>(
        `${imageEndpoint}/${encodeURIComponent(String(image.id_imagem))}`,
        { method: "DELETE" },
      );
      await refreshAfterChange(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover imagem");
    } finally {
      setSaving(false);
    }
  }

  function toggleImageSelection(imageId: number) {
    setSelectedImageIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  }

  function toggleAllImages() {
    setSelectedImageIds((current) => {
      if (current.size === images.length) return new Set();
      return new Set(images.map((image) => image.id_imagem));
    });
  }

  async function removeSelectedImages() {
    const imageIds = [...selectedImageIds];
    if (!imageIds.length) return;

    const confirmed = window.confirm(
      `Excluir ${imageIds.length} ${imageIds.length === 1 ? "imagem selecionada" : "imagens selecionadas"}?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");

    let failedCount = 0;
    for (const imageId of imageIds) {
      try {
        await apiRequest<ProdutoImage[]>(
          `${imageEndpoint}/${encodeURIComponent(String(imageId))}`,
          { method: "DELETE" },
        );
      } catch {
        failedCount += 1;
      }
    }

    try {
      await loadImages();
      await onChanged?.();
      if (failedCount) {
        setError(
          `${imageIds.length - failedCount} de ${imageIds.length} imagens foram excluídas. Tente novamente para as restantes.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao atualizar as imagens",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files || []));
  }

  function handleDropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    setSelectedFiles(files);
    handleUpload(files);
  }

  function moveImage(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const nextImages = [...images];
    const current = nextImages[index];
    nextImages[index] = nextImages[targetIndex];
    nextImages[targetIndex] = current;
    setImages(nextImages);
    setOrderChanged(true);
  }

  function handleDrop(targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const nextImages = [...images];
    const [moved] = nextImages.splice(draggedIndex, 1);
    nextImages.splice(targetIndex, 0, moved);
    setImages(nextImages);
    setOrderChanged(true);
    setDraggedIndex(null);
  }

  function getImageSrc(image: ProdutoImage) {
    const baseUrl = image.url || image.url_imagem;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}v=${encodeURIComponent(image.version || `${image.id_imagem}-${image.ordem_imagem}`)}`;
  }

  return (
    <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Produto #{produtoId}
        </p>
        <h2 className="mt-1 text-lg font-bold text-dark dark:text-white">
          Imagens do produto
        </h2>
        <p className="text-sm text-dark-4 dark:text-dark-6">
          {String(produtoNome || "Produto selecionado")}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <div
        className={`mb-4 rounded-md border border-dashed p-4 transition ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-stroke bg-gray-2 dark:border-dark-3 dark:bg-dark-2"
        }`}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDrop={handleDropFiles}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-dark dark:text-white">
              Adicionar imagens
            </p>
            <p className="text-xs text-dark-4 dark:text-dark-6">
              Arraste arquivos aqui ou selecione imagens para enviar ao storage
              e registrar na tabela.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-stroke bg-white px-3 py-2 text-xs font-semibold text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white">
              Selecionar
              <input
                accept="image/*"
                className="hidden"
                multiple
                onChange={handleFileInput}
                type="file"
              />
            </label>
            <button
              className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              disabled={saving || !selectedFiles.length}
              onClick={() => handleUpload()}
              type="button"
            >
              {saving
                ? "Enviando..."
                : `Enviar${selectedFiles.length ? ` (${selectedFiles.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>

      {images.length > 1 && (
        <div className="mb-4 flex flex-col gap-3 rounded-md border border-stroke bg-gray-2 p-3 dark:border-dark-3 dark:bg-dark-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-dark dark:text-white">
            {orderChanged
              ? "Ordem alterada. Salve para atualizar a tabela."
              : "Arraste pela alca para reordenar."}
          </span>
          <button
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
            disabled={saving || !orderChanged}
            onClick={persistOrder}
            type="button"
          >
            {saving ? "Salvando..." : "Salvar ordem"}
          </button>
        </div>
      )}

      {!!images.length && !loading && (
        <div className="mb-4 flex flex-col gap-3 rounded-md border border-stroke p-3 dark:border-dark-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-dark dark:text-white">
            <input
              checked={selectedImageIds.size === images.length}
              className="h-4 w-4 accent-primary"
              disabled={saving}
              onChange={toggleAllImages}
              type="checkbox"
            />
            Selecionar todas
            {selectedImageIds.size > 0 && (
              <span className="font-normal text-dark-4 dark:text-dark-6">
                ({selectedImageIds.size}{" "}
                {selectedImageIds.size === 1 ? "selecionada" : "selecionadas"})
              </span>
            )}
          </label>
          <button
            className="rounded-md border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
            disabled={saving || selectedImageIds.size === 0}
            onClick={removeSelectedImages}
            type="button"
          >
            {saving
              ? "Excluindo..."
              : `Excluir selecionadas${selectedImageIds.size ? ` (${selectedImageIds.size})` : ""}`}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-md border border-stroke px-4 py-6 text-center text-sm text-dark-4 dark:border-dark-3">
            Carregando imagens...
          </div>
        ) : images.length ? (
          images.map((image, index) => (
            <div
              className={`grid grid-cols-[24px_32px_72px_1fr] gap-3 rounded-md border p-3 transition ${
                selectedImageIds.has(image.id_imagem)
                  ? "border-primary bg-primary/5 dark:border-primary"
                  : "border-stroke dark:border-dark-3"
              } ${draggedIndex === index ? "border-primary bg-primary/5" : ""}`}
              draggable
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedIndex(index)}
              onDrop={() => handleDrop(index)}
              key={image.id_imagem}
            >
              <label className="flex h-[72px] cursor-pointer items-center justify-center">
                <input
                  aria-label={`Selecionar ${image.filename}`}
                  checked={selectedImageIds.has(image.id_imagem)}
                  className="h-4 w-4 accent-primary"
                  disabled={saving}
                  onChange={() => toggleImageSelection(image.id_imagem)}
                  type="checkbox"
                />
              </label>

              <button
                aria-label={`Arrastar ${image.filename}`}
                className="flex h-[72px] cursor-grab items-center justify-center rounded-md border border-stroke text-lg font-bold text-dark-4 active:cursor-grabbing dark:border-dark-3 dark:text-dark-6"
                type="button"
              >
                =
              </button>

              <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-md bg-gray-2 dark:bg-dark-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={image.filename}
                  className="h-full w-full object-cover"
                  src={getImageSrc(image)}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-dark dark:text-white">
                      {image.filename}
                    </p>
                    <p className="text-xs text-dark-4 dark:text-dark-6">
                      Ordem {index + 1}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-300"
                    disabled={saving}
                    onClick={() => removeImage(image)}
                    type="button"
                  >
                    Excluir
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-40 dark:border-dark-3"
                    disabled={saving || index === 0}
                    onClick={() => moveImage(index, -1)}
                    type="button"
                  >
                    Subir
                  </button>
                  <button
                    className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-40 dark:border-dark-3"
                    disabled={saving || index === images.length - 1}
                    onClick={() => moveImage(index, 1)}
                    type="button"
                  >
                    Descer
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-stroke px-4 py-6 text-center text-sm text-dark-4 dark:border-dark-3">
            Nenhuma imagem cadastrada na tabela imagens_produtos.
          </div>
        )}
      </div>
    </section>
  );
}

export type ProductImagePanelRow = Row;
