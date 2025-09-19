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
-- Table structure for table `n_region`
--

DROP TABLE IF EXISTS `n_region`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_region` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_region`
--

LOCK TABLES `n_region` WRITE;
/*!40000 ALTER TABLE `n_region` DISABLE KEYS */;
INSERT INTO `n_region` VALUES (1,'AYL -Central Occidental/Heredia'),(2,'AYL - San José/Region Central'),(3,'AYL - Central Occidental/Alajuela'),(4,'AYL - Central Oriental/Cartago'),(5,'SEG - GAM'),(6,'SEG - Guanacaste'),(7,'SEG - Guápiles'),(8,'SEG - Limón'),(9,'SEG - Zona Sur'),(10,'SEG - Puntarenas'),(11,'SEG - Zona Norte'),(12,'SEG - Perez Zeledón'),(13,'SEG - Upala'),(14,'SEG - Siquirres'),(15,'SEG - Cartago'),(16,'SEG - Turrialba'),(17,'SEG - San Ramón'),(18,'AYL-Chorotega/Pacifico Norte'),(19,'AYL-Brunca/Zona Sur'),(20,'AYL-Huetar Norte/San Carlos-Los Chiles'),(21,'AYL-Huetar Caribe/Limon'),(22,'AYL-Pacifico Central/Puntarenas'),(23,'AYL-Central Sur');
/*!40000 ALTER TABLE `n_region` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:46:15
