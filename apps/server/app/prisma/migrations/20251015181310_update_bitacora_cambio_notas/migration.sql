/*
  Warnings:

  - You are about to drop the column `data` on the `c_empleado_notas_bitacora_cambios` table. All the data in the column will be lost.
  - Added the required column `description` to the `c_empleado_notas_bitacora_cambios` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titulo` to the `c_empleado_notas_bitacora_cambios` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_empleado_notas_bitacora_cambios` DROP COLUMN `data`,
    ADD COLUMN `description` LONGTEXT NOT NULL,
    ADD COLUMN `titulo` VARCHAR(255) NOT NULL;
