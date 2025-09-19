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
-- Table structure for table `n_tipo_licencia`
--

DROP TABLE IF EXISTS `n_tipo_licencia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_tipo_licencia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
  `codigo` varchar(150) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_tipo_licencia`
--

LOCK TABLES `n_tipo_licencia` WRITE;
/*!40000 ALTER TABLE `n_tipo_licencia` DISABLE KEYS */;
INSERT INTO `n_tipo_licencia` VALUES (1,'A1','Tipo A1 (0 a 125cc) Bicimoto y motocicleta. (Hasta 250 cc) cuadr'),(2,'A2','Tipo A2 (126 a 500 cc) Bicimoto y motocicleta. (256 hasta los 50'),(3,'A3','Tipo A3 (501 cc en adelante) Bicimoto o motocicleta, cuadriciclo'),(4,'B1','Vehículo < 4000 kg'),(5,'B2','Vehículo 4001 a 8000 Kg'),(6,'B3','Tipo B3 (8.001 Kg en adelante, excepto vehículos pesados articul'),(7,'B4','Tipo B4 (8.001 Kg, vehículos pesados articulados), Vehículo comp'),(8,'C2','Vehículos como Autobús, Buseta y Microbús'),(9,'D1','Vehículos tractores de llanta'),(10,'D2','Tractor de oruga'),(11,'D3','Otro equipo especial no contemplado como D-1 o D-2');
/*!40000 ALTER TABLE `n_tipo_licencia` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:51:45
