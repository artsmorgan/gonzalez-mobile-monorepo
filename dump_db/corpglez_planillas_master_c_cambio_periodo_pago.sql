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
-- Table structure for table `c_cambio_periodo_pago`
--

DROP TABLE IF EXISTS `c_cambio_periodo_pago`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_cambio_periodo_pago` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `periodoPagoInicial_id` int(11) DEFAULT NULL,
  `periodoPagoFinal_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_C869871ABB712BEE` (`periodoPagoInicial_id`),
  KEY `IDX_C869871ACD4171BE` (`periodoPagoFinal_id`),
  CONSTRAINT `FK_C869871ABB712BEE` FOREIGN KEY (`periodoPagoInicial_id`) REFERENCES `p_periodopago_config` (`id`),
  CONSTRAINT `FK_C869871ACD4171BE` FOREIGN KEY (`periodoPagoFinal_id`) REFERENCES `p_periodopago_config` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_cambio_periodo_pago`
--

LOCK TABLES `c_cambio_periodo_pago` WRITE;
/*!40000 ALTER TABLE `c_cambio_periodo_pago` DISABLE KEYS */;
INSERT INTO `c_cambio_periodo_pago` VALUES (1,1,2),(2,2,1),(3,2,1),(4,2,1),(5,2,1),(6,2,1),(7,2,1),(8,2,1),(9,2,1),(10,2,1),(11,2,1),(12,2,1),(13,2,1),(14,2,1),(15,2,1),(16,1,2),(17,2,1),(18,1,2),(19,1,2),(20,1,2),(21,1,2),(22,2,1),(23,1,2),(24,1,2),(25,2,1),(26,1,2),(27,1,2),(28,1,2),(29,1,2),(30,1,2),(31,1,2),(32,1,2),(33,1,2),(34,1,2),(35,1,2),(36,1,2),(37,1,2),(38,1,2),(39,1,2),(40,1,2),(41,2,1),(42,2,1),(43,1,2),(44,2,1),(45,1,2),(46,2,1),(47,2,1),(48,1,2),(49,1,2),(50,1,2),(51,2,1),(52,1,2),(53,1,2),(54,1,2),(55,1,2),(56,1,2),(57,1,2),(58,1,2),(59,1,2),(60,1,2),(61,1,2),(62,2,1),(63,1,2),(64,1,2),(65,1,2),(66,1,2),(67,1,2),(68,1,2),(69,1,2),(70,2,1);
/*!40000 ALTER TABLE `c_cambio_periodo_pago` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:48:29
