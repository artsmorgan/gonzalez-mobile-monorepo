-- CreateTable
CREATE TABLE `c_imagenes_checklist_supervision` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `checklist_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    INDEX `c_imagenes_checklist_supervision_id_fkey`(`checklist_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_imagenes_checklist_supervision` ADD CONSTRAINT `c_imagenes_checklist_supervision_checklist_id_fkey` FOREIGN KEY (`checklist_id`) REFERENCES `c_checklist_supervision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
