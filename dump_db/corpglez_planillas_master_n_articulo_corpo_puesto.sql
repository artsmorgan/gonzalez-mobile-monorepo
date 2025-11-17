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
-- Table structure for table `n_articulo_corpo_puesto`
--

DROP TABLE IF EXISTS `n_articulo_corpo_puesto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_articulo_corpo_puesto` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_92DE8E473A909126` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_articulo_corpo_puesto`
--

LOCK TABLES `n_articulo_corpo_puesto` WRITE;
/*!40000 ALTER TABLE `n_articulo_corpo_puesto` DISABLE KEYS */;
INSERT INTO `n_articulo_corpo_puesto` VALUES (36,'Arma no letal similar pistola 9mm'),(17,'Aspiradora'),(40,'Black Jack'),(38,'Caja de Seguridad'),(7,'Carritos de Limpieza'),(15,'Celular Inteligente'),(4,'Cepillo 20\"'),(1,'Cepillo Eléctrico 13\"'),(18,'Cepillo Inodoro'),(39,'Chaleco Antibalas'),(14,'Cinturón'),(41,'Cinturón de Seguridad'),(10,'Coffee Maker'),(2,'Escalerita 3 peldaños'),(19,'Escoba'),(20,'Escobita'),(21,'Escobon'),(6,'Escurridor de Mecha'),(22,'Esponja Verde - Scott Brite'),(42,'Esposas'),(23,'Extension Eléctrica'),(12,'Foco'),(37,'Funda Táctica'),(43,'Gas Pimienta'),(24,'Guantes de Hule'),(25,'Guantes de Latex'),(3,'Hidrolavadora'),(26,'Lentes Protección'),(27,'Lija de Agua'),(44,'Linterna'),(46,'Locker'),(28,'Manguera'),(5,'Máquina de Vapor'),(29,'Mecha'),(11,'Mesa'),(9,'Microondas'),(30,'Pad Cepillo'),(31,'Pala Basura'),(32,'Palo de Piso'),(35,'Paños Microfibra'),(8,'Paraguas'),(16,'Placa Balística'),(33,'Rotulos Preventivos'),(13,'Silla'),(34,'Squeegee Hule'),(45,'Trampabalas');
/*!40000 ALTER TABLE `n_articulo_corpo_puesto` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:58:41
