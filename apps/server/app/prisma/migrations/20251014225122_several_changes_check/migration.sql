-- AlterTable
ALTER TABLE `c_salida_anticipada` ADD COLUMN `empleado_id` INTEGER NULL,
    ADD COLUMN `motivo` LONGTEXT NULL;

-- CreateTable
CREATE TABLE `e_actividad_corpo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `contrato_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NULL,
    `nombre_actividad` LONGTEXT NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `frecuencia` VARCHAR(25) NOT NULL,
    `es_revision_equipo` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividad_corpo_marcada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadCorpo_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `bitacora` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividad_corpo_equipo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadCorpo_id` INTEGER NOT NULL,
    `reglas` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividad_corpo_revision_equipo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadCorpoEquipo_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `articulo_id` INTEGER NOT NULL,
    `es_correcto` BOOLEAN NOT NULL,
    `motivo_incorrecto` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_salida_anticipada` ADD CONSTRAINT `c_salida_anticipada_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_contrato_id_fkey` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_plaza_id_fkey` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_marcada` ADD CONSTRAINT `e_actividad_corpo_marcada_actividadCorpo_id_fkey` FOREIGN KEY (`actividadCorpo_id`) REFERENCES `e_actividad_corpo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_equipo` ADD CONSTRAINT `e_actividad_corpo_equipo_actividadCorpo_id_fkey` FOREIGN KEY (`actividadCorpo_id`) REFERENCES `e_actividad_corpo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` ADD CONSTRAINT `e_actividad_corpo_revision_equipo_actividadCorpoEquipo_id_fkey` FOREIGN KEY (`actividadCorpoEquipo_id`) REFERENCES `e_actividad_corpo_equipo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` ADD CONSTRAINT `e_actividad_corpo_revision_equipo_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` ADD CONSTRAINT `e_actividad_corpo_revision_equipo_articulo_id_fkey` FOREIGN KEY (`articulo_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
