/*
  Warnings:

  - You are about to drop the column `turno` on the `e_mutuos_acuerdos` table. All the data in the column will be lost.
  - Added the required column `colaborador_acepta` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_ejecutivo_cuenta_digital` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `interesado_acepta` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` DROP COLUMN `turno`,
    ADD COLUMN `colaborador_acepta` BOOLEAN NOT NULL,
    ADD COLUMN `firma_ejecutivo_cuenta_digital` LONGTEXT NOT NULL,
    ADD COLUMN `interesado_acepta` BOOLEAN NOT NULL;
