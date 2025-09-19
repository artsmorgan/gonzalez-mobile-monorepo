-- CreateTable
CREATE TABLE `roles_security` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `UNIQ_23BF45A45E236E06`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles_security_modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rol_id` INTEGER NOT NULL,
    `module_name` VARCHAR(191) NOT NULL,
    `actions` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `roles_security_modules` ADD CONSTRAINT `FK_A2ED9530521E1991` FOREIGN KEY (`rol_id`) REFERENCES `roles_security`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
