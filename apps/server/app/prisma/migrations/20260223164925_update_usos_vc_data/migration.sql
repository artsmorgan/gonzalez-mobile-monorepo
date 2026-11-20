/*
  Warnings:

  - You are about to drop the column `hora_fin` on the `c_usos_vehiculos_corporativos` table. All the data in the column will be lost.
  - You are about to drop the column `hora_inicio` on the `c_usos_vehiculos_corporativos` table. All the data in the column will be lost.
  - Added the required column `fin` to the `c_usos_vehiculos_corporativos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inicio` to the `c_usos_vehiculos_corporativos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` DROP COLUMN `hora_fin`,
    DROP COLUMN `hora_inicio`,
    ADD COLUMN `fin` TIME(0) NOT NULL,
    ADD COLUMN `inicio` TIME(0) NOT NULL,
    MODIFY `combustible_inicio` LONGTEXT NOT NULL,
    MODIFY `combustible_fin` LONGTEXT NOT NULL;
