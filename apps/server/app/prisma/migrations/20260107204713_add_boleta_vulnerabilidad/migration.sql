-- CreateTable
CREATE TABLE `c_boleta_apreciacion_vulnerabilidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `fecha` DATETIME(0) NOT NULL,
    `enlace` VARCHAR(255) NOT NULL,
    `nombre_solicitante` VARCHAR(255) NOT NULL,
    `boleta` LONGTEXT NOT NULL,
    `metricas_vulnerablidad` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NULL,
    `firma_solicitante` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_boleta_apreciacion_vulnerabilidad` ADD CONSTRAINT `c_boleta_apreciacion_vulnerabilidad_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_boleta_apreciacion_vulnerabilidad` ADD CONSTRAINT `c_boleta_apreciacion_vulnerabilidad_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_boleta_apreciacion_vulnerabilidad` ADD CONSTRAINT `c_boleta_apreciacion_vulnerabilidad_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
