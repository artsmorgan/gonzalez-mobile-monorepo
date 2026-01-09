-- CreateTable
CREATE TABLE `e_control_documento_entregado_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `nombre_oficial_entrega` VARCHAR(255) NOT NULL,
    `nombre_oficial_recibe` VARCHAR(255) NOT NULL,
    `tipo_documento` VARCHAR(255) NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `firma_representante_cliente` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_tipo_documento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_control_documento_entregado_cliente` ADD CONSTRAINT `e_control_documento_entregado_cliente_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_control_documento_entregado_cliente` ADD CONSTRAINT `e_control_documento_entregado_cliente_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
