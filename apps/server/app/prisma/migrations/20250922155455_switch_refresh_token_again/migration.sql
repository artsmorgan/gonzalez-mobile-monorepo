/*
  Warnings:

  - You are about to drop the column `usuarioId` on the `refresh_token` table. All the data in the column will be lost.
  - Added the required column `empleadoId` to the `refresh_token` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `refresh_token` DROP FOREIGN KEY `refresh_token_usuarioId_fkey`;

-- DropIndex
DROP INDEX `refresh_token_usuarioId_fkey` ON `refresh_token`;

-- AlterTable
ALTER TABLE `refresh_token` DROP COLUMN `usuarioId`,
    ADD COLUMN `empleadoId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `refresh_token_empleadoId_fkey` ON `refresh_token`(`empleadoId`);

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
