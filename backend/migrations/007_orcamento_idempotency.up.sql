CREATE TABLE IF NOT EXISTS orcamentos_idempotencia (
  fingerprint CHAR(64) NOT NULL PRIMARY KEY,
  id_empresa INT NOT NULL,
  id_orcamento INT NOT NULL,
  expira_em DATETIME NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orcamentos_idempotencia_expira (expira_em),
  INDEX idx_orcamentos_idempotencia_orcamento (id_empresa, id_orcamento)
) ENGINE=InnoDB;
