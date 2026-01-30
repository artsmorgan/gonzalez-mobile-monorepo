/*
  Warnings:

  - You are about to alter the column `fecha_solucion` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_inicio` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_fin` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_checklist_supervision` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_mantenimiento_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_reporte` on the `c_reporte_articulo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_activo_mantenimiento` ADD COLUMN `fecha_entrada` DATETIME NULL,
    ADD COLUMN `fecha_salida` DATETIME NULL,
    ADD COLUMN `tipo` LONGTEXT NULL,
    MODIFY `fecha_solucion` DATETIME NULL,
    MODIFY `fecha_inicio` DATETIME NULL,
    MODIFY `fecha_fin` DATETIME NULL;

-- AlterTable
ALTER TABLE `c_checklist_supervision` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_mantenimiento_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_reporte_articulo_mantenimiento` MODIFY `fecha_reporte` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `c_categoria_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
