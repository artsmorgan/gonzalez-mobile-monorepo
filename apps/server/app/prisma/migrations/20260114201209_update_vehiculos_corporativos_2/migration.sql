/*
  Warnings:

  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - Added the required column `estado` to the `c_vehiculos_corporativos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_vehiculos_corporativos` ADD COLUMN `estado` VARCHAR(25) NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;
