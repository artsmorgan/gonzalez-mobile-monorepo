/*
  Warnings:

  - You are about to drop the `c_agenda_minuta_fisica` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `c_agenda_minuta_fisica`;

-- CreateTable
CREATE TABLE `c_agenda_minuta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `numero` INTEGER NOT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora_inicio` TIME NOT NULL,
    `hora_fin` TIME NOT NULL,
    `autor` LONGTEXT NOT NULL,
    `participantes` LONGTEXT NOT NULL,
    `acuerdos` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_agenda_minuta` ADD CONSTRAINT `c_agenda_minuta_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_agenda_minuta` ADD CONSTRAINT `c_agenda_minuta_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_agenda_minuta` ADD CONSTRAINT `c_agenda_minuta_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
