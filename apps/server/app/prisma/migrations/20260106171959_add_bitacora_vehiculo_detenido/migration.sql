-- CreateTable
CREATE TABLE `c_bitacora_vehiculo_detenido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(52) NOT NULL,
    `informacion_general` LONGTEXT NOT NULL,
    `informacion_revision` LONGTEXT NOT NULL,
    `movimientos_vehiculos` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
