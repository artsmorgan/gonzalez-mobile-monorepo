/*
  Warnings:

  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `e_registro_entrega_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `oficial_entrega` VARCHAR(255) NOT NULL,
    `fecha_entrada_entrega` DATE NOT NULL,
    `fecha_salida_entrega` DATE NOT NULL,
    `hora_entrada_entrega` TIME NOT NULL,
    `hora_salida_entrega` TIME NOT NULL,
    `turno_entrega` VARCHAR(55) NOT NULL,
    `oficial_recibe` VARCHAR(255) NOT NULL,
    `fecha_entrada_recibe` DATE NOT NULL,
    `fecha_salida_recibe` DATE NOT NULL,
    `hora_entrada_recibe` TIME NOT NULL,
    `hora_salida_recibe` TIME NOT NULL,
    `turno_recibe` VARCHAR(55) NOT NULL,
    `articulos_puesto` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `created_by` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_registro_entrega_puesto` ADD CONSTRAINT `e_registro_entrega_puesto_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_entrega_puesto` ADD CONSTRAINT `e_registro_entrega_puesto_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_entrega_puesto` ADD CONSTRAINT `e_registro_entrega_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
