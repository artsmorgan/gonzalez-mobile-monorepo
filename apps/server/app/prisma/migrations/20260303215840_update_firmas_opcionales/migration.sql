/*
  Warnings:

  - Added the required column `tipo_autoria` to the `c_vehiculos_corporativos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_acta_entre_producto` MODIFY `firma_entrega` LONGTEXT NULL,
    MODIFY `firma_recibe` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_apertura_cierre_puesto` MODIFY `firma_representante_empresa_entrante` LONGTEXT NULL,
    MODIFY `firma_representante_empresa_saliente` LONGTEXT NULL,
    MODIFY `firma_representante_cliente` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_boleta_apreciacion_vulnerabilidad` MODIFY `firma_solicitante` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_checklist_supervision` MODIFY `firma_supervisor` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_evaluacion_empleado` MODIFY `firma_empleado` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_mantenimiento_vehiculos_corporativos` MODIFY `firma_mecanico` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_movimientos_articulo_mantenimiento` MODIFY `firma_entrega` LONGTEXT NULL,
    MODIFY `firma_recibe` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_producto_no_conforme` MODIFY `firma_persona_identifico_pnc` LONGTEXT NULL,
    MODIFY `firma_persona_origino_pnc` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_registro_induccion_recorrido` MODIFY `firma_supervisor` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `firma_conductor` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `c_vehiculos_corporativos` ADD COLUMN `tipo_autoria` VARCHAR(52) NOT NULL;

-- AlterTable
ALTER TABLE `e_movimiento_llave` MODIFY `firma_entrega` LONGTEXT NULL,
    MODIFY `firma_recibe` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `e_movimiento_llavero` MODIFY `firma_entrega` LONGTEXT NULL,
    MODIFY `firma_recibe` LONGTEXT NULL;
