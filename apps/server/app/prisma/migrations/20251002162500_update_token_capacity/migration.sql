-- DropIndex
DROP INDEX `refresh_token_token_key` ON `refresh_token`;

-- AlterTable
ALTER TABLE `refresh_token` MODIFY `token` TEXT NOT NULL;
