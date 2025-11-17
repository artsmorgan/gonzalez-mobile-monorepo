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
-- Table structure for table `e_estructura_dia_excepcion_plaza`
--

DROP TABLE IF EXISTS `e_estructura_dia_excepcion_plaza`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `e_estructura_dia_excepcion_plaza` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plaza_id` int(11) DEFAULT NULL,
  `tipo_turno_plan` varchar(1) COLLATE utf8_unicode_ci DEFAULT NULL,
  `hora_inicio_plan` time DEFAULT NULL,
  `hora_fin_plan` time DEFAULT NULL,
  `tipo_turno_real` varchar(1) COLLATE utf8_unicode_ci DEFAULT NULL,
  `hora_inicio_real` time DEFAULT NULL,
  `hora_fin_real` time DEFAULT NULL,
  `diaExcepcionPuesto_id` int(11) DEFAULT NULL,
  `horas_duracion` decimal(10,0) DEFAULT NULL,
  `marcaDia_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_640C22F17963DFC5` (`marcaDia_id`),
  KEY `IDX_640C22F132838645` (`diaExcepcionPuesto_id`),
  KEY `IDX_640C22F1EF34C0BD` (`plaza_id`),
  CONSTRAINT `FK_640C22F132838645` FOREIGN KEY (`diaExcepcionPuesto_id`) REFERENCES `e_estructura_dia_excepcion_puesto` (`id`),
  CONSTRAINT `FK_640C22F17963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_640C22F1EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `e_estructura_dia_excepcion_plaza`
--

LOCK TABLES `e_estructura_dia_excepcion_plaza` WRITE;
/*!40000 ALTER TABLE `e_estructura_dia_excepcion_plaza` DISABLE KEYS */;
/*!40000 ALTER TABLE `e_estructura_dia_excepcion_plaza` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:53:53
