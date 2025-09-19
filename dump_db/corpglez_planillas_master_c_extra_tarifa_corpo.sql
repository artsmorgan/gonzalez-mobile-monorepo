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
-- Table structure for table `c_extra_tarifa_corpo`
--

DROP TABLE IF EXISTS `c_extra_tarifa_corpo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_extra_tarifa_corpo` (
  `cextratarifa_id` int(11) NOT NULL,
  `sucursal_id` int(11) NOT NULL,
  PRIMARY KEY (`cextratarifa_id`,`sucursal_id`),
  KEY `IDX_E3FAC1FB3AD4FFE2` (`cextratarifa_id`),
  KEY `IDX_E3FAC1FB279A5D5E` (`sucursal_id`),
  CONSTRAINT `FK_E3FAC1FB279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_E3FAC1FB3AD4FFE2` FOREIGN KEY (`cextratarifa_id`) REFERENCES `c_extra_tarifa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_extra_tarifa_corpo`
--

LOCK TABLES `c_extra_tarifa_corpo` WRITE;
/*!40000 ALTER TABLE `c_extra_tarifa_corpo` DISABLE KEYS */;
INSERT INTO `c_extra_tarifa_corpo` VALUES (2,222),(3,534),(4,124),(4,342),(4,440),(4,668),(5,223),(6,226),(7,228),(8,219),(8,229),(9,138),(9,224),(9,227),(9,230),(10,354),(11,235),(11,236),(14,266),(16,238),(17,225),(17,411),(17,416),(18,420),(19,646),(19,664),(19,666),(20,623),(21,237),(21,419),(22,249),(22,427),(23,647),(24,623),(26,600),(27,354),(28,664),(28,666),(29,358),(32,689),(33,358),(35,866),(36,875),(37,875);
/*!40000 ALTER TABLE `c_extra_tarifa_corpo` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 11:01:26
