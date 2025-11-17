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
-- Table structure for table `c_induccion_dia`
--

DROP TABLE IF EXISTS `c_induccion_dia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_induccion_dia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `induccion_id` int(11) NOT NULL,
  `plaza_id` int(11) DEFAULT NULL,
  `fecha` date NOT NULL,
  `tipo_turno` varchar(1) COLLATE utf8_unicode_ci DEFAULT NULL,
  `horario_str` varchar(20) COLLATE utf8_unicode_ci DEFAULT NULL,
  `cantidad_horas` decimal(5,2) NOT NULL,
  `presente` tinyint(1) DEFAULT NULL,
  `marcaDia_id` int(11) DEFAULT NULL,
  `coincide_horario` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_E5590D543CEEDC64` (`induccion_id`),
  KEY `IDX_E5590D54EF34C0BD` (`plaza_id`),
  KEY `IDX_E5590D547963DFC5` (`marcaDia_id`),
  CONSTRAINT `FK_E5590D543CEEDC64` FOREIGN KEY (`induccion_id`) REFERENCES `c_induccion` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_E5590D547963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_E5590D54EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_induccion_dia`
--

LOCK TABLES `c_induccion_dia` WRITE;
/*!40000 ALTER TABLE `c_induccion_dia` DISABLE KEYS */;
INSERT INTO `c_induccion_dia` VALUES (81,78,668,'2019-11-11','D','06:00-14:00',8.00,0,1875211,0);
/*!40000 ALTER TABLE `c_induccion_dia` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:52:16
