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
-- Table structure for table `n_tipo_deuda`
--

DROP TABLE IF EXISTS `n_tipo_deuda`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_tipo_deuda` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) COLLATE utf8_unicode_ci NOT NULL,
  `prioridad` int(11) NOT NULL,
  `esDeudaConEntidad` varchar(40) COLLATE utf8_unicode_ci NOT NULL,
  `activo` tinyint(1) NOT NULL,
  `automatico` tinyint(1) NOT NULL,
  `permanente` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_tipo_deuda`
--

LOCK TABLES `n_tipo_deuda` WRITE;
/*!40000 ALTER TABLE `n_tipo_deuda` DISABLE KEYS */;
INSERT INTO `n_tipo_deuda` VALUES (1,'Pensión Alimenticia (Mensualidad)',1,'Con Terceros',1,1,1),(2,'Embargos Judiciales',4,'Con Terceros',1,1,0),(3,'Adelantos de salario',5,'Con la Entidad',1,0,0),(4,'Préstamos JMGA',6,'Con Terceros',1,0,0),(5,'Uniformes',7,'Con la Entidad',1,0,0),(6,'Exámenes Psicológicos',8,'Con Terceros',1,0,0),(7,'Otros Rebajos',13,'Con la Entidad',1,0,0),(8,'Benedetti',15,'Con la Entidad',1,0,1),(9,'Préstamos Corcoinsa',10,'Con Terceros',1,0,0),(10,'Dictámenes Médicos',9,'Con la Entidad',1,0,0),(11,'Retenciones Sindicato SITEPP',11,'Con Terceros',1,0,0),(12,'Retenciones Sindicato UNT',12,'Con Terceros',1,0,0),(13,'Daños Equipos',14,'Con la Entidad',1,0,0),(14,'Retenciones Sindicato ANEP',16,'Con Terceros',1,0,0),(15,'Retenciones Sindicato SINTRADEPP',17,'Con Terceros',1,0,0),(16,'Retenciones Sindicato SINTRAJAP',18,'Con Terceros',1,0,0);
/*!40000 ALTER TABLE `n_tipo_deuda` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 11:02:52
