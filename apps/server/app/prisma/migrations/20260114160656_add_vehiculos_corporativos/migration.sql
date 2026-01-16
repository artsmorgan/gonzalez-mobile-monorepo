/*
  Warnings:

  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `c_vehiculos_corporativos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `sucursal_id` INTEGER NOT NULL,
    `placa` VARCHAR(52) NOT NULL,
    `tipo` VARCHAR(52) NOT NULL,
    `kilometraje` INTEGER NOT NULL,
    `prox_cambio_aceite` INTEGER NOT NULL,
    `modelo` VARCHAR(52) NOT NULL,
    `anno` INTEGER NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `titulo_propiedad` BOOLEAN NOT NULL DEFAULT true,
    `rtv` BOOLEAN NOT NULL DEFAULT true,
    `marchamo` BOOLEAN NOT NULL DEFAULT true,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_vehiculos_corporativos` ADD CONSTRAINT `c_vehiculos_corporativos_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_vehiculos_corporativos` ADD CONSTRAINT `c_vehiculos_corporativos_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
