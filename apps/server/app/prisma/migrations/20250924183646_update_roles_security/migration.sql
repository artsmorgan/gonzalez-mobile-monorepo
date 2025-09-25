/*
  Warnings:

  - You are about to drop the column `rol_id` on the `roles_security_modules` table. All the data in the column will be lost.
  - Added the required column `role_name` to the `roles_security_modules` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `roles_security_modules` DROP FOREIGN KEY `FK_A2ED9530521E1991`;

-- DropIndex
DROP INDEX `FK_A2ED9530521E1991` ON `roles_security_modules`;

-- AlterTable
ALTER TABLE `roles_security_modules` DROP COLUMN `rol_id`,
    ADD COLUMN `role_name` VARCHAR(191) NOT NULL;
