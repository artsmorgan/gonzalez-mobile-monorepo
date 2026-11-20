/*
  Warnings:

  - Added the required column `created_at` to the `c_articulo_mantenimiento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `c_articulo_mantenimiento` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_articulo_mantenimiento` ADD COLUMN `created_at` DATETIME(0) NOT NULL,
    ADD COLUMN `updated_at` DATETIME(0) NOT NULL;
