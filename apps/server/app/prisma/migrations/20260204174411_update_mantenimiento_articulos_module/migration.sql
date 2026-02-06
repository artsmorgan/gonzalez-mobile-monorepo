/*
  Warnings:

  - You are about to alter the column `fecha` on the `c_checklist_supervision` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_mantenimiento_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to drop the `c_activo_mantenimiento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `c_archivos_adjuntos_archivo_mantenimiento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `c_movimientos_activo_mantenimiento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `c_reporte_articulo_mantenimiento` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `c_activo_mantenimiento` DROP FOREIGN KEY `c_activo_mantenimiento_reporte_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_archivos_adjuntos_archivo_mantenimiento` DROP FOREIGN KEY `c_archivos_adjuntos_archivo_mantenimiento_activo_mantenimie_fkey`;

-- DropForeignKey
ALTER TABLE `c_movimientos_activo_mantenimiento` DROP FOREIGN KEY `c_movimientos_activo_mantenimiento_activo_mantenimiento_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_reporte_articulo_mantenimiento` DROP FOREIGN KEY `c_reporte_articulo_mantenimiento_cliente_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_reporte_articulo_mantenimiento` DROP FOREIGN KEY `c_reporte_articulo_mantenimiento_corpo_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_reporte_articulo_mantenimiento` DROP FOREIGN KEY `c_reporte_articulo_mantenimiento_puesto_id_fkey`;

-- AlterTable
ALTER TABLE `c_checklist_supervision` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_mantenimiento_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- DropTable
DROP TABLE `c_activo_mantenimiento`;

-- DropTable
DROP TABLE `c_archivos_adjuntos_archivo_mantenimiento`;

-- DropTable
DROP TABLE `c_movimientos_activo_mantenimiento`;

-- DropTable
DROP TABLE `c_reporte_articulo_mantenimiento`;

-- CreateTable
CREATE TABLE `c_cambios_apps_modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_tabla` LONGTEXT NOT NULL,
    `registro_id` INTEGER NOT NULL,
    `cambios` LONGTEXT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `created_by` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_articulo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articulo_plan_id` INTEGER NULL,
    `articulo_asignado_id` INTEGER NULL,
    `estado` VARCHAR(55) NOT NULL,
    `cantidad_necesaria` INTEGER NOT NULL,
    `cantidad_real` INTEGER NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `fecha_solucion` DATETIME NULL,
    `accion` VARCHAR(55) NULL,
    `fecha_inicio` DATETIME NULL,
    `numero_boleta_proveeduria` LONGTEXT NULL,
    `tipo` LONGTEXT NULL,
    `marca` LONGTEXT NULL,
    `modelo` LONGTEXT NULL,
    `serie_placa` LONGTEXT NULL,
    `marca_nuevo` LONGTEXT NULL,
    `modelo_nuevo` LONGTEXT NULL,
    `serie_placa_nuevo` LONGTEXT NULL,
    `categoria` LONGTEXT NULL,
    `tipo_mantenimiento_art` LONGTEXT NULL,
    `fecha_salida` DATETIME NULL,
    `fecha_entrada` DATETIME NULL,
    `kilometraje` INTEGER NULL,
    `mant_armas_form` LONGTEXT NULL,
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
    `tipo_mant_art_reincid` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_archivos_adjuntos_articulo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `original_name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `activo_mantenimiento_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_movimientos_articulo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articulo_plan_id` INTEGER NULL,
    `articulo_asignado_id` INTEGER NULL,
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

-- CreateTable
CREATE TABLE `n_tipo_mantenimiento_articulo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articulo_id` INTEGER NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_articulo_mantenimiento` ADD CONSTRAINT `c_articulo_mantenimiento_articulo_asignado_id_fkey` FOREIGN KEY (`articulo_asignado_id`) REFERENCES `e_estructura_articulo_corpo_puesto_entrega`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_articulo_mantenimiento` ADD CONSTRAINT `c_articulo_mantenimiento_articulo_plan_id_fkey` FOREIGN KEY (`articulo_plan_id`) REFERENCES `e_estructura_articulo_corpo_puesto_plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_archivos_adjuntos_articulo_mantenimiento` ADD CONSTRAINT `c_archivos_adjuntos_articulo_mantenimiento_activo_mantenimi_fkey` FOREIGN KEY (`activo_mantenimiento_id`) REFERENCES `c_articulo_mantenimiento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_movimientos_articulo_mantenimiento` ADD CONSTRAINT `c_movimientos_articulo_mantenimiento_articulo_asignado_id_fkey` FOREIGN KEY (`articulo_asignado_id`) REFERENCES `e_estructura_articulo_corpo_puesto_entrega`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_movimientos_articulo_mantenimiento` ADD CONSTRAINT `c_movimientos_articulo_mantenimiento_articulo_plan_id_fkey` FOREIGN KEY (`articulo_plan_id`) REFERENCES `e_estructura_articulo_corpo_puesto_plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `n_tipo_mantenimiento_articulo` ADD CONSTRAINT `n_tipo_mantenimiento_articulo_articulo_id_fkey` FOREIGN KEY (`articulo_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
