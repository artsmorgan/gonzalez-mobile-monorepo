/*
  Warnings:

  - Added the required column `division_id` to the `c_apertura_cierre_puesto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_apertura_cierre_puesto` ADD COLUMN `division_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `c_apertura_cierre_puesto` ADD CONSTRAINT `c_apertura_cierre_puesto_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_apertura_cierre_puesto` ADD CONSTRAINT `c_apertura_cierre_puesto_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_apertura_cierre_puesto` ADD CONSTRAINT `c_apertura_cierre_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_apertura_cierre_puesto` ADD CONSTRAINT `c_apertura_cierre_puesto_division_id_fkey` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
