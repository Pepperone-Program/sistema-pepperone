import fs from 'node:fs/promises';
import path from 'node:path';
import { closeDatabasePool, getConnection } from '@database/connection';

type SourceProduct = {
  codigo?: unknown;
  descricao?: unknown;
};

type ProductDescription = {
  codigo: string;
  descricao: string;
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'docs', 'Pepperone_Produtos_Corrigidos.json');
const INSERT_BATCH_SIZE = 100;

function readArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function usage(): never {
  console.error(
    'Uso: npm run products:descriptions:update -- --empresa-id=1 --execute\n' +
      'Opcional: --file=caminho/do/arquivo.json\n' +
      'Sem --execute o script apenas valida e mostra a previsao.'
  );
  process.exit(1);
}

function parseEmpresaId(): number {
  const value = readArgument('empresa-id') ?? process.env.PRODUCT_DESCRIPTIONS_EMPRESA_ID;
  const empresaId = Number(value);

  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    usage();
  }

  return empresaId;
}

async function loadDescriptions(filePath: string): Promise<ProductDescription[]> {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('O JSON precisa ser um array de produtos.');
  }

  const descriptions: ProductDescription[] = [];
  const seenCodes = new Set<string>();

  parsed.forEach((item, index) => {
    const product = item as SourceProduct;
    const codigo = typeof product.codigo === 'string' ? product.codigo.trim() : '';
    const descricao = typeof product.descricao === 'string' ? product.descricao : '';
    const normalizedCode = codigo.toLocaleLowerCase('pt-BR');

    if (!codigo || !descricao.trim()) {
      throw new Error(`Registro ${index + 1} sem codigo ou descricao valida.`);
    }
    if (seenCodes.has(normalizedCode)) {
      throw new Error(`Codigo duplicado no JSON: ${codigo}`);
    }

    seenCodes.add(normalizedCode);
    descriptions.push({ codigo, descricao });
  });

  if (!descriptions.length) {
    throw new Error('O JSON nao contem produtos para atualizar.');
  }

  return descriptions;
}

async function main(): Promise<void> {
  const empresaId = parseEmpresaId();
  const execute = hasFlag('execute');
  const filePath = path.resolve(readArgument('file') || DEFAULT_FILE);
  const descriptions = await loadDescriptions(filePath);
  const connection = await getConnection();

  try {
    await connection.execute(`
      CREATE TEMPORARY TABLE descricao_produto_importacao (
        codigo VARCHAR(255) NOT NULL PRIMARY KEY,
        descricao MEDIUMTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    for (let index = 0; index < descriptions.length; index += INSERT_BATCH_SIZE) {
      const batch = descriptions.slice(index, index + INSERT_BATCH_SIZE);
      const placeholders = batch.map(() => '(?, ?)').join(', ');
      const values = batch.flatMap(({ codigo, descricao }) => [codigo, descricao]);
      await connection.execute(
        `INSERT INTO descricao_produto_importacao (codigo, descricao) VALUES ${placeholders}`,
        values
      );
    }

    const [summaryRows] = await connection.query(`
      SELECT
        COUNT(*) AS total_json,
        COUNT(p.id_produto) AS encontrados,
        COALESCE(SUM(NOT (p.descricao <=> d.descricao)), 0) AS alteracoes
      FROM descricao_produto_importacao d
      LEFT JOIN produtos p
        ON p.id_empresa = ?
       AND p.codigo = d.codigo
    `, [empresaId]);
    const summary = (summaryRows as Array<{ total_json: number; encontrados: number; alteracoes: number }>)[0];

    const [missingRows] = await connection.query(`
      SELECT d.codigo
      FROM descricao_produto_importacao d
      LEFT JOIN produtos p
        ON p.id_empresa = ?
       AND p.codigo = d.codigo
      WHERE p.id_produto IS NULL
      ORDER BY d.codigo
      LIMIT 20
    `, [empresaId]);

    const [duplicateRows] = await connection.query(`
      SELECT d.codigo, COUNT(p.id_produto) AS quantidade
      FROM descricao_produto_importacao d
      INNER JOIN produtos p
        ON p.id_empresa = ?
       AND p.codigo = d.codigo
      GROUP BY d.codigo
      HAVING COUNT(p.id_produto) > 1
      ORDER BY d.codigo
      LIMIT 20
    `, [empresaId]);

    const missing = missingRows as Array<{ codigo: string }>;
    const duplicates = duplicateRows as Array<{ codigo: string; quantidade: number }>;
    console.log(JSON.stringify({
      arquivo: filePath,
      empresa_id: empresaId,
      total_json: Number(summary.total_json),
      encontrados: Number(summary.encontrados),
      nao_encontrados: Number(summary.total_json) - Number(summary.encontrados),
      descricoes_a_alterar: Number(summary.alteracoes),
      amostra_nao_encontrados: missing.map(({ codigo }) => codigo),
      codigos_duplicados_no_banco: duplicates,
      modo: execute ? 'execucao' : 'simulacao',
    }, null, 2));

    if (missing.length || duplicates.length) {
      throw new Error('Atualizacao cancelada: existem codigos ausentes ou duplicados no banco.');
    }

    if (!execute) {
      return;
    }

    await connection.beginTransaction();
    try {
      const [result] = await connection.execute(`
        UPDATE produtos p
        INNER JOIN descricao_produto_importacao d ON d.codigo = p.codigo
        SET p.descricao = d.descricao,
            p.data_modificacao = NOW()
        WHERE p.id_empresa = ?
          AND NOT (p.descricao <=> d.descricao)
      `, [empresaId]);
      await connection.commit();
      console.log(JSON.stringify({ atualizados: Number((result as { affectedRows: number }).affectedRows) }));
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    connection.release();
    await closeDatabasePool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
