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
-- Table structure for table `n_empresa_banco`
--

DROP TABLE IF EXISTS `n_empresa_banco`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_empresa_banco` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `banco_id` int(11) DEFAULT NULL,
  `empresa_id` int(11) DEFAULT NULL,
  `numero` varchar(100) COLLATE utf8_unicode_ci NOT NULL,
  `moneda` varchar(20) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_F5709BC0CC04A73E` (`banco_id`),
  KEY `IDX_F5709BC0521E1991` (`empresa_id`),
  CONSTRAINT `FK_F5709BC0521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa` (`id`),
  CONSTRAINT `FK_F5709BC0CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_empresa_banco`
--

LOCK TABLES `n_empresa_banco` WRITE;
/*!40000 ALTER TABLE `n_empresa_banco` DISABLE KEYS */;
INSERT INTO `n_empresa_banco` VALUES (1,1,10,'100012020001432','colon'),(2,3,10,'CR930104091142211652411','colon'),(3,1,9,'100010001881184','colon'),(4,3,9,'CR31010409142209798111','colon'),(5,4,10,'CR70010200009412388345','colon'),(6,4,9,'CR15010200009575276585','colon');
/*!40000 ALTER TABLE `n_empresa_banco` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:43:10
