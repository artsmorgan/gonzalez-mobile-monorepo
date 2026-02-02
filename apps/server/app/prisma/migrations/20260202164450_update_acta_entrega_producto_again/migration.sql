/*
  Warnings:

  - You are about to drop the column `cliente` on the `c_acta_entre_producto` table. All the data in the column will be lost.
  - You are about to alter the column `fecha_solucion` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_inicio` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_fin` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_entrada` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_salida` on the `c_activo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_checklist_supervision` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_mantenimiento_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha_reporte` on the `c_reporte_articulo_mantenimiento` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - Added the required column `division_id` to the `c_acta_entre_producto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_acta_entre_producto` DROP COLUMN `cliente`,
    ADD COLUMN `division_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `c_activo_mantenimiento` MODIFY `fecha_solucion` DATETIME NULL,
    MODIFY `fecha_inicio` DATETIME NULL,
    MODIFY `fecha_fin` DATETIME NULL,
    MODIFY `fecha_entrada` DATETIME NULL,
    MODIFY `fecha_salida` DATETIME NULL;

-- AlterTable
ALTER TABLE `c_checklist_supervision` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_mantenimiento_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_reporte_articulo_mantenimiento` MODIFY `fecha_reporte` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;
