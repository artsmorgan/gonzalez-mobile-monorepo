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
-- Table structure for table `n_bonificacion_plaza`
--

DROP TABLE IF EXISTS `n_bonificacion_plaza`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_bonificacion_plaza` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `paga_en_planilla_ordinaria` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_bonificacion_plaza`
--

LOCK TABLES `n_bonificacion_plaza` WRITE;
/*!40000 ALTER TABLE `n_bonificacion_plaza` DISABLE KEYS */;
INSERT INTO `n_bonificacion_plaza` VALUES (4,'Alquiler de Motocicleta',0),(5,'Bonificación Coordinación G10',1),(6,'Viáticos Coordinación G5',0),(7,'Bonificación Coordinador Aseo',1),(8,'Viáticos Turno Diurno HSVP',0),(9,'Bonificación Supervisión',1),(10,'Viáticos X-61 CUBREALMUERZOS',0),(11,'Honorarios',0),(12,'Alquiler',0),(13,'Bonificación Recargo de Funciones',1),(14,'Viáticos',0),(15,'Bonificación Cubrealmuerzos',1),(16,'Bonificación Supervisor-Cubrealmuerzos ICE San Marcos Tarrazu',1),(17,'Alquiler de Vehículo',0),(18,'Bonificación BCCR',1),(19,'Bonificación Embajada',1),(20,'Bonificación Ejecutivo de Cuenta',1),(21,'Bonificación Supervision + Viaticos',1),(22,'Bonificación Asistente de Operaciones',1),(23,'Bonificación ICE ESPECIAL',1),(24,'Bonificacion Servicio Especial',1),(25,'Viáticos Comodin',0),(26,'Viáticos Coordinación Seguridad',0),(27,'Bonificación Coordinador TEC',1),(28,'VIATICOS CUBREALMUERZOS + SUPERVISION',0),(29,'Bonificación Coordinador',1),(30,'Bonificación ajuste minimo',0);
/*!40000 ALTER TABLE `n_bonificacion_plaza` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:56:07
