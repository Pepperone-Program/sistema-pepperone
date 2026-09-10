import { promises as fs } from 'fs';
import path from 'path';

type CategoryContent = {
  name: string;
  titleH1: string;
  metaTitle: string;
  metaDescription: string;
  description: string;
};

const root = path.resolve(__dirname, '../..');
const documentPath = path.join(root, 'src/docs/titulos-descricoes-categorias-seo.md');
const migrationPath = path.join(root, 'migrations/005_category_seo_content.up.sql');

const categoryIds: Record<string, number> = {
  'Acessórios Veiculares': 36,
  'Blocos com Caneta': 22,
  'Blocos de Anotações': 4,
  'Blocos Ecológicos': 21,
  'Bolsas Térmicas': 28,
  'Brindes em Neoprene': 38,
  'Brindes Masculinos': 8,
  'Cadernos e Pastas': 20,
  'Caixas de Som': 25,
  'Canecas e Copos': 13,
  'Canetas Ecológicas': 50,
  'Canetas Metálicas': 30,
  'Canetas Plásticas': 7,
  'Carregadores Power Banks': 23,
  Chaveiros: 11,
  Coolers: 27,
  Copos: 3,
  Diversos: 41,
  Embalagens: 42,
  'Fabricação Própria': 47,
  Ferramentas: 14,
  'Fones de Ouvido': 24,
  'Gastronomia e Bar': 1,
  'Guarda-Chuva': 17,
  'Kits Bebida': 32,
  'Kits Churrasco': 31,
  'Kits Escritório': 15,
  'Kits Especiais': 43,
  'Kits Pizzas, Petiscos e Bar': 33,
  'Lápis e Acessórios': 35,
  'Linha Feminina': 5,
  'Linha Fitness e Academia': 29,
  'Linha Kids': 18,
  'Linha Pet': 9,
  Madeira: 37,
  'Mochilas, Malas e Bolsas Esportivas': 12,
  'Necessaires e Sacolas': 34,
  'Pen Drives': 6,
  'Porta Documentos': 16,
  'Porta Tênis': 48,
  'Squeezes e Garrafas': 26,
  'Tecnologia e Informática': 2,
  'Uso Pessoal': 10,
};

const descriptionToPlainText = (value: string): string =>
  value
    .trim()
    .replace(/^###\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1');

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const parseDocument = (markdown: string): CategoryContent[] => {
  const sections = markdown.split(/^## \d+\. /m).slice(1);
  return sections.map((section) => {
    const lines = section.split(/\r?\n/);
    const name = lines.shift()?.trim() || '';
    const field = (label: string): string => {
      const prefix = `- **${label}:** `;
      return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() || '';
    };
    const marker = lines.findIndex((line) => line.trim() === '**Descrição:**');
    const end = lines.findIndex((line, index) => index > marker && line.trim() === '---');
    const description = lines.slice(marker + 1, end === -1 ? undefined : end).join('\n').trim();
    return {
      name,
      titleH1: field('Título (H1)'),
      metaTitle: field('Meta title'),
      metaDescription: field('Meta description'),
      description,
    };
  });
};

const validateContent = (categories: CategoryContent[]): void => {
  if (categories.length !== 43) throw new Error(`Esperadas 43 categorias; encontradas ${categories.length}`);
  const ids = categories.map(({ name }) => categoryIds[name]);
  const missingMappings = categories.filter(({ name }) => !categoryIds[name]).map(({ name }) => name);
  if (missingMappings.length) throw new Error(`Categorias sem ID: ${missingMappings.join(', ')}`);
  if (new Set(ids).size !== 43) throw new Error('O mapa contém IDs duplicados');
  for (const category of categories) {
    if (!category.titleH1 || !category.metaTitle || !category.metaDescription || !category.description) {
      throw new Error(`Conteúdo incompleto para ${category.name}`);
    }
  }
};

const buildMigration = (categories: CategoryContent[]): string => {
  const updates = categories.map((category) => `UPDATE categorias
SET titulo_h1 = ${sqlString(category.titleH1)},
    meta_title = ${sqlString(category.metaTitle)},
    meta_description = ${sqlString(category.metaDescription)},
    descricao = ${sqlString(descriptionToPlainText(category.description))}
WHERE id_empresa = 1 AND id_categoria = ${categoryIds[category.name]};`);

  return `-- Conteúdo editorial e SEO das 43 categorias publicáveis da empresa 1.
-- A identificação usa IDs estáveis e nunca altera a coluna categoria.
ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS titulo_h1 VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS meta_description TEXT NULL;

${updates.join('\n\n')}
`;
};

const main = async (): Promise<void> => {
  const markdown = await fs.readFile(documentPath, 'utf8');
  const categories = parseDocument(markdown);
  validateContent(categories);
  const expected = buildMigration(categories);

  if (process.argv.includes('--write')) {
    await fs.writeFile(migrationPath, expected, 'utf8');
  } else {
    const actual = await fs.readFile(migrationPath, 'utf8');
    if (actual !== expected) throw new Error('A migration SEO está desatualizada em relação ao Markdown');
  }

  if (/\bSET\s+categoria\s*=/i.test(expected)) throw new Error('A migration altera a coluna categoria');
  if (/<\/?[a-z][^>]*>/i.test(expected)) throw new Error('A migration contém elementos HTML');
  for (const excludedId of [44, 45, 46]) {
    if (new RegExp(`id_categoria\\s*=\\s*${excludedId}\\b`).test(expected)) {
      throw new Error(`A migration inclui o ID excluído ${excludedId}`);
    }
  }
  console.log('Conteúdo SEO validado: 43 categorias e 43 IDs únicos.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
