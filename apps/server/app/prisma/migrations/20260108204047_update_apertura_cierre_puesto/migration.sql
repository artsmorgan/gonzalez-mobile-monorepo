/*
  Warnings:

  - The primary key for the `c_apertura_cierre_puesto` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cliente` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `contrato_id` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `empresa_id` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `fecha_realizado` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `fotos` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `nombre_corpo` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `nombre_puesto` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `numero_corpo` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `numero_puesto` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to drop the column `plaza_id` on the `c_apertura_cierre_puesto` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `c_apertura_cierre_puesto` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - Added the required column `fecha` to the `c_apertura_cierre_puesto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_representante_empresa_entrante` to the `c_apertura_cierre_puesto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_representante_empresa_saliente` to the `c_apertura_cierre_puesto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_responsable` to the `c_apertura_cierre_puesto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombre_representante_empresa_entrante` to the `c_apertura_cierre_puesto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombre_representante_empresa_saliente` to the `c_apertura_cierre_puesto` table without a default value. This is not possible if the table is not empty.
  - Made the column `cliente_id` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `corpo_id` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `puesto_id` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tipo` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `actividades` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `inventario` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nombre_representante_cliente` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `firma_cliente` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_by` on table `c_apertura_cierre_puesto` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `c_apertura_cierre_puesto` DROP PRIMARY KEY,
    DROP COLUMN `cliente`,
    DROP COLUMN `contrato_id`,
    DROP COLUMN `empresa_id`,
    DROP COLUMN `fecha_realizado`,
    DROP COLUMN `fotos`,
    DROP COLUMN `nombre_corpo`,
    DROP COLUMN `nombre_puesto`,
    DROP COLUMN `numero_corpo`,
    DROP COLUMN `numero_puesto`,
    DROP COLUMN `plaza_id`,
    ADD COLUMN `fecha` DATETIME(3) NOT NULL,
    ADD COLUMN `firma_representante_empresa_entrante` LONGTEXT NOT NULL,
    ADD COLUMN `firma_representante_empresa_saliente` LONGTEXT NOT NULL,
    ADD COLUMN `firma_responsable` LONGTEXT NOT NULL,
    ADD COLUMN `nombre_representante_empresa_entrante` VARCHAR(255) NOT NULL,
    ADD COLUMN `nombre_representante_empresa_saliente` VARCHAR(255) NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `cliente_id` INTEGER NOT NULL,
    MODIFY `corpo_id` INTEGER NOT NULL,
    MODIFY `puesto_id` INTEGER NOT NULL,
    MODIFY `tipo` VARCHAR(191) NOT NULL,
    MODIFY `actividades` LONGTEXT NOT NULL,
    MODIFY `inventario` LONGTEXT NOT NULL,
    MODIFY `nombre_representante_cliente` VARCHAR(255) NOT NULL,
    MODIFY `firma_cliente` LONGTEXT NOT NULL,
    MODIFY `created_by` INTEGER NOT NULL,
    ADD PRIMARY KEY (`id`);

-- CreateTable
CREATE TABLE `c_imagenes_apertura_cierre_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `apetura_cierre_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_imagenes_apertura_cierre_puesto` ADD CONSTRAINT `c_imagenes_apertura_cierre_puesto_apetura_cierre_id_fkey` FOREIGN KEY (`apetura_cierre_id`) REFERENCES `c_apertura_cierre_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
