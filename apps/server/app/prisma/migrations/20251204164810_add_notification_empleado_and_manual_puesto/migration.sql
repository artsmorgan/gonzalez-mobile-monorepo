-- CreateTable
CREATE TABLE `c_empleado_notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `notificationId` INTEGER NOT NULL,
    `watched` BOOLEAN NOT NULL DEFAULT false,

    INDEX `c_empleado_notification_notificationId_fkey`(`notificationId`),
    INDEX `c_plaza_notification_empleadoId_fkey`(`empleadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_manual_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` LONGTEXT NOT NULL,
    `description` LONGTEXT NOT NULL,
    `firma` LONGTEXT NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_archivos_manual_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `manual_puesto_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_empleado_visualizacion_manual_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `manual_puesto_id` INTEGER NOT NULL,
    `nombre_empleado` LONGTEXT NOT NULL,
    `firma_empleado` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_empleado_notification` ADD CONSTRAINT `c_empleado_notification_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `c_notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_empleado_notification` ADD CONSTRAINT `c_empleado_notification_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_archivos_manual_puesto` ADD CONSTRAINT `e_archivos_manual_puesto_manual_puesto_id_fkey` FOREIGN KEY (`manual_puesto_id`) REFERENCES `e_manual_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_empleado_visualizacion_manual_puesto` ADD CONSTRAINT `e_empleado_visualizacion_manual_puesto_manual_puesto_id_fkey` FOREIGN KEY (`manual_puesto_id`) REFERENCES `e_manual_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_empleado_visualizacion_manual_puesto` ADD CONSTRAINT `e_empleado_visualizacion_manual_puesto_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
