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
-- Table structure for table `e_estructura_empleado_autorizado_contrato`
--

DROP TABLE IF EXISTS `e_estructura_empleado_autorizado_contrato`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `e_estructura_empleado_autorizado_contrato` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contrato_id` int(11) DEFAULT NULL,
  `empleado_id` int(11) DEFAULT NULL,
  `descripcion` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_8E302ED270AE7BF1` (`contrato_id`),
  KEY `IDX_8E302ED2952BE730` (`empleado_id`),
  CONSTRAINT `FK_8E302ED270AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato` (`id`),
  CONSTRAINT `FK_8E302ED2952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `e_estructura_empleado_autorizado_contrato`
--

LOCK TABLES `e_estructura_empleado_autorizado_contrato` WRITE;
/*!40000 ALTER TABLE `e_estructura_empleado_autorizado_contrato` DISABLE KEYS */;
INSERT INTO `e_estructura_empleado_autorizado_contrato` VALUES (1,93,5659,'Monitoreo, MOravia Y supervision'),(2,93,5525,'Monitoreo, Moravia y supervision'),(3,93,5339,'Supervision'),(4,93,5461,'Moravia, ODM, Plaza, Periferias'),(5,93,3623,'Periferias y casetas'),(6,93,5531,'Vestibulo y casetas'),(7,93,4622,'Supervision'),(8,49,4625,'Embajada'),(9,49,5339,'Embajada'),(10,49,5250,'Embajada'),(11,49,4477,'Emabajda'),(12,7,3944,'Todos Los puestos'),(13,7,3937,'Todos los puestos'),(14,7,3939,'Todos los Puestos'),(15,7,4419,'Todos los Puestos'),(16,7,4625,'Todos Los puestos'),(17,7,4501,'Todos Los puestos'),(18,7,3942,'Todos Los puestos'),(19,7,5154,'Todos los puestos'),(20,113,4644,NULL),(21,355,10663,NULL),(22,355,7713,NULL),(23,355,5153,NULL);
/*!40000 ALTER TABLE `e_estructura_empleado_autorizado_contrato` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:48:14
