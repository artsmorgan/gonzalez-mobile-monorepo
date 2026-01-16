-- CreateTable
CREATE TABLE `e_mutuos_acuerdos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `ejecutivo_cuenta` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `turno` VARCHAR(50) NOT NULL,
    `informacion_oficial_interesado` LONGTEXT NOT NULL,
    `informacion_oficial_colaborador` LONGTEXT NOT NULL,
    `motivo` LONGTEXT NOT NULL,
    `firma_ejecutivo_cuenta` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `created_by` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_mutuos_acuerdos` ADD CONSTRAINT `e_mutuos_acuerdos_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_mutuos_acuerdos` ADD CONSTRAINT `e_mutuos_acuerdos_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_mutuos_acuerdos` ADD CONSTRAINT `e_mutuos_acuerdos_ejecutivo_cuenta_fkey` FOREIGN KEY (`ejecutivo_cuenta`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
