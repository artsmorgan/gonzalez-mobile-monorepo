/*
  Warnings:

  - You are about to drop the column `fecha` on the `c_control_asistencia` table. All the data in the column will be lost.
  - Added the required column `fecha_hora_fin` to the `c_control_asistencia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fecha_hora_inicio` to the `c_control_asistencia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codigo_conductor` to the `c_usos_vehiculos_corporativos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_conductor` to the `c_usos_vehiculos_corporativos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_control_asistencia` DROP COLUMN `fecha`,
    ADD COLUMN `fecha_hora_fin` DATETIME(3) NOT NULL,
    ADD COLUMN `fecha_hora_inicio` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` ADD COLUMN `codigo_conductor` VARCHAR(55) NOT NULL,
    ADD COLUMN `firma_conductor` LONGTEXT NOT NULL;

-- CreateTable
CREATE TABLE `c_tipos_producto_no_conforme` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `UNIQ_92DE8E473A988126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_imagenes_registro_induccion_general` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `registro_id` INTEGER NOT NULL,

    INDEX `c_imagenes_acta_entrega_producto_registro_id_fkey`(`registro_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_imagenes_registro_induccion_general` ADD CONSTRAINT `c_imagenes_registro_induccion_general_registro_id_fkey` FOREIGN KEY (`registro_id`) REFERENCES `c_registro_induccion_general`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
