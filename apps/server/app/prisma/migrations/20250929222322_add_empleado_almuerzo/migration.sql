-- CreateTable
CREATE TABLE `c_empleado_almuerzo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `pausas` LONGTEXT NOT NULL,
    `inicio` DATETIME(0) NOT NULL,
    `fin` DATETIME(0) NOT NULL,
    `es_manual` BOOLEAN NOT NULL DEFAULT false,

    INDEX `empleadoId_almuerzo_fkey`(`empleadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_empleado_almuerzo` ADD CONSTRAINT `c_empleado_almuerzo_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
