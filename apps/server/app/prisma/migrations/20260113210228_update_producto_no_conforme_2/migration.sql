/*
  Warnings:

  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - Added the required column `firma_persona_identifico_pnc` to the `c_producto_no_conforme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_persona_origino_pnc` to the `c_producto_no_conforme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_responsable` to the `c_producto_no_conforme` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_producto_no_conforme` ADD COLUMN `firma_persona_identifico_pnc` LONGTEXT NOT NULL,
    ADD COLUMN `firma_persona_origino_pnc` LONGTEXT NOT NULL,
    ADD COLUMN `firma_responsable` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;
