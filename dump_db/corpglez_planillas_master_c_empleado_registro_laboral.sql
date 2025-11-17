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
-- Table structure for table `c_empleado_registro_laboral`
--

DROP TABLE IF EXISTS `c_empleado_registro_laboral`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_empleado_registro_laboral` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empleado_id` int(11) DEFAULT NULL,
  `descripcion` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `path` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `tipoRegistroLaboral_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_30CD41E5AC3051D` (`tipoRegistroLaboral_id`),
  KEY `IDX_30CD41E5952BE730` (`empleado_id`),
  CONSTRAINT `FK_30CD41E5952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado` (`id`),
  CONSTRAINT `FK_30CD41E5AC3051D` FOREIGN KEY (`tipoRegistroLaboral_id`) REFERENCES `n_tipo_registro_laboral` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_empleado_registro_laboral`
--

LOCK TABLES `c_empleado_registro_laboral` WRITE;
/*!40000 ALTER TABLE `c_empleado_registro_laboral` DISABLE KEYS */;
INSERT INTO `c_empleado_registro_laboral` VALUES (1,3913,'CUENTA CON NOTA DE PREVIO Y NO SUBSANÓ','b5350b80d09db32060fd192128272dd7de52ff53.pdf',NULL),(2,4079,'BOLETA DE UNIFORMES','2a0cc1a3601d3b2a7d02736b738485746d079d65.pdf',NULL);
/*!40000 ALTER TABLE `c_empleado_registro_laboral` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:52:21
