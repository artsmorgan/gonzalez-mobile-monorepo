/*
  Warnings:

  - You are about to drop the column `createdAt` on the `c_marca_dia` table. All the data in the column will be lost.
  - You are about to drop the column `empleadoId` on the `c_marca_dia` table. All the data in the column will be lost.
  - You are about to drop the column `tipoMarca` on the `c_marca_dia` table. All the data in the column will be lost.
  - Added the required column `cliente_id` to the `c_marca_dia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contrato_id` to the `c_marca_dia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `corpo_id` to the `c_marca_dia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `empresa_id` to the `c_marca_dia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horario_id` to the `c_marca_dia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plaza_id` to the `c_marca_dia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `puesto_id` to the `c_marca_dia` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_marca_dia` DROP COLUMN `createdAt`,
    DROP COLUMN `empleadoId`,
    DROP COLUMN `tipoMarca`,
    ADD COLUMN `accionPersonal_id` INTEGER NULL,
    ADD COLUMN `cliente_id` INTEGER NOT NULL,
    ADD COLUMN `contrato_id` INTEGER NOT NULL,
    ADD COLUMN `coordinador_id` INTEGER NULL,
    ADD COLUMN `corpo_id` INTEGER NOT NULL,
    ADD COLUMN `empleadoCDG_id` INTEGER NULL,
    ADD COLUMN `empleadoFijo_id` INTEGER NULL,
    ADD COLUMN `empleadoReemplaza2_id` INTEGER NULL,
    ADD COLUMN `empleadoReemplaza_id` INTEGER NULL,
    ADD COLUMN `empresa_id` INTEGER NOT NULL,
    ADD COLUMN `hora_entrada` DATETIME(3) NULL,
    ADD COLUMN `hora_entrada_digitada` DATETIME(3) NULL,
    ADD COLUMN `hora_fin` TIME(0) NULL,
    ADD COLUMN `hora_fin_plan` TIME(0) NULL,
    ADD COLUMN `hora_inicio` TIME(0) NULL,
    ADD COLUMN `hora_inicio_plan` TIME(0) NULL,
    ADD COLUMN `hora_mas_cuatro` TIME(0) NULL,
    ADD COLUMN `hora_mas_cuatro_digitada` TIME(0) NULL,
    ADD COLUMN `hora_mas_cuatro_entrada` TIME(0) NULL,
    ADD COLUMN `hora_salida` DATETIME(3) NULL,
    ADD COLUMN `hora_salida_anticipada` TIME(0) NULL,
    ADD COLUMN `hora_salida_digitada` TIME(0) NULL,
    ADD COLUMN `horario_id` INTEGER NOT NULL,
    ADD COLUMN `horas_duracion` DOUBLE NULL,
    ADD COLUMN `is_dia_excepcion` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `is_puesto_no_cubierto` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `is_reposicion_de_horas` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `marcaCdgHacia_id` INTEGER NULL,
    ADD COLUMN `marcaComoReemplazo2_id` INTEGER NULL,
    ADD COLUMN `marcaComoReemplazo_id` INTEGER NULL,
    ADD COLUMN `marcaEnInduccion_id` INTEGER NULL,
    ADD COLUMN `motivoErrorAsignacion_id` INTEGER NULL,
    ADD COLUMN `motivoExtra_id` INTEGER NULL,
    ADD COLUMN `motivoMarcarHorarioPlaza_id` INTEGER NULL,
    ADD COLUMN `motivo_ausente` VARCHAR(191) NULL,
    ADD COLUMN `motivo_cdg` VARCHAR(191) NULL,
    ADD COLUMN `motivo_induccion` VARCHAR(191) NULL,
    ADD COLUMN `motivo_separacion_temp` VARCHAR(191) NULL,
    ADD COLUMN `observaciones` VARCHAR(191) NULL,
    ADD COLUMN `operacion_accion` VARCHAR(191) NULL,
    ADD COLUMN `operacion_extra` VARCHAR(191) NULL,
    ADD COLUMN `plaza_id` INTEGER NOT NULL,
    ADD COLUMN `puesto_id` INTEGER NOT NULL,
    ADD COLUMN `teorico` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `tipo_comida` VARCHAR(191) NULL,
    ADD COLUMN `tipo_turno` VARCHAR(191) NULL,
    ADD COLUMN `tipo_turno_plan` VARCHAR(191) NULL,
    ADD COLUMN `usuario_marca_entrada` INTEGER NULL,
    ADD COLUMN `usuario_marca_salida` INTEGER NULL,
    MODIFY `fecha` DATE NOT NULL;
