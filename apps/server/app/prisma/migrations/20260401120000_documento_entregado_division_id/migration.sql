-- Agrega division_id a e_control_documento_entregado_cliente (jerarquía completa)
ALTER TABLE `e_control_documento_entregado_cliente` ADD COLUMN `division_id` INTEGER NOT NULL DEFAULT 0;
