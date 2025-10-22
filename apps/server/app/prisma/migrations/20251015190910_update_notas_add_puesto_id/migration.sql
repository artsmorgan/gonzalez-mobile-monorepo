/*
  Warnings:

  - Added the required column `puesto_id` to the `c_empleado_notas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_empleado_notas` ADD COLUMN `puesto_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `c_empleado_notas` ADD CONSTRAINT `c_empleado_notas_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
