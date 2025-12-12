/*
  Warnings:

  - You are about to drop the `c_evaluacion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `c_evaluacion` DROP FOREIGN KEY `c_evaluacion_corpo_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_evaluacion` DROP FOREIGN KEY `c_evaluacion_plaza_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_evaluacion` DROP FOREIGN KEY `c_evaluacion_puesto_id_fkey`;

-- DropTable
DROP TABLE `c_evaluacion`;

-- CreateTable
CREATE TABLE `c_evaluacion_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_empleado` VARCHAR(45) NOT NULL,
    `cedula_empleado` VARCHAR(45) NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `evaluador_id` INTEGER NOT NULL,
    `tipo` VARCHAR(25) NOT NULL,
    `fecha_ingreso` DATE NOT NULL,
    `fecha_evaluacion` DATE NOT NULL,
    `evaluacion` LONGTEXT NOT NULL,
    `comentarios` LONGTEXT NOT NULL,
    `nombre_evaluador` VARCHAR(45) NOT NULL,
    `firma_evaluador` LONGTEXT NOT NULL,
    `firma_empleado` LONGTEXT NOT NULL,
    `created_at` DATETIME NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_plaza_id_fkey` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
