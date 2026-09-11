# Produtos de categoria em lote

O modal /categorias usa GET /api/v1/categorias/:id/produtos/disponiveis com search e page.
A resposta traz produtos, pagina??o de 30 itens e linked_ids. Com ids_only=1 retorna
produto_ids de todos os resultados do mesmo filtro, at? 50000; acima disso solicita
refinar o filtro em vez de truncar a sele??o. Todas as chamadas exigem JWT e usam a empresa
da sess?o. Os IDs formam uma sele??o expl?cita, preservada entre filtros e p?ginas.

POST /api/v1/categorias/:id/produtos/lote recebe { produto_ids: number[] } e responde
{ processed, changed }. Valida e bloqueia todos os produtos em ordem crescente antes
de escrever. Uma transa??o substitui as categorias e remove subcategorias incompat?veis.
Sele??es j? corretas s?o idempotentes. Uma falha reverte a opera??o inteira.

## Pr?-requisito verificado

A inspe??o somente de leitura no banco configurado encontrou aux_subcategorias_produtos
em MyISAM. Isso n?o suporta rollback. A migra??o 006_category_products_transactional.up.sql
converte somente essa tabela para InnoDB, preservando dados e chaves. Ela n?o foi aplicada
automaticamente e a convers?o pode bloquear a tabela durante a opera??o. A busca p?blica
n?o depende dessa migra??o.

O lote recusa escrita com CATEGORY_TRANSACTION_UNAVAILABLE enquanto as cinco tabelas
envolvidas n?o forem InnoDB. Para publica??o, aplicar a migra??o 006 ap?s aprova??o da
altera??o de schema e verificar o engine antes de liberar o lote. N?o executar todas
as migra??es pendentes sem revisar o estado do banco. O down mant?m InnoDB, compat?vel
com o c?digo anterior, para n?o remover a garantia transacional.
