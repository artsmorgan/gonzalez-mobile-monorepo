-- CreateTable
CREATE TABLE `c_empleado_notas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `description` LONGTEXT NOT NULL,
    `division` VARCHAR(191) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `empleadoId_notas_fkey`(`empleadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_empleado_notas` ADD CONSTRAINT `c_empleado_notas_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
