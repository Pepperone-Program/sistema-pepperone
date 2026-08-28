# Busca pública de produtos por relevância

## Estado e compatibilidade

O site pesquisa por `GET /api/v1/produtos/site?busca=...`; `search` continua aceito por
compatibilidade. Essa rota sempre usa interpretação e ranking. Enquanto o schema avançado não
está ativado, ela recupera candidatos no FULLTEXT/tabelas legadas e os ordena com o mesmo parser
e ranking (`v2-legacy-schema`). `GET /api/v1/produtos/site/busca?q=...` é um alias compatível.
A busca administrativa por ID, código ou nome permanece inalterada. Código exato e a variação
com prefixo `PEP` continuam tendo precedência.

O preflight de 2026-08-27 identificou MariaDB 10.3.39, servidor `latin1_swedish_ci`, token
FULLTEXT mínimo 3, 2.820 produtos e 2.771 produtos públicos na empresa 1. Por isso A4, A5,
UV e PC não dependem de FULLTEXT: são recuperados por atributos estruturados. O documento
de busca usa `utf8mb4_unicode_ci` sem alterar a tabela legada.

## Arquitetura

Fluxo: normalização → dicionário → parser determinístico → recuperação de até 300 candidatos
→ ranking explicável → separação de relacionados → cursor assinado → resposta/cache/analytics.

O ranking compara, nesta ordem, tipo principal, contradições, constraints atendidas, score
composto, popularidade e ID estável. Kits que apenas contêm o tipo recebem penalização.
Contradições HARD confiáveis são excluídas. Dados ausentes não são tratados como negativos.

O parser reconhece frases antes de stopwords, capacidades em ml/l, polegadas, tamanhos A4/A5/A6,
materiais, cores e negações. Operadores Boolean FULLTEXT nunca vêm diretamente do cliente.

## Operação

1. Execute `npm run search:preflight` e arquive a saída.
2. Faça backup e valide espaço/tempo de DDL em staging.
3. Execute `npm run db:migrate`; o servidor nunca migra no startup.
4. Execute `npm run search:rebuild -- --dry-run`, depois o rebuild real em lotes.
5. Defina `SEARCH_DOCUMENT_SYNC_ENABLED=true` somente após schema e backfill.
6. Compare `/api/v1/produtos/search/debug?q=...` autenticado com a busca vigente.
7. Ative `SEARCH_RANKING_PERCENTAGE` em 5, 25, 50 e 100, observando os gates.

Rollback imediato é `SEARCH_RANKING_PERCENTAGE=0`. A remoção estrutural é posterior e usa
`npm run db:rollback`, somente depois da janela de recuperação. DDL InnoDB/MariaDB pode fazer
commit implícito; não trate rollback SQL como substituto de backup.

## API

- Busca usada pelo site: `GET /api/v1/produtos/site?busca=&empresaId=&page=&limit=`.
- Alias: `GET /api/v1/produtos/site/busca?q=&empresaId=&limit=&cursor=&sort=`.
- Filtros implementados: `id_categoria`, `material`, `cor`.
- Ordenações implementadas: `relevance`, `newest`, `popular`.
- `price_asc`, `price_desc` e `estoque` retornam 422 até existir uma fonte pública e isolada por
  empresa; nenhum campo substituto é inferido.
- Debug, métricas locais e dicionário ficam sob `/api/v1/produtos/search/*` com JWT.
- Clique/conversão: `POST /api/v1/produtos/search/events` com `empresaId`, `searchId`,
  `productId`, `position` e `event` (`click` ou `conversion`).

O debug expõe parsing e breakdown, mas não SQL nem credenciais. A consulta normalizada só é
persistida se `SEARCH_STORE_NORMALIZED_QUERY=true`; por padrão analytics armazena hash SHA-256.

## Testes e qualidade

`npm test` cobre normalização, frases, unidades, injection, cursor, feature flag, invariantes de
ranking e um corpus sintético determinístico de 150 consultas. Esse corpus não substitui o golden
dataset adjudicado com IDs reais: a aprovação/anomização do catálogo é um gate antes de 100%.

O teste k6 está em `load/search.k6.js`. Exemplo:

```bash
k6 run -e SEARCH_BASE_URL=https://staging.example.com -e SEARCH_EMPRESA_ID=1 -e SEARCH_VUS=20 load/search.k6.js
```

Registrar RPS, p50/p95/p99, erros, timeouts, CPU/RAM da aplicação e banco, conexões e I/O.
Os thresholds iniciais (p95 < 500 ms, p99 < 1 s, erro < 1%) são gates provisórios, não evidência
de capacidade. Alertas externos devem consumir logs `[ProductSearch]` e métricas do provedor.

## Limitações deliberadas

- Não houve migration, backfill, benchmark k6 ou tráfego real nesta implementação.
- A métrica autenticada é uma janela local por processo; agregação/alertas dependem da plataforma.
- A composição de kits e atributos confiáveis exigem curadoria administrativa/importação. Inferências
  do nome/descrição são marcadas `DERIVED` e nunca sobrescrevem valores `MANUAL`.
- O write path sincroniza após a gravação legada quando habilitado. Uma futura refatoração deverá
  colocar produto e documento na mesma transação; até lá, o rebuild por hash é o reparo idempotente.
