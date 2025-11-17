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
-- Table structure for table `v_planilla_aguinaldo_empleado`
--

DROP TABLE IF EXISTS `v_planilla_aguinaldo_empleado`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `v_planilla_aguinaldo_empleado` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empleado_id` int(11) DEFAULT NULL,
  `comentarios` varchar(254) COLLATE utf8_unicode_ci DEFAULT NULL,
  `planillaAguinaldo_id` int(11) DEFAULT NULL,
  `ene` decimal(10,2) DEFAULT NULL,
  `feb` decimal(10,2) DEFAULT NULL,
  `mar` decimal(10,2) DEFAULT NULL,
  `abr` decimal(10,2) DEFAULT NULL,
  `may` decimal(10,2) DEFAULT NULL,
  `jun` decimal(10,2) DEFAULT NULL,
  `jul` decimal(10,2) DEFAULT NULL,
  `ago` decimal(10,2) DEFAULT NULL,
  `sep` decimal(10,2) DEFAULT NULL,
  `oct` decimal(10,2) DEFAULT NULL,
  `nov` decimal(10,2) DEFAULT NULL,
  `dic` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_3941B047952BE730` (`empleado_id`),
  KEY `IDX_3941B047D45EF842` (`planillaAguinaldo_id`),
  CONSTRAINT `FK_3941B047952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado` (`id`),
  CONSTRAINT `FK_3941B047D45EF842` FOREIGN KEY (`planillaAguinaldo_id`) REFERENCES `v_planilla_aguinaldo` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `v_planilla_aguinaldo_empleado`
--

LOCK TABLES `v_planilla_aguinaldo_empleado` WRITE;
/*!40000 ALTER TABLE `v_planilla_aguinaldo_empleado` DISABLE KEYS */;
/*!40000 ALTER TABLE `v_planilla_aguinaldo_empleado` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:39:06
