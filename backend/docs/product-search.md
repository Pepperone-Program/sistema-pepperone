# Busca p?blica sem repara??o

## Contrato

O site usa GET /api/v1/produtos/site?busca=caderno. O par?metro search e o alias
GET /api/v1/produtos/site/busca?q=caderno permanecem compat?veis. A resposta mant?m
items, total, page, limit, totalPages, rankingVersion, searchId e nextCursor.

C?digos completos t?m preced?ncia exata; trechos literais de c?digo retornam lista,
sem inventar prefixos ou aproximar c?digos alfanum?ricos inexistentes. O termo pep,
ignorando caixa/espa?os externos, lista todo o cat?logo p?blico paginado.

## Fonte de verdade e falhas

A leitura de produtos atuais ? obrigat?ria; a cobertura do ?ndice n?o ? requisito.
O recuperador consulta produtos p?blicos e habilitados da empresa, com filtro SQL
por nome/tipo e categoria e lotes de 500 por chave crescente. N?o existe truncamento
pelo limite de candidatos do ?ndice. O parser compartilhado com a indexa??o deriva
atributos dos dados atuais. O mesmo ranking e o filtro final de relev?ncia verificam
tipo principal, termos e atributos fortes, inclusive com pauta/sem pauta.

O ?ndice ? opcional e n?o decide se o produto existe ou est? publicado. Atributos
DERIVED desatualizados n?o substituem informa??es atuais do cat?logo. Enriquecimento
MANUAL dispon?vel ? preservado. A ordena??o lexical ? determin?stica e usa a vers?o
v4-catalog-v1 (ou a vers?o configurada com o sufixo catalog-v1), invalidando cursores
anteriores cuja pontua??o era diferente.

Dicion?rio e enriquecimento opcional t?m espera de at? 400 ms, coalesc?ncia de trabalho
em andamento e circuito de 30 segundos ap?s falha/timeout. Durante indisponibilidade
do dicion?rio usa-se a ?ltima leitura bem-sucedida da empresa, ou as regras embutidas.
A consulta p?blica por termo n?o reutiliza cache de resultados, evitando esconder
produtos rec?m-alterados. Redis nas demais rotas tem timeout de 500 ms. Analytics ?
best effort fora do caminho bloqueante e n?o acumula trabalhos concorrentes por empresa.

N?o h? p?gina, endpoint, comando ou cron de repara??o/reconstru??o. A sincroniza??o
incremental das grava??es normais continua opcional e suas falhas n?o desfazem a grava??o
principal nem impedem a busca. Nenhuma consulta p?blica escreve documentos de busca.

## Valida??o

npm test cobre cat?logo sem ?ndice, ?ndice com dados antigos, falhas de depend?ncias,
consulta sem correspond?ncia, restri??es, c?digos literais, pagina??o e cursores.
A su?te live-public-search ? habilitada por SEARCH_LIVE_INTEGRATION=true e realiza
somente leitura: analytics ? substitu?do no teste. Ela inclui consulta sem ?ndice e EXPLAIN.
O script search:preflight continua sendo diagn?stico somente de leitura, nunca requisito
para servir buscas. N?o s?o necess?rias migra??es para esta altera??o da busca.

load/search.k6.js exercita a URL usada pelo site. Executar carga apenas em ambiente de
teste apropriado, informando SEARCH_BASE_URL. Medir lat?ncia p50/p95/p99, erros, conex?es,
CPU e I/O no ambiente de implanta??o. Uma medi??o remota do banco inclui lat?ncia de rede
e n?o comprova a capacidade da API implantada.

A disponibilidade depende tamb?m de banco, rede e processo HTTP. A implementa??o elimina
a depend?ncia de repara??o; n?o substitui redund?ncia e monitoramento de infraestrutura.
