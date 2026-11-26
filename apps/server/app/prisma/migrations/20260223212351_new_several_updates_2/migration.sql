/*
  Warnings:

  - Added the required column `cedula_empleado` to the `c_empleado_almuerzo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `empleado_nombre` to the `c_empleado_almuerzo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_empleado` to the `c_empleado_almuerzo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minutos_almuerzo` to the `c_empleado_almuerzo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_accion_personal` ADD COLUMN `mobile_upload` BOOLEAN NULL;

-- AlterTable
ALTER TABLE `c_empleado_almuerzo` ADD COLUMN `cedula_empleado` LONGTEXT NOT NULL,
    ADD COLUMN `empleado_nombre` LONGTEXT NOT NULL,
    ADD COLUMN `firma_empleado` LONGTEXT NOT NULL,
    ADD COLUMN `minutos_almuerzo` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_entrega_puesto` ADD COLUMN `firma_entrega` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `e_registro_personas` ADD COLUMN `departamento_visita` VARCHAR(255) NULL,
    ADD COLUMN `persona_visita` VARCHAR(255) NULL;
