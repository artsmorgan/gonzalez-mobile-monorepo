/*
  Warnings:

  - You are about to drop the column `empleado_id` on the `a_recovery_password_token` table. All the data in the column will be lost.
  - Added the required column `usuarioId` to the `a_recovery_password_token` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `a_recovery_password_token` DROP FOREIGN KEY `FK_E35A23BC952BE730`;

-- DropIndex
DROP INDEX `FK_E35A23BC952BE730` ON `a_recovery_password_token`;

-- AlterTable
ALTER TABLE `a_recovery_password_token` DROP COLUMN `empleado_id`,
    ADD COLUMN `usuarioId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `FK_E35A23BC952BE730` ON `a_recovery_password_token`(`usuarioId`);

-- AddForeignKey
ALTER TABLE `a_recovery_password_token` ADD CONSTRAINT `FK_E35A23BC952BE730` FOREIGN KEY (`usuarioId`) REFERENCES `security_fos_user`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
