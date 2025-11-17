/*
  Warnings:

  - You are about to drop the column `actividadCorpoEquipo_id` on the `e_actividad_corpo_revision_equipo` table. All the data in the column will be lost.
  - You are about to drop the `e_actividad_corpo_equipo` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `actividadCorpoMarcada_id` to the `e_actividad_corpo_revision_equipo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_actividad_corpo_revision_equipo` DROP COLUMN `actividadCorpoEquipo_id`,
    ADD COLUMN `actividadCorpoMarcada_id` INTEGER NOT NULL;

-- DropTable
DROP TABLE `e_actividad_corpo_equipo`;

-- CreateIndex
CREATE INDEX `e_actividad_corpo_revision_equipo_actividad_corpo_marcada_fkey` ON `e_actividad_corpo_revision_equipo`(`actividadCorpoMarcada_id`);

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` ADD CONSTRAINT `e_actividad_corpo_revision_equipo_actividadCorpoMarcada_id_fkey` FOREIGN KEY (`actividadCorpoMarcada_id`) REFERENCES `e_actividad_corpo_marcada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
