/*
  Warnings:

  - You are about to drop the column `firma_cliente` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - Added the required column `firma_representante_cliente` to the `c_apertura_cierre_puesto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_apertura_cierre_puesto` DROP COLUMN `firma_cliente`,
    ADD COLUMN `firma_representante_cliente` LONGTEXT NOT NULL;
