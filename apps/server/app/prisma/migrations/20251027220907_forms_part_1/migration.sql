-- CreateTable
CREATE TABLE `e_registro_vehiculos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `placa` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(75) NOT NULL,
    `cedula` VARCHAR(30) NOT NULL,
    `hora_entrada` TIME NOT NULL,
    `hora_salida` TIME NULL,
    `razon_visita` LONGTEXT NOT NULL,
    `responsable_id` INTEGER NOT NULL,
    `created_at` DATETIME NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_registro_personas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `nombre` VARCHAR(75) NOT NULL,
    `cedula` VARCHAR(30) NOT NULL,
    `hora_entrada` TIME NOT NULL,
    `hora_salida` TIME NULL,
    `razon_visita` VARCHAR(75) NOT NULL,
    `responsable_id` INTEGER NOT NULL,
    `es_funcionario` BOOLEAN NOT NULL,
    `observaciones` VARCHAR(255) NOT NULL,
    `tipo_accion` VARCHAR(15) NOT NULL,
    `created_at` DATETIME NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_activo_visitante` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitante_id` INTEGER NOT NULL,
    `tipo_id` INTEGER NOT NULL,
    `detalles` LONGTEXT NOT NULL,
    `numero_serie` VARCHAR(50) NOT NULL,
    `numero_activo` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_activo_visitas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `UNIQ_92DE8E473A989126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_registro_vehiculos` ADD CONSTRAINT `FK_BB503B25953BE730` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_vehiculos` ADD CONSTRAINT `FK_BB503B25954BE730` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_vehiculos` ADD CONSTRAINT `FK_BB503B25955BE730` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_vehiculos` ADD CONSTRAINT `FK_BB503B25952BE730` FOREIGN KEY (`responsable_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_personas` ADD CONSTRAINT `FK_BB603B25953BE730` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_personas` ADD CONSTRAINT `FK_BB703B25954BE730` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_personas` ADD CONSTRAINT `FK_BB803B25955BE730` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_personas` ADD CONSTRAINT `FK_BB503B25992BE730` FOREIGN KEY (`responsable_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_activo_visitante` ADD CONSTRAINT `FK_BB503B25992BE739` FOREIGN KEY (`visitante_id`) REFERENCES `e_registro_personas`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_activo_visitante` ADD CONSTRAINT `FK_BB503B25993BE739` FOREIGN KEY (`tipo_id`) REFERENCES `n_tipo_activo_visitas`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
