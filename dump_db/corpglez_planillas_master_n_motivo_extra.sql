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
-- Table structure for table `n_motivo_extra`
--

DROP TABLE IF EXISTS `n_motivo_extra`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_motivo_extra` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `puede_pagar_comida` tinyint(1) NOT NULL,
  `tipoExtra_id` int(11) DEFAULT NULL,
  `codigo_accion_personal` varchar(10) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_A3B0B86EB5523D4D` (`tipoExtra_id`),
  CONSTRAINT `FK_A3B0B86EB5523D4D` FOREIGN KEY (`tipoExtra_id`) REFERENCES `n_tipo_extra` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_motivo_extra`
--

LOCK TABLES `n_motivo_extra` WRITE;
/*!40000 ALTER TABLE `n_motivo_extra` DISABLE KEYS */;
INSERT INTO `n_motivo_extra` VALUES (1,'Horas por X 33 Relevo',0,2,'TARD'),(2,'Horas por Llegada Tarde',0,2,'TARDH'),(3,'Horas por Cubrir Almuerzo',0,2,''),(4,'Extra por Ausencia',1,1,'AUS'),(5,'Extra por PSG',1,1,'PSG'),(6,'Extra por PCG',1,1,'PCG'),(7,'Extra por Suspensión',1,1,'SUS'),(8,'Extra por Incapacidad INS',1,1,'IINS'),(9,'Extra por Vacaciones',1,1,'VCD'),(10,'Extra por Preaviso',0,1,'PREAV'),(11,'Extra por Vacante',1,1,'VAC'),(12,'Extra en Inducción',0,1,''),(13,'Extra por Cubrir Almuerzo',0,1,''),(14,'Extra por Servicio Especial',1,1,''),(15,'Extra por Supervision',1,1,''),(16,'Extra por Tiempo Acumulado',1,1,''),(17,'Extra por Comodin',0,1,''),(18,'Extra por Ajuste de Rol',0,1,''),(19,'Adelanto Guardia',0,3,'ADG'),(20,'Extra por Refuerzo Día Completo',0,1,''),(21,'Extra por Incapacidad CCSS',1,1,'ICCSS'),(22,'Extra por Licencia de Maternidad',0,1,'LM'),(23,'Extra por Licencia Fase Terminal',0,1,'LFT'),(24,'Extra por cubrir Inducción',0,1,'V_IND'),(25,'Extra por Vacante x Cambio Guardia',1,1,'V_CDG'),(26,'Extra por Vacante x Adelanto Guardia',1,1,'V_ADG'),(27,'Cambio Guardia',0,3,'CDG'),(28,'Vacante x Mutuo Acuerdo (No Extra)',0,3,'V_MUT'),(29,'Mutuo Acuerdo',0,3,'MUT'),(30,'Horas por Salida Anticipada',1,2,'SA'),(31,'Extra por Salida Anticipada',1,1,'SA'),(32,'Extra en Refuerzo',0,1,'');
/*!40000 ALTER TABLE `n_motivo_extra` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:50:37
