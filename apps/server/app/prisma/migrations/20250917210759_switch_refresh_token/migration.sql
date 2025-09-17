/*
  Warnings:

  - You are about to drop the column `empleadoId` on the `refresh_token` table. All the data in the column will be lost.
  - Added the required column `usuarioId` to the `refresh_token` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `refresh_token` DROP FOREIGN KEY `refresh_token_empleadoId_fkey`;

-- DropIndex
DROP INDEX `refresh_token_empleadoId_fkey` ON `refresh_token`;

-- AlterTable
ALTER TABLE `refresh_token` DROP COLUMN `empleadoId`,
    ADD COLUMN `usuarioId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `refresh_token_usuarioId_fkey` ON `refresh_token`(`usuarioId`);

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
