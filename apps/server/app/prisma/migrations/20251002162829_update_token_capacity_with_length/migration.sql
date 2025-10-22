/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `refresh_token` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `refresh_token` MODIFY `token` VARCHAR(512) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `refresh_token_token_key` ON `refresh_token`(`token`);
