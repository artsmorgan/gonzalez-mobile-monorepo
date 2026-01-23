/*
  Warnings:

  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - Added the required column `fecha` to the `c_checklist_supervision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_supervisor` to the `c_checklist_supervision` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_checklist_supervision` ADD COLUMN `fecha` DATETIME NOT NULL,
    ADD COLUMN `firma_supervisor` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;
