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
-- Table structure for table `n_pago_turno`
--

DROP TABLE IF EXISTS `n_pago_turno`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_pago_turno` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `turno_id` int(11) DEFAULT NULL,
  `nombre` varchar(80) COLLATE utf8_unicode_ci NOT NULL,
  `horas` int(11) NOT NULL,
  `salario_turno` decimal(10,2) NOT NULL,
  `categoriaPlaza_id` int(11) DEFAULT NULL,
  `salario_turno_dia_extra` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_971CFF1769C5211E` (`turno_id`),
  KEY `IDX_971CFF176065BC38` (`categoriaPlaza_id`),
  CONSTRAINT `FK_971CFF176065BC38` FOREIGN KEY (`categoriaPlaza_id`) REFERENCES `pg_categoria_salarial` (`id`),
  CONSTRAINT `FK_971CFF1769C5211E` FOREIGN KEY (`turno_id`) REFERENCES `n_turno` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_pago_turno`
--

LOCK TABLES `n_pago_turno` WRITE;
/*!40000 ALTER TABLE `n_pago_turno` DISABLE KEYS */;
INSERT INTO `n_pago_turno` VALUES (1,1,'Turno Diurno Miscelaneo 8 horas',8,9711.36,1,14567.04),(2,1,'Turno Diurno Oficial 8 horas',8,10560.41,2,15840.61),(3,1,'Turno Diurno Miscelaneo 9 horas',9,11532.24,1,17298.36),(5,1,'Turno Diurno Miscelaneo 10 horas',10,13353.12,1,20029.68),(9,2,'Turno Mixto Miscelaneo 8 horas',8,11792.37,1,16387.92),(10,2,'Turno Mixto Oficial 8 horas',8,12823.35,2,18103.56),(11,3,'Turno Nocturno Miscelaneo 8 horas',8,14537.04,1,18208.80),(12,3,'Turno Nocturno Oficial 8 horas',8,15840.61,2,21120.82);
/*!40000 ALTER TABLE `n_pago_turno` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:38:19
