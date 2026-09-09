ALTER TABLE aux_categorias_produtos
  DROP INDEX idx_aux_categorias_produtos_empresa_produto_categoria;

ALTER TABLE orcamentos_itens
  DROP INDEX idx_orcamentos_itens_orcamento_produto;

ALTER TABLE orcamentos
  DROP INDEX idx_orcamentos_empresa_data_id;
