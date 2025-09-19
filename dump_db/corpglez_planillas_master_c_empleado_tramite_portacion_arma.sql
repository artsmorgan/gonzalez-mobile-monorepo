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
-- Table structure for table `c_empleado_tramite_portacion_arma`
--

DROP TABLE IF EXISTS `c_empleado_tramite_portacion_arma`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_empleado_tramite_portacion_arma` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empleado_id` int(11) NOT NULL,
  `descripcion` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `fecha_creacion` date DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_E46810F952BE730` (`empleado_id`),
  CONSTRAINT `FK_E46810F952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_empleado_tramite_portacion_arma`
--

LOCK TABLES `c_empleado_tramite_portacion_arma` WRITE;
/*!40000 ALTER TABLE `c_empleado_tramite_portacion_arma` DISABLE KEYS */;
INSERT INTO `c_empleado_tramite_portacion_arma` VALUES (1,4622,'PORTACIÓN',NULL,NULL),(2,6087,'NOTA DE PREVENCIÓN','2021-05-24','2020-06-19'),(3,6184,'EXPEDIENTE POLICIAL','2022-04-12','2022-01-14'),(4,6858,'EL DIA 13/03/2023 PRESENTA UNA SOLICITUD DE REVISION DE PARTES','2023-03-14',NULL),(5,6858,'DOCUMENTOS PRESENTADOS','2023-02-01',NULL),(6,3621,'PORTACIONES AL DÍA','2023-04-13','2024-01-21'),(7,7231,'COPIAS DE LA CEDULA Y HOJA DE ANTECEDENTES','2023-10-20','2024-10-19'),(8,9448,'vigentes al 03-12-2026',NULL,'2026-12-03');
/*!40000 ALTER TABLE `c_empleado_tramite_portacion_arma` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:51:35
