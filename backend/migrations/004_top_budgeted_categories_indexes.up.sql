-- Índices usados pela consulta de categorias mais orçadas.
-- As colunas de igualdade vêm antes da data para preservar o filtro por empresa.
ALTER TABLE orcamentos
  ADD INDEX idx_orcamentos_empresa_data_id (id_empresa, data_orcamento, id_orcamento);

ALTER TABLE orcamentos_itens
  ADD INDEX idx_orcamentos_itens_orcamento_produto (id_orcamento, id_produto);

ALTER TABLE aux_categorias_produtos
  ADD INDEX idx_aux_categorias_produtos_empresa_produto_categoria
    (id_empresa, id_produto, id_categoria);
