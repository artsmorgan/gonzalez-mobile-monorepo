-- MySQL dump 10.13  Distrib 8.0.40, for Win64 (x86_64)
--
-- Host: localhost    Database: corpglez_planillas_master
-- ------------------------------------------------------
-- Server version	5.7.34

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `pg_planilla`
--

DROP TABLE IF EXISTS `pg_planilla`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pg_planilla` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `estado` varchar(50) COLLATE utf8_unicode_ci DEFAULT NULL,
  `fechaInicio` date DEFAULT NULL,
  `fechaFin` date DEFAULT NULL,
  `fecha_creado` date DEFAULT NULL,
  `fecha_confirmado` date DEFAULT NULL,
  `periodoPago` varchar(20) COLLATE utf8_unicode_ci DEFAULT NULL,
  `imp_salario_ordinario` decimal(18,2) NOT NULL,
  `imp_descuento_dias_menos` decimal(18,2) NOT NULL,
  `num_hediurnas` int(11) NOT NULL,
  `imp_hediurnas` decimal(18,2) NOT NULL,
  `num_hemixtas` int(11) NOT NULL,
  `imp_hemixtas` decimal(18,2) NOT NULL,
  `num_henocturnas` int(11) NOT NULL,
  `imp_henocturnas` decimal(18,2) NOT NULL,
  `imp_extras_turno` decimal(18,2) NOT NULL,
  `imp_extras_otras` decimal(18,2) NOT NULL,
  `imp_bonif_turno` decimal(18,2) NOT NULL,
  `imp_feriado` decimal(18,2) NOT NULL,
  `imp_vacaciones` decimal(18,2) NOT NULL,
  `imp_salario_bruto` decimal(18,2) NOT NULL,
  `imp_caja` decimal(18,2) NOT NULL,
  `imp_renta` decimal(18,2) NOT NULL,
  `imp_salario_bruto_rebajado` decimal(18,2) NOT NULL,
  `imp_deudas` decimal(18,2) NOT NULL,
  `imp_incap` decimal(18,2) NOT NULL,
  `imp_bonif` decimal(18,2) NOT NULL,
  `imp_rebajo` decimal(18,2) NOT NULL,
  `num_dias_rebajo` int(11) NOT NULL,
  `imp_salario_neto` decimal(18,2) NOT NULL,
  `imp_induccion` decimal(18,2) NOT NULL,
  `imp_salario_bruto_turno` decimal(18,2) NOT NULL,
  `num_horas_llegada_tardia` decimal(10,2) NOT NULL,
  `imp_llegada_tardia` decimal(18,2) NOT NULL,
  `num_horas_salida_anticipada` decimal(10,2) NOT NULL,
  `imp_salida_anticipada` decimal(18,2) NOT NULL,
  `imp_licencia_maternidad` decimal(18,2) NOT NULL,
  `imp_refuerzos` decimal(18,2) NOT NULL,
  `num_refuerzos` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pg_planilla`
--

LOCK TABLES `pg_planilla` WRITE;
/*!40000 ALTER TABLE `pg_planilla` DISABLE KEYS */;
INSERT INTO `pg_planilla` VALUES (5,'Semana del Jueves 05 de Enero al Miércoles 11 de Enero de 2023','CONFIRMADO','2023-01-05','2023-01-11','2023-01-12','2023-01-12','semanal',1782123.91,0.00,21,43351.77,0,0.00,0,0.00,43351.77,0.00,0.00,0.00,0.00,1825475.68,194778.26,0.00,1630697.42,2460.25,0.00,0.00,0.00,0,1628237.17,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0),(6,'Semana del Jueves 26 de Enero al Miércoles 01 de Febrero de 2023','CONFIRMADO','2023-01-26','2023-02-01','2023-02-02','2023-02-02','semanal',0.00,0.00,0,0.00,0,0.00,0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0),(11,'Semana del Jueves 16 de Marzo al Miércoles 22 de Marzo de 2023','PROCESADO','2023-03-16','2023-03-22','2023-03-24',NULL,'semanal',3299851.90,0.00,25,55025.81,4,10061.88,6,17608.26,82695.95,0.00,0.00,0.00,0.00,3382547.85,360917.88,0.00,3021629.97,0.00,6772.40,0.00,0.00,0,3028402.37,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0),(15,'Semana del Jueves 06 de Abril al Miércoles 12 de Abril de 2023','PROCESADO','2023-04-06','2023-04-12','2023-04-14',NULL,'semanal',2377094.26,0.00,0,0.00,57,143381.79,82,240646.22,384028.01,0.00,0.00,1059696.75,0.00,3820819.02,407681.37,0.00,3413137.65,0.00,6772.40,0.00,0.00,0,3419910.05,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0),(16,'Quincena 2da del 16 de Diciembre al 31 de Diciembre de 2024','CONFIRMADO','2024-12-16','2024-12-31','2025-01-02','2025-04-17','quincenal',0.00,0.00,0,0.00,0,0.00,0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0),(17,'Quincena 2da del 16 de Enero al 31 de Enero de 2025','PROCESADO','2025-01-16','2025-01-31','2025-01-21',NULL,'quincenal',0.00,0.00,0,0.00,0,0.00,0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0);
/*!40000 ALTER TABLE `pg_planilla` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:41:23
