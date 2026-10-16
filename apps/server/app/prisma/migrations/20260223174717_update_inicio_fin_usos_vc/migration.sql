/*
  Warnings:

  - You are about to alter the column `fin` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `Time(0)` to `DateTime(0)`.
  - You are about to alter the column `inicio` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `Time(0)` to `DateTime(0)`.

*/
-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fin` DATETIME(0) NOT NULL,
    MODIFY `inicio` DATETIME(0) NOT NULL;
