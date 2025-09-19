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
-- Table structure for table `e_estructura_requerimiento_contrato`
--

DROP TABLE IF EXISTS `e_estructura_requerimiento_contrato`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `e_estructura_requerimiento_contrato` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `requerimiento_id` int(11) DEFAULT NULL,
  `contrato_id` int(11) DEFAULT NULL,
  `tiempo_renovacion` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_D5DEDC5251DD0900` (`requerimiento_id`),
  KEY `IDX_D5DEDC5270AE7BF1` (`contrato_id`),
  CONSTRAINT `FK_D5DEDC5251DD0900` FOREIGN KEY (`requerimiento_id`) REFERENCES `n_requerimiento` (`id`),
  CONSTRAINT `FK_D5DEDC5270AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `e_estructura_requerimiento_contrato`
--

LOCK TABLES `e_estructura_requerimiento_contrato` WRITE;
/*!40000 ALTER TABLE `e_estructura_requerimiento_contrato` DISABLE KEYS */;
/*!40000 ALTER TABLE `e_estructura_requerimiento_contrato` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:44:32
