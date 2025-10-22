-- CreateTable
CREATE TABLE `c_empleado_notas_bitacora_cambios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nota_id` INTEGER NOT NULL,
    `data` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_empleado_notas_bitacora_cambios` ADD CONSTRAINT `c_empleado_notas_bitacora_cambios_nota_id_fkey` FOREIGN KEY (`nota_id`) REFERENCES `c_empleado_notas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
