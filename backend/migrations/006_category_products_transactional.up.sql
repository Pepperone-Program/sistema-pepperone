-- Required for atomic category assignment and incompatible-subcategory removal.
-- Existing keys and rows are preserved. Apply separately in a controlled deployment:
-- converting a MyISAM table can lock it while the engine is changed.
ALTER TABLE aux_subcategorias_produtos ENGINE=InnoDB;
