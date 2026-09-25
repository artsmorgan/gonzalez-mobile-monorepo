-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD26993C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD26995035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD269985828A9B` FOREIGN KEY (`nomencladorArticuloCP_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C43C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C45035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C4EB6587E3` FOREIGN KEY (`combo_id`) REFERENCES `e_estructura_combo_articulo_cp`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C4EDDDC6B` FOREIGN KEY (`articuloCP_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
