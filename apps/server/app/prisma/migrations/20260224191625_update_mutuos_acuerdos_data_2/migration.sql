/*
  Warnings:

  - You are about to drop the column `colaborador_acepta` on the `e_mutuos_acuerdos` table. All the data in the column will be lost.
  - You are about to drop the column `firma_ejecutivo_cuenta` on the `e_mutuos_acuerdos` table. All the data in the column will be lost.
  - You are about to drop the column `informacion_oficial_colaborador` on the `e_mutuos_acuerdos` table. All the data in the column will be lost.
  - You are about to drop the column `informacion_oficial_interesado` on the `e_mutuos_acuerdos` table. All the data in the column will be lost.
  - You are about to drop the column `interesado_acepta` on the `e_mutuos_acuerdos` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[marcaDiaReemplaza_id]` on the table `e_mutuos_acuerdos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[marcaDiaAusente_id]` on the table `e_mutuos_acuerdos` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ausente_acepta` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `empleadoAusente_id` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `empleadoReemplaza_id` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marcaDiaAusente_id` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marcaDiaReemplaza_id` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plazaAusente_id` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plazaReemplaza_id` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reemplaza_acepta` to the `e_mutuos_acuerdos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` DROP COLUMN `colaborador_acepta`,
    DROP COLUMN `firma_ejecutivo_cuenta`,
    DROP COLUMN `informacion_oficial_colaborador`,
    DROP COLUMN `informacion_oficial_interesado`,
    DROP COLUMN `interesado_acepta`,
    ADD COLUMN `ausente_acepta` BOOLEAN NOT NULL,
    ADD COLUMN `empleadoAusente_id` INTEGER NOT NULL,
    ADD COLUMN `empleadoReemplaza_id` INTEGER NOT NULL,
    ADD COLUMN `firma_ejecutivo_cuenta_manual` LONGTEXT NULL,
    ADD COLUMN `marcaDiaAusente_id` INTEGER NOT NULL,
    ADD COLUMN `marcaDiaReemplaza_id` INTEGER NOT NULL,
    ADD COLUMN `plazaAusente_id` INTEGER NOT NULL,
    ADD COLUMN `plazaReemplaza_id` INTEGER NOT NULL,
    ADD COLUMN `reemplaza_acepta` BOOLEAN NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `UNIQ_285F043315ABD58` ON `e_mutuos_acuerdos`(`marcaDiaReemplaza_id`);

-- CreateIndex
CREATE UNIQUE INDEX `UNIQ_285F04335FB34B5B` ON `e_mutuos_acuerdos`(`marcaDiaAusente_id`);

-- RedefineIndex
CREATE INDEX `c_imagenes_registro_induccion_general_id_fkey` ON `c_imagenes_registro_induccion_general`(`registro_id`);
DROP INDEX `c_imagenes_acta_entrega_producto_registro_id_fkey` ON `c_imagenes_registro_induccion_general`;
