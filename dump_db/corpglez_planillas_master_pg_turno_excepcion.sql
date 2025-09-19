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
-- Table structure for table `pg_turno_excepcion`
--

DROP TABLE IF EXISTS `pg_turno_excepcion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pg_turno_excepcion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_turno` varchar(1) COLLATE utf8_unicode_ci NOT NULL,
  `cantidad_horas` decimal(10,2) NOT NULL,
  `tipo_excepcion` varchar(3) COLLATE utf8_unicode_ci NOT NULL,
  `horas_extra_excepcion` decimal(10,2) NOT NULL,
  `categoriaSalarial_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_9DAD81FEF4C2234D` (`categoriaSalarial_id`),
  CONSTRAINT `FK_9DAD81FEF4C2234D` FOREIGN KEY (`categoriaSalarial_id`) REFERENCES `pg_categoria_salarial` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pg_turno_excepcion`
--

LOCK TABLES `pg_turno_excepcion` WRITE;
/*!40000 ALTER TABLE `pg_turno_excepcion` DISABLE KEYS */;
INSERT INTO `pg_turno_excepcion` VALUES (1,'D',4.00,'RHS',0.00,101),(2,'D',5.50,'RHE',0.00,103),(3,'D',11.00,'EXT',3.00,103),(4,'D',9.00,'RHS',0.00,114),(5,'D',9.00,'RHS',0.00,1),(6,'D',10.00,'RHS',0.00,1),(7,'D',5.00,'RHS',0.00,144),(8,'D',5.00,'RHS',0.00,187),(9,'D',4.00,'RHS',0.00,145),(10,'D',8.00,'RHS',0.00,97),(11,'D',4.00,'RHS',0.00,97),(12,'D',9.00,'RHS',0.00,195),(13,'D',6.00,'RHS',0.00,178),(14,'D',6.00,'RHS',0.00,211),(15,'D',6.00,'RHS',0.00,194),(16,'D',5.00,'RHS',0.00,194),(17,'D',9.60,'RHS',0.00,1),(18,'D',8.00,'RHS',0.00,1),(19,'D',9.50,'EXT',1.50,214),(20,'N',12.00,'EXT',3.00,NULL),(21,'N',8.00,'EXT',1.00,NULL),(22,'N',9.00,'EXT',2.00,NULL),(23,'N',12.00,'EXT',3.00,NULL),(24,'N',8.00,'EXT',1.00,NULL),(25,'D',4.00,'RHS',0.00,338),(26,'D',7.50,'RHS',0.00,187),(27,'D',6.00,'RHS',0.00,187),(28,'D',9.00,'RHS',0.00,101),(29,'D',8.50,'RHS',0.00,274),(30,'D',9.00,'RHS',0.00,274),(31,'D',10.00,'RHS',0.00,274),(32,'D',12.00,'RHE',0.00,128);
/*!40000 ALTER TABLE `pg_turno_excepcion` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:50:16
