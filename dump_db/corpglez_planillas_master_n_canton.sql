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
-- Table structure for table `n_canton`
--

DROP TABLE IF EXISTS `n_canton`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_canton` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `provincia_id` int(11) DEFAULT NULL,
  `nombre` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_9F82AC3C4E7121AF` (`provincia_id`),
  CONSTRAINT `FK_9F82AC3C4E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_canton`
--

LOCK TABLES `n_canton` WRITE;
/*!40000 ALTER TABLE `n_canton` DISABLE KEYS */;
INSERT INTO `n_canton` VALUES (1,1,'Alajuela '),(2,1,'San Ramón '),(3,1,'Grecia '),(4,1,'San Mateo '),(5,1,'Atenas '),(6,1,'Naranjo '),(7,1,'Palmares '),(8,1,'Poás '),(9,1,'Orotina '),(10,1,'San Carlos '),(11,1,'Zarcero '),(12,1,'Valverde Vega '),(13,1,'Upala '),(14,1,'Los Chiles '),(15,1,'Guatuso '),(16,2,'San José '),(17,2,'Escazú '),(18,2,'Desamparados '),(19,2,'Puriscal '),(20,2,'Tarrazú '),(21,2,'Aserrí '),(22,2,'Mora '),(23,2,'Goicoechea '),(24,2,'Santa Ana '),(25,2,'Alajuelita '),(26,2,'Vásquez de Coronado '),(27,2,'Acosta '),(28,2,'Tibás '),(29,2,'Moravia '),(30,2,'Montes de Oca '),(31,2,'Turrubares '),(32,2,'Dota '),(33,2,'Curridabat'),(34,2,'Pérez Zeledón '),(35,2,'León Cortés '),(36,3,'Cartago '),(37,3,'Paraíso '),(38,3,'La Unión '),(39,3,'Jiménez '),(40,3,'Turrialba '),(41,3,'Alvarado '),(42,3,'Oreamuno '),(43,3,'El Guarco '),(44,4,'Heredia'),(45,4,'Barva '),(46,4,'Santo Domingo '),(47,4,'Santa Bárbara '),(48,4,'San Rafael '),(49,4,'San Isidro '),(50,4,'Belén '),(51,4,'Flores '),(52,4,'San Pablo '),(53,4,'Sarapiquí '),(54,5,'Limón '),(55,5,'Pococí '),(56,5,'Siquirres '),(57,5,'Talamanca '),(58,5,'Matina '),(59,5,'Guácimo '),(60,6,'Puntarenas '),(61,6,'Esparza '),(62,6,'Buenos Aires '),(63,6,'Montes de Oro '),(64,6,'Osa '),(65,6,'Quepos '),(66,6,'Golfito '),(67,6,'Coto Brus '),(68,6,'Parrita '),(69,6,'Corredores '),(70,6,'Garabito '),(71,7,'Liberia '),(72,7,'Nicoya '),(73,7,'Santa Cruz '),(74,7,'Bagaces '),(75,7,'Carrillo '),(76,7,'Cañas '),(77,7,'Abangares '),(78,7,'Tilarán '),(79,7,'Nandayure '),(80,7,'La Cruz '),(81,7,'Hojancha ');
/*!40000 ALTER TABLE `n_canton` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:38:04
