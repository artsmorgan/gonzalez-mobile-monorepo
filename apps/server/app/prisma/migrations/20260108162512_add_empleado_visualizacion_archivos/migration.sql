-- CreateTable
CREATE TABLE `e_empleado_visualizacion_archivos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `visualizacion_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    INDEX `e_archivos_empleado_visualizacion_id_fkey`(`visualizacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_empleado_visualizacion_archivos` ADD CONSTRAINT `e_empleado_visualizacion_archivos_visualizacion_id_fkey` FOREIGN KEY (`visualizacion_id`) REFERENCES `e_empleado_visualizacion_manual_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
