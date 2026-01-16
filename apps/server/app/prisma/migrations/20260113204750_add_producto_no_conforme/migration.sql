/*
  Warnings:

  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to drop the `c_producto_no_conforme_matriz` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- DropTable
DROP TABLE `c_producto_no_conforme_matriz`;

-- CreateTable
CREATE TABLE `c_producto_no_conforme` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `fecha_identificacion` DATE NOT NULL,
    `responsable_cuenta` VARCHAR(50) NOT NULL,
    `tipo_servicio_no_conforme` VARCHAR(50) NOT NULL,
    `persona_identifico_pnc` VARCHAR(255) NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `persona_origino_pnc` VARCHAR(255) NOT NULL,
    `accion_implementada` LONGTEXT NOT NULL,
    `fecha_solucion` DATE NOT NULL,
    `responsable_aprobar` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_producto_no_conforme` ADD CONSTRAINT `c_producto_no_conforme_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_producto_no_conforme` ADD CONSTRAINT `c_producto_no_conforme_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
