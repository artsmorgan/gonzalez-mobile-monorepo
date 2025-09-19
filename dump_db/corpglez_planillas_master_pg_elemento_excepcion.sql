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
-- Table structure for table `pg_elemento_excepcion`
--

DROP TABLE IF EXISTS `pg_elemento_excepcion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pg_elemento_excepcion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `empleado` int(11) DEFAULT NULL,
  `tipo_planilla` varchar(250) COLLATE utf8_unicode_ci DEFAULT NULL,
  `dia_trabajado` int(11) DEFAULT NULL,
  `adgcdg` int(11) DEFAULT NULL,
  `repos_horas` int(11) DEFAULT NULL,
  `otras_extras` int(11) DEFAULT NULL,
  `feriados` int(11) DEFAULT NULL,
  `deudas` int(11) DEFAULT NULL,
  `rebajo_sindicato` int(11) DEFAULT NULL,
  `incapacidades` int(11) DEFAULT NULL,
  `bonificaciones` int(11) DEFAULT NULL,
  `estado` tinyint(1) DEFAULT NULL,
  `refuerzos` int(11) DEFAULT NULL,
  `inducciones` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pg_elemento_excepcion`
--

LOCK TABLES `pg_elemento_excepcion` WRITE;
/*!40000 ALTER TABLE `pg_elemento_excepcion` DISABLE KEYS */;
INSERT INTO `pg_elemento_excepcion` VALUES (1,'2023-06-16','2023-06-30',7339,'quincenal',6982882,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL),(9,'2023-11-01','2023-11-15',8664,'quincenal',7492803,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL),(10,'2023-11-01','2023-11-15',8664,'quincenal',7492804,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL);
/*!40000 ALTER TABLE `pg_elemento_excepcion` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:49:11
