/*
  Warnings:

  - You are about to alter the column `created_at` on the `c_evaluacion_empleado` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_evaluacion_empleado` MODIFY `created_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_personas` MODIFY `hora_entrada` DATETIME NOT NULL,
    MODIFY `hora_salida` DATETIME NULL,
    MODIFY `created_at` DATETIME NOT NULL,
    MODIFY `updated_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_vehiculos` MODIFY `hora_entrada` DATETIME NOT NULL,
    MODIFY `hora_salida` DATETIME NULL,
    MODIFY `created_at` DATETIME NOT NULL,
    MODIFY `updated_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `c_incidente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `corpo_id` INTEGER NOT NULL,
    `ejecutivo_cuenta` INTEGER NOT NULL,
    `fecha_incidente` DATE NOT NULL,
    `fecha_reporte` DATE NOT NULL,
    `nombre_responsable` VARCHAR(45) NOT NULL,
    `clasificacion` INTEGER NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `involucrados` LONGTEXT NOT NULL,
    `fecha_libro_novedades` DATE NOT NULL,
    `nombre_responsable_atencion` VARCHAR(45) NOT NULL,
    `solucion` LONGTEXT NULL,
    `fecha_solucion` DATE NULL,
    `fecha_real_solucion` DATE NULL,
    `costo_asociado` LONGTEXT NULL,
    `consecutivo_informe` LONGTEXT NULL,
    `link_informe` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_incidente` ADD CONSTRAINT `c_incidente_ejecutivo_cuenta_fkey` FOREIGN KEY (`ejecutivo_cuenta`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
