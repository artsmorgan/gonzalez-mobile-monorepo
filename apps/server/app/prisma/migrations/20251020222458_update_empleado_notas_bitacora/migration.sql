/*
  Warnings:

  - You are about to drop the column `division` on the `c_empleado_notas` table. All the data in the column will be lost.
  - Added the required column `empleado_id` to the `c_empleado_notas_bitacora_cambios` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_empleado_notas` DROP COLUMN `division`,
    ADD COLUMN `categoria_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `c_empleado_notas_bitacora_cambios` ADD COLUMN `empleado_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `n_novedades_categoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_empleado_notas_bitacora_cambios` ADD CONSTRAINT `c_empleado_notas_bitacora_cambios_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
