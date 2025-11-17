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
-- Table structure for table `consultor_actualizacion_telefonos`
--

DROP TABLE IF EXISTS `consultor_actualizacion_telefonos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consultor_actualizacion_telefonos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actualizacion_id` int(11) NOT NULL,
  `tipo` varchar(20) COLLATE utf8_unicode_ci DEFAULT NULL,
  `numero` varchar(20) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_2CF2054CDF01D38` (`actualizacion_id`),
  CONSTRAINT `FK_2CF2054CDF01D38` FOREIGN KEY (`actualizacion_id`) REFERENCES `consultor_actualizacion` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=84 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `consultor_actualizacion_telefonos`
--

LOCK TABLES `consultor_actualizacion_telefonos` WRITE;
/*!40000 ALTER TABLE `consultor_actualizacion_telefonos` DISABLE KEYS */;
INSERT INTO `consultor_actualizacion_telefonos` VALUES (2,12,'celular','85246753'),(3,24,'celular','83504335'),(4,30,'celular','63128623'),(5,34,'celular','83445338'),(6,43,'celular','64701714'),(7,43,'celular','60308329'),(8,53,'celular','71302523'),(10,59,'celular','71039538'),(11,63,'celular','89871291'),(13,74,'celular','71603614'),(14,87,'celular','86878902'),(15,87,'celular','87929096'),(16,92,'celular','60202046'),(17,96,'celular','60101500'),(18,97,'celular','61405381'),(19,98,'celular','71047659'),(20,101,'celular','85410717'),(21,102,'celular','86070879'),(22,104,'celular','88786320'),(23,115,'celular','89183618'),(24,115,'celular','89154141'),(25,119,'celular','88784930'),(26,129,'celular','61431728'),(27,136,'celular','88284568'),(28,140,'celular','87325800'),(29,142,'celular','86840304'),(30,143,'celular','70121423'),(31,144,'celular','83812628'),(32,147,'celular','86810249'),(33,167,'celular','84231194'),(34,175,'celular','84234789'),(35,181,'celular','84023494'),(36,195,'celular','85600188'),(37,196,'celular','86110711'),(38,205,'celular','72919829'),(39,206,'celular','64248179'),(40,210,'celular','85420461'),(41,214,'celular','62774966'),(42,216,'celular','84831021'),(43,219,'celular','83583646'),(45,227,'celular','60662040'),(46,230,'celular','60868150'),(47,237,'celular','62207453'),(49,242,'celular','63656626'),(50,251,'celular','63899438'),(51,256,'celular','88523414'),(52,257,'celular','70691268'),(53,268,'celular','63651142'),(54,269,'celular','86021330'),(55,283,'celular','85443728'),(56,312,'celular','85952482'),(57,314,'celular','63032525'),(58,320,'celular','64033900'),(59,322,'celular','89917616'),(60,324,'celular','72919016'),(61,329,'celular','62970809'),(62,335,'celular','85957640'),(63,341,'celular','71983559'),(64,355,'celular','83318922'),(65,365,'celular','85130923'),(67,380,'celular','70115440'),(68,409,'celular','70971415'),(69,413,'celular','62971528'),(70,417,'celular','87099820'),(71,424,'celular','70371191'),(72,460,'celular','60201968'),(73,465,'celular','61588654'),(74,476,'celular','86152832'),(75,477,'celular','88873448'),(76,491,'celular','85535201'),(77,494,'celular','71328490'),(78,497,'celular','64642213'),(79,499,'celular','71766009'),(80,503,'celular','71417912'),(82,506,'celular','89986755'),(83,508,'celular','61244555');
/*!40000 ALTER TABLE `consultor_actualizacion_telefonos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:54:56
