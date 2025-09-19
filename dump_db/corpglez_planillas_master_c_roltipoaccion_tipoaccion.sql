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
-- Table structure for table `c_roltipoaccion_tipoaccion`
--

DROP TABLE IF EXISTS `c_roltipoaccion_tipoaccion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_roltipoaccion_tipoaccion` (
  `croltipoaccion_id` int(11) NOT NULL,
  `ctipoaccion_id` int(11) NOT NULL,
  PRIMARY KEY (`croltipoaccion_id`,`ctipoaccion_id`),
  KEY `IDX_48CD1A52C9F2F869` (`croltipoaccion_id`),
  KEY `IDX_48CD1A52E93DD86B` (`ctipoaccion_id`),
  CONSTRAINT `FK_48CD1A52C9F2F869` FOREIGN KEY (`croltipoaccion_id`) REFERENCES `c_rol_tipoaccion` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_48CD1A52E93DD86B` FOREIGN KEY (`ctipoaccion_id`) REFERENCES `c_tipo_accion` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_roltipoaccion_tipoaccion`
--

LOCK TABLES `c_roltipoaccion_tipoaccion` WRITE;
/*!40000 ALTER TABLE `c_roltipoaccion_tipoaccion` DISABLE KEYS */;
INSERT INTO `c_roltipoaccion_tipoaccion` VALUES (1,5),(1,12),(1,13),(2,3),(2,5),(2,6),(2,7),(2,9),(2,10),(2,11),(2,12),(2,13),(2,14),(2,15),(2,24),(2,25),(2,26),(2,29),(3,3),(3,5),(3,6),(3,7),(3,8),(3,9),(3,10),(3,12),(3,13),(3,14),(3,24),(3,25),(3,26),(3,28),(3,29),(4,1),(4,3),(4,4),(4,5),(4,6),(4,7),(4,8),(4,9),(4,10),(4,11),(4,12),(4,14),(4,15),(4,16),(4,17),(4,18),(4,19),(4,20),(4,21),(4,22),(4,23),(4,24),(4,25),(4,27),(4,29),(4,30),(4,31),(5,2),(5,3),(5,6),(5,7),(5,9),(5,10),(6,3),(6,5),(6,6),(6,7),(6,9),(6,10),(6,12),(6,13),(6,14),(6,15),(6,25),(7,3),(7,5),(7,6),(7,7),(7,9),(7,10),(7,11),(7,12),(7,13),(7,14),(7,15),(7,24),(7,25),(7,26),(7,28),(7,29),(8,1),(8,3),(8,5),(8,6),(8,7),(8,8),(8,9),(8,10),(8,12),(8,13),(8,14),(8,15),(8,24),(8,25),(8,26),(8,28),(8,29),(8,30),(9,5),(9,9),(9,10),(10,5),(10,6),(10,7),(10,9),(10,10),(10,12),(10,13),(10,14),(11,3),(11,5),(11,6),(11,7),(11,8),(11,9),(11,10),(11,11),(11,12),(11,13),(11,14),(11,15),(11,24),(11,25),(11,26),(11,28),(11,29),(11,30),(12,1),(12,2),(12,3),(12,4),(12,5),(12,6),(12,7),(12,8),(12,9),(12,10),(12,11),(12,12),(12,13),(12,14),(12,15),(12,16),(12,17),(12,18),(12,19),(12,20),(12,21),(12,22),(12,23),(12,24),(12,25),(12,26),(12,27),(12,28),(12,29),(12,30),(13,1),(13,3),(13,4),(13,5),(13,6),(13,7),(13,8),(13,9),(13,10),(13,11),(13,12),(13,13),(13,14),(13,15),(13,16),(13,17),(13,18),(13,19),(13,20),(13,21),(13,22),(13,23),(13,24),(13,25),(13,26),(13,27),(13,28),(13,29),(13,30),(13,31),(14,5),(14,6),(14,7),(14,9),(14,14),(14,15),(15,5),(15,12);
/*!40000 ALTER TABLE `c_roltipoaccion_tipoaccion` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 11:01:20
