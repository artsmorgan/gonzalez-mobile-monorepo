/*
  Warnings:

  - You are about to drop the column `area_piso` on the `c_control_asistencia` table. All the data in the column will be lost.
  - You are about to drop the column `fecha_hora_fin` on the `c_control_asistencia` table. All the data in the column will be lost.
  - You are about to drop the column `fecha_hora_inicio` on the `c_control_asistencia` table. All the data in the column will be lost.
  - You are about to drop the column `fijos` on the `c_control_asistencia` table. All the data in the column will be lost.
  - You are about to drop the column `nombre_cliente` on the `c_control_asistencia` table. All the data in the column will be lost.
  - Added the required column `fecha` to the `c_control_asistencia` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_cambio_guardia` ADD COLUMN `mobile_upload` BOOLEAN NULL;

-- AlterTable
ALTER TABLE `c_control_asistencia` DROP COLUMN `area_piso`,
    DROP COLUMN `fecha_hora_fin`,
    DROP COLUMN `fecha_hora_inicio`,
    DROP COLUMN `fijos`,
    DROP COLUMN `nombre_cliente`,
    ADD COLUMN `fecha` DATETIME(0) NOT NULL;
