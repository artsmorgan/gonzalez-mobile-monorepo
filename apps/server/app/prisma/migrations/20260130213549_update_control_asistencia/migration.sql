/*
  Warnings:

  - You are about to alter the column `fecha_solucion` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_inicio` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_fin` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_entrada` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_salida` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_checklist_supervision` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to drop the column `plaza_id` on the `c_control_asistencia` table. All the data in the column will be lost.
  - You are about to drop the column `puesto_id` on the `c_control_asistencia` table. All the data in the column will be lost.
  - You are about to alter the column `fecha` on the `c_mantenimiento_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_reporte` on the `c_reporte_articulo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_activo_mantenimiento` MODIFY `fecha_solucion` DATETIME NULL,
    MODIFY `fecha_inicio` DATETIME NULL,
    MODIFY `fecha_fin` DATETIME NULL,
    MODIFY `fecha_entrada` DATETIME NULL,
    MODIFY `fecha_salida` DATETIME NULL;

-- AlterTable
ALTER TABLE `c_checklist_supervision` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_control_asistencia` DROP COLUMN `plaza_id`,
    DROP COLUMN `puesto_id`;

-- AlterTable
ALTER TABLE `c_mantenimiento_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_reporte_articulo_mantenimiento` MODIFY `fecha_reporte` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;
