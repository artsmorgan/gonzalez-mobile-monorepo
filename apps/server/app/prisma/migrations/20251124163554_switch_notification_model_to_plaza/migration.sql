/*
  Warnings:

  - You are about to alter the column `created_at` on the `c_evaluacion` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to drop the `c_empleado_notification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `c_empleado_notification` DROP FOREIGN KEY `c_empleado_notification_empleadoId_fkey`;

-- DropForeignKey
ALTER TABLE `c_empleado_notification` DROP FOREIGN KEY `c_empleado_notification_notificationId_fkey`;

-- AlterTable
ALTER TABLE `c_evaluacion` MODIFY `created_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_personas` MODIFY `hora_entrada` DATETIME NOT NULL,
    MODIFY `hora_salida` DATETIME NULL,
    MODIFY `created_at` DATETIME NOT NULL,
    MODIFY `updated_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_vehiculos` MODIFY `hora_entrada` DATETIME NOT NULL,
    MODIFY `hora_salida` DATETIME NULL,
    MODIFY `created_at` DATETIME NOT NULL,
    MODIFY `updated_at` DATETIME NOT NULL;

-- DropTable
DROP TABLE `c_empleado_notification`;

-- CreateTable
CREATE TABLE `c_plaza_notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plazaId` INTEGER NOT NULL,
    `notificationId` INTEGER NOT NULL,
    `watched` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_plaza_notification` ADD CONSTRAINT `c_plaza_notification_plazaId_fkey` FOREIGN KEY (`plazaId`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_plaza_notification` ADD CONSTRAINT `c_plaza_notification_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `c_notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
