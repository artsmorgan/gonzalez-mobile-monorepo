/*
  Warnings:

  - You are about to drop the column `actividadCorpoMarcada_id` on the `e_actividad_corpo_revision_equipo` table. All the data in the column will be lost.
  - Added the required column `actividadCorpoPlaza_id` to the `e_actividad_corpo_revision_equipo` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `e_actividad_corpo_revision_equipo_actividad_corpo_marcada_fkey` ON `e_actividad_corpo_revision_equipo`;

-- AlterTable
ALTER TABLE `e_actividad_corpo_revision_equipo` DROP COLUMN `actividadCorpoMarcada_id`,
    ADD COLUMN `actividadCorpoPlaza_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `e_actividad_puesto_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadCorpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `e_actividad_corpo_revision_equipo_actividad_corpo_plaza_fkey` ON `e_actividad_corpo_revision_equipo`(`actividadCorpoPlaza_id`);

-- AddForeignKey
ALTER TABLE `e_actividad_puesto_plaza` ADD CONSTRAINT `e_actividad_puesto_plaza_actividadCorpo_id_fkey` FOREIGN KEY (`actividadCorpo_id`) REFERENCES `e_actividad_corpo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` ADD CONSTRAINT `e_actividad_corpo_revision_equipo_actividadCorpoPlaza_id_fkey` FOREIGN KEY (`actividadCorpoPlaza_id`) REFERENCES `e_actividad_corpo_plaza`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
