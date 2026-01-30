/*
  Warnings:

  - You are about to alter the column `fecha` on the `c_checklist_supervision` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_mantenimiento_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_checklist_supervision` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_mantenimiento_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `c_reporte_articulo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `division` VARCHAR(25) NOT NULL,
    `fecha_reporte` DATETIME NOT NULL,
    `created_by` INTEGER NOT NULL,
    `solucionado` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_activo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporte_id` INTEGER NOT NULL,
    `articulo_id` INTEGER NOT NULL,
    `estado` VARCHAR(55) NOT NULL,
    `cantidad_necesaria` INTEGER NOT NULL,
    `cantidad_real` INTEGER NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `fecha_solucion` DATETIME NULL,
    `accion` VARCHAR(55) NULL,
    `fecha_inicio` DATETIME NULL,
    `marca` LONGTEXT NULL,
    `modelo` LONGTEXT NULL,
    `serie_placa` LONGTEXT NULL,
    `categoria` LONGTEXT NULL,
    `kilometraje` INTEGER NULL,
    `categoria_mantinimiento` LONGTEXT NULL,
    `detalle` LONGTEXT NULL,
    `numero_fc` LONGTEXT NULL,
    `proveedor` LONGTEXT NULL,
    `costo_mo` INTEGER NULL,
    `costo_i` INTEGER NULL,
    `iva` INTEGER NULL,
    `costo_total` INTEGER NULL,
    `fecha_fin` DATETIME NULL,
    `reincidencia_treinta_dias` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_archivos_adjuntos_archivo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `original_name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `activo_mantenimiento_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_movimientos_activo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo_mantenimiento_id` INTEGER NOT NULL,
    `nombre_persona_recibe` VARCHAR(255) NOT NULL,
    `nombre_persona_entrega` VARCHAR(255) NOT NULL,
    `departamento` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL,
    `entrega` VARCHAR(255) NOT NULL,
    `recibe` VARCHAR(255) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora` TIME NOT NULL,
    `firma_entrega` LONGTEXT NOT NULL,
    `firma_recibe` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_reporte_articulo_mantenimiento` ADD CONSTRAINT `c_reporte_articulo_mantenimiento_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_reporte_articulo_mantenimiento` ADD CONSTRAINT `c_reporte_articulo_mantenimiento_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_reporte_articulo_mantenimiento` ADD CONSTRAINT `c_reporte_articulo_mantenimiento_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_activo_mantenimiento` ADD CONSTRAINT `c_activo_mantenimiento_reporte_id_fkey` FOREIGN KEY (`reporte_id`) REFERENCES `c_reporte_articulo_mantenimiento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_archivos_adjuntos_archivo_mantenimiento` ADD CONSTRAINT `c_archivos_adjuntos_archivo_mantenimiento_activo_mantenimie_fkey` FOREIGN KEY (`activo_mantenimiento_id`) REFERENCES `c_activo_mantenimiento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_movimientos_activo_mantenimiento` ADD CONSTRAINT `c_movimientos_activo_mantenimiento_activo_mantenimiento_id_fkey` FOREIGN KEY (`activo_mantenimiento_id`) REFERENCES `c_activo_mantenimiento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
