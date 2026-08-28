import { createHash } from 'crypto';
import { getConnection } from '@database/connection';
import type { Produto } from '@/types/produto';
import { SEARCH_DOCUMENT_VERSION } from '@config/search';
import { normalizeComparable } from './QueryNormalizer';
import { QueryParser } from './QueryParser';

const canonicalizeType = (value: string): string | null => {
  const first = normalizeComparable(value).split(' ')[0];
  if (!first) return null;
  return first.length > 3 && first.endsWith('s') ? first.slice(0, -1) : first;
};

export class SearchDocumentService {
  static async syncProduct(empresaId: number, product: Produto): Promise<void> {
    await this.syncProducts(empresaId, [product]);
  }

  static async syncProducts(empresaId: number, products: Produto[]): Promise<void> {
    if (!products.length) return;
    const connection = await getConnection();
    const execute = async (sql: string, values: Array<string | number | null> = []): Promise<unknown> => (await connection.execute(sql, values))[0];
    await connection.beginTransaction();
    try {
    const typeIds = Array.from(new Set(products.map((product) => Number(product.id_tipo_produto))));
    const placeholders = typeIds.map(() => '?').join(',');
    const typeRows = await execute(`SELECT id_tipo_produto, tipo_produto FROM tipos_produtos WHERE id_empresa = ? AND id_tipo_produto IN (${placeholders})`, [empresaId, ...typeIds]) as Array<{ id_tipo_produto: number; tipo_produto: string }>;
    const types = new Map(typeRows.map((row) => [Number(row.id_tipo_produto), canonicalizeType(row.tipo_produto)]));
    const parsedByProduct = new Map(products.map((product) => [Number(product.id_produto), QueryParser.parse(`${product.produto || ''} ${product.descricao || ''}`)]));
    const rows = products.map((product) => {
      const canonicalType = types.get(Number(product.id_tipo_produto)) || null;
      const name = normalizeComparable(product.produto || '');
      const searchText = [name, normalizeComparable(product.descricao || ''), normalizeComparable(product.codigo || ''), canonicalType].filter(Boolean).join(' ').slice(0, 16000);
      const sourceHash = createHash('sha256').update(JSON.stringify([product.produto, product.descricao, product.codigo, product.id_tipo_produto, product.site, product.habilitado])).digest('hex');
      const parsed = parsedByProduct.get(Number(product.id_produto))!;
      return [empresaId, product.id_produto, name, searchText, canonicalType, parsed.measurements.capacityMl || null,
        parsed.materials[0] || null, parsed.colors[0] || null, product.site === 'S' && product.habilitado === 'S' ? 1 : 0, sourceHash, SEARCH_DOCUMENT_VERSION];
    });
    const valueSql = rows.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',');
    await execute(`INSERT INTO product_search_documents
      (id_empresa,id_produto,name_search,search_text,canonical_product_type,capacity_ml,material_key,color_key,is_public,source_hash,document_version)
      VALUES ${valueSql} ON DUPLICATE KEY UPDATE name_search=VALUES(name_search), search_text=VALUES(search_text),
      canonical_product_type=VALUES(canonical_product_type), capacity_ml=VALUES(capacity_ml), material_key=VALUES(material_key), color_key=VALUES(color_key),
      is_public=VALUES(is_public), source_hash=VALUES(source_hash),
      document_version=VALUES(document_version), updated_at=CURRENT_TIMESTAMP`,
      rows.flat());

    const productIds = products.map((product) => Number(product.id_produto));
    const productPlaceholders = productIds.map(() => '?').join(',');
    await execute(`DELETE FROM product_search_attributes WHERE id_empresa = ? AND source = 'DERIVED' AND id_produto IN (${productPlaceholders})`, [empresaId, ...productIds]);
    const definitions = await execute(`SELECT id, attribute_key FROM search_attribute_definitions WHERE id_empresa = ? AND active = 1`, [empresaId]) as Array<{ id: number; attribute_key: string }>;
    const definitionIds = new Map(definitions.map((definition) => [definition.attribute_key, Number(definition.id)]));
    const attributeRows: Array<Array<string | number | null>> = [];
    for (const product of products) {
      const parsed = parsedByProduct.get(Number(product.id_produto))!;
      for (const constraint of parsed.constraints) {
        const definitionId = definitionIds.get(constraint.key);
        if (!definitionId || ['material', 'color', 'capacity_ml'].includes(constraint.key)) continue;
        attributeRows.push([empresaId, product.id_produto, definitionId,
          typeof constraint.value === 'string' ? constraint.value : null,
          typeof constraint.value === 'number' ? constraint.value : null,
          typeof constraint.value === 'boolean' ? Number(constraint.value) : null,
          constraint.confidence]);
      }
    }
    if (attributeRows.length) {
      const attributeSql = attributeRows.map(() => '(?,?,?,?,?,?,\'DERIVED\',?)').join(',');
      await execute(`INSERT INTO product_search_attributes
        (id_empresa,id_produto,attribute_definition_id,value_text,value_number,value_boolean,source,confidence)
        VALUES ${attributeSql} ON DUPLICATE KEY UPDATE
        value_text=IF(source='MANUAL',value_text,VALUES(value_text)), value_number=IF(source='MANUAL',value_number,VALUES(value_number)),
        value_boolean=IF(source='MANUAL',value_boolean,VALUES(value_boolean)), confidence=IF(source='MANUAL',confidence,VALUES(confidence)),
        source=IF(source='MANUAL',source,VALUES(source))`, attributeRows.flat());
    }

    await execute(`DELETE FROM product_contains_types WHERE id_empresa = ? AND source = 'DERIVED' AND id_produto IN (${productPlaceholders})`, [empresaId, ...productIds]);
    const containsRows: Array<Array<string | number | null>> = [];
    for (const product of products) {
      const parsed = parsedByProduct.get(Number(product.id_produto))!;
      for (const constraint of parsed.constraints.filter((item) => item.key.startsWith('contains:'))) {
        containsRows.push([empresaId, product.id_produto, constraint.key.slice('contains:'.length), Number(constraint.value), constraint.confidence]);
      }
    }
    if (containsRows.length) {
      const containsSql = containsRows.map(() => '(?,?,?,?,\'DERIVED\',?)').join(',');
      await execute(`INSERT INTO product_contains_types
        (id_empresa,id_produto,canonical_product_type,quantity,source,confidence) VALUES ${containsSql}
        ON DUPLICATE KEY UPDATE quantity=IF(source='MANUAL',quantity,VALUES(quantity)),
        confidence=IF(source='MANUAL',confidence,VALUES(confidence)), source=IF(source='MANUAL',source,VALUES(source))`, containsRows.flat());
    }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
