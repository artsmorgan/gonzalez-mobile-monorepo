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
-- Table structure for table `e_registro_habilidades`
--

DROP TABLE IF EXISTS `e_registro_habilidades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `e_registro_habilidades` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empleado_id` int(11) DEFAULT NULL,
  `cepillos_industriales` tinyint(1) NOT NULL,
  `moto_guadannas` tinyint(1) NOT NULL,
  `aspiradora_industrial` tinyint(1) NOT NULL,
  `hidrolavadora` tinyint(1) NOT NULL,
  `limpieza_alturas` tinyint(1) NOT NULL,
  `maquina_vapor` tinyint(1) NOT NULL,
  `carro` tinyint(1) NOT NULL,
  `motocicleta` tinyint(1) NOT NULL,
  `bicicleta` tinyint(1) NOT NULL,
  `equipo_computo` tinyint(1) NOT NULL,
  `ms_office` tinyint(1) NOT NULL,
  `extintores` tinyint(1) NOT NULL,
  `primeros_auxilios` tinyint(1) NOT NULL,
  `rcp` tinyint(1) NOT NULL,
  `control_acceso` tinyint(1) NOT NULL,
  `monitoreo_alarmas` tinyint(1) NOT NULL,
  `monitoreo_camaras` tinyint(1) NOT NULL,
  `escaner_cedulas` tinyint(1) NOT NULL,
  `detector_metales` tinyint(1) NOT NULL,
  `arma_fuego` tinyint(1) NOT NULL,
  `arma_no_letal` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_7BA0E6E9952BE730` (`empleado_id`),
  CONSTRAINT `FK_7BA0E6E9952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `e_registro_habilidades`
--

LOCK TABLES `e_registro_habilidades` WRITE;
/*!40000 ALTER TABLE `e_registro_habilidades` DISABLE KEYS */;
/*!40000 ALTER TABLE `e_registro_habilidades` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:58:51
