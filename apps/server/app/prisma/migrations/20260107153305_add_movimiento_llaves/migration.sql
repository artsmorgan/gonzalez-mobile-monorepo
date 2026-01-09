-- CreateTable
CREATE TABLE `e_movimiento_llave` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `llave_id` INTEGER NOT NULL,
    `nombre_persona_recibe` VARCHAR(255) NOT NULL,
    `nombre_persona_entrega` VARCHAR(255) NOT NULL,
    `departamento` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL,
    `entrega` VARCHAR(255) NOT NULL,
    `recibe` VARCHAR(255) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora` TIME NOT NULL,
    `firma_entrega` LONGTEXT NOT NULL,
    `firma_recibe` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_movimiento_llave` ADD CONSTRAINT `e_movimiento_llave_llave_id_fkey` FOREIGN KEY (`llave_id`) REFERENCES `e_llave`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
