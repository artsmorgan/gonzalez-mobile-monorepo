/*
  Warnings:

  - The primary key for the `c_registro_induccion_recorrido` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `c_registro_induccion_recorrido` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - A unique constraint covering the columns `[token]` on the table `refresh_token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `division` to the `c_registro_induccion_recorrido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_responsable` to the `c_registro_induccion_recorrido` table without a default value. This is not possible if the table is not empty.
  - Made the column `empresa_id` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `cliente_id` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contrato_id` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `corpo_id` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `puesto_id` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `plaza_id` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fecha` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `renglon_edificio` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `supervisor_corporacion` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `temas_desarrollados` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `aspectos_especificos` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `participantes` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `firma_supervisor` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_by` on table `c_registro_induccion_recorrido` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `c_registro_induccion_recorrido` DROP PRIMARY KEY,
    ADD COLUMN `division` VARCHAR(191) NOT NULL,
    ADD COLUMN `firma_responsable` LONGTEXT NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `empresa_id` INTEGER NOT NULL,
    MODIFY `cliente_id` INTEGER NOT NULL,
    MODIFY `contrato_id` INTEGER NOT NULL,
    MODIFY `corpo_id` INTEGER NOT NULL,
    MODIFY `puesto_id` INTEGER NOT NULL,
    MODIFY `plaza_id` INTEGER NOT NULL,
    MODIFY `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `renglon_edificio` VARCHAR(191) NOT NULL,
    MODIFY `supervisor_corporacion` VARCHAR(191) NOT NULL,
    MODIFY `temas_desarrollados` LONGTEXT NOT NULL,
    MODIFY `aspectos_especificos` LONGTEXT NOT NULL,
    MODIFY `participantes` LONGTEXT NOT NULL,
    MODIFY `firma_supervisor` LONGTEXT NOT NULL,
    MODIFY `created_by` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- CreateIndex
CREATE UNIQUE INDEX `refresh_token_token_key` ON `refresh_token`(`token`);

-- RedefineIndex
CREATE INDEX `refresh_token_empleadoId_idx` ON `refresh_token`(`empleadoId`);
DROP INDEX `refresh_token_empleadoId_fkey` ON `refresh_token`;
