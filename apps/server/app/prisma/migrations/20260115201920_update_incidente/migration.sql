/*
  Warnings:

  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - Added the required column `created_at` to the `c_incidente` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by` to the `c_incidente` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_incidente` ADD COLUMN `created_at` DATETIME(0) NOT NULL,
    ADD COLUMN `created_by` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;
