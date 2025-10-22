/*
  Warnings:

  - You are about to drop the `c_empleado_notas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `c_empleado_notas_bitacora_cambios` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `c_empleado_notas` DROP FOREIGN KEY `c_empleado_notas_empleadoId_fkey`;

-- DropForeignKey
ALTER TABLE `c_empleado_notas` DROP FOREIGN KEY `c_empleado_notas_puesto_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_empleado_notas_bitacora_cambios` DROP FOREIGN KEY `c_empleado_notas_bitacora_cambios_empleado_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_empleado_notas_bitacora_cambios` DROP FOREIGN KEY `c_empleado_notas_bitacora_cambios_nota_id_fkey`;

-- DropTable
DROP TABLE `c_empleado_notas`;

-- DropTable
DROP TABLE `c_empleado_notas_bitacora_cambios`;

-- CreateTable
CREATE TABLE `c_puesto_notas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(255) NOT NULL,
    `description` LONGTEXT NOT NULL,
    `categoria_id` INTEGER NULL,
    `puesto_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `puesto_id_notas_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_puesto_notas_bitacora_cambios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nota_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `description` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_puesto_notas` ADD CONSTRAINT `c_puesto_notas_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_puesto_notas_bitacora_cambios` ADD CONSTRAINT `c_puesto_notas_bitacora_cambios_nota_id_fkey` FOREIGN KEY (`nota_id`) REFERENCES `c_puesto_notas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_puesto_notas_bitacora_cambios` ADD CONSTRAINT `c_puesto_notas_bitacora_cambios_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
