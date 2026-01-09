/*
  Warnings:

  - Added the required column `cliente_id` to the `c_bitacora_vehiculo_detenido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `empresa_id` to the `c_bitacora_vehiculo_detenido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sucursal_id` to the `c_bitacora_vehiculo_detenido` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_bitacora_vehiculo_detenido` ADD COLUMN `cliente_id` INTEGER NOT NULL,
    ADD COLUMN `empresa_id` INTEGER NOT NULL,
    ADD COLUMN `sucursal_id` INTEGER NOT NULL;
