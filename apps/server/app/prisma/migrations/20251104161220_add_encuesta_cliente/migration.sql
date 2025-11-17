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
CREATE TABLE `c_encuesta_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `division_id` INTEGER NOT NULL,
    `responsable_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `evaluaciones` LONGTEXT NOT NULL,
    `mejoras` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_division_id_fkey` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_responsable_id_fkey` FOREIGN KEY (`responsable_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
