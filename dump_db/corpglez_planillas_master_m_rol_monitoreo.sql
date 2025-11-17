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
-- Table structure for table `m_rol_monitoreo`
--

DROP TABLE IF EXISTS `m_rol_monitoreo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `m_rol_monitoreo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  `observaciones` varchar(254) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `m_rol_monitoreo`
--

LOCK TABLES `m_rol_monitoreo` WRITE;
/*!40000 ALTER TABLE `m_rol_monitoreo` DISABLE KEYS */;
INSERT INTO `m_rol_monitoreo` VALUES (3,'RADIO OPERADOR',NULL),(6,'Aseo a Nivel Nacional',NULL),(8,'MAG-Aseo','mchacon'),(9,'SFE-Aseo','Katia'),(10,'MCJ Cenac-Aseo','povares'),(11,'INS Museo de Jade-Aseo',NULL),(12,'MCJ Aduana-Aseo','cperez'),(13,'REGIONALES','Sonia Azofeifa'),(14,'CUENTAS HAROLD','Harold Rodriguez'),(15,'CUENTAS HAROLD 2','Harold Rodriguez'),(16,'SEGURIDAD LIMON','Jorge Arias'),(17,'SUPERVISORES GAM','Marlon Chavarria'),(18,'SEGURIDAD SAN CARLOS','Martin Sandoval'),(19,'SEGURIDAD ZONA SUR','Francisco López M.'),(20,'SEGURIDAD PUNTARENAS','Jonathan Tellez'),(21,'SEGURIDAD GUAPILES','Geovanny Cardenas'),(22,'SEGURIDAD PEREZ ZELEDON','Ronald Valverde'),(23,'SEGURIDAD GUANACASTE','Rafael Talavera'),(24,'IAFA-Aseo','Jessica'),(25,'RECOPE-Aseo',NULL),(26,'BCCR',NULL),(27,'Especial','Jorge Rojas'),(29,'INCR-ASEO',NULL),(30,'GAM Y REGIONAL','Mario Murillo'),(31,'IMAS-Aseo',NULL),(32,'INFOCOOP-ASEO',NULL),(33,'CCSS-Los Chiles ASEO',NULL),(35,'MH LLACUNA DGT-ASEO',NULL),(36,'MH LLACUNA DGA-ASEO',NULL),(37,'MH EDIFICIO DUO-ASEO',NULL),(38,'MH EDIFICIO 2X1-ASEO',NULL),(39,'MH EDIFICIO CENTRAL-ASEO',NULL),(40,'MH EDIFICIO LA VIRGEN-ASEO','rvargasc'),(41,'MH EDIFICIO SIGMA-ASEO','ETorres'),(42,'SEGURIDAD GUANACASTE-ZONA NORTE','Jimmy Nuñez'),(43,'SEGURIDAD QUEPOS','Arturo Salas'),(44,'Seg - San Ramón','Sandra Noguera'),(45,'DGAC-AITB','Pamela Castillo'),(46,'DGAC-AIJSM',NULL),(47,'AYL Noche y Fin De Semana','Monitorean L-V 6pm a 6am y fines de semana 24h'),(48,'CCSS-Carillo ASEO',NULL),(49,'CCSS-Coronado ASEO',NULL),(50,'Atenas',NULL),(51,'SEG-PIMA',NULL),(52,'MTSS',NULL),(53,'SEGURIDAD NICOYA','Ronald Alvarado'),(54,'SEGURIDAD COTO BRUS','Diego Muñoz'),(55,'AYL- HWAT',NULL),(56,'AYL-HWAT',NULL),(57,'ayl- muni belen',NULL),(58,'AYL-DNN',NULL),(60,'AYL-ÁREA DE SALUD PALMARES',NULL),(61,'PJCR-Aseo',NULL),(62,'PJCR Alajuela- Aseo',NULL),(63,'PJCR Ciudad Judicial - Aseo',NULL),(64,'PJCR Heredia - ASEO',NULL),(65,'PJCR Grecia - Aseo',NULL),(66,'PJCR san ramon - Aseo',NULL),(67,'PJCR torre z - Aseo',NULL),(68,'PJCR Guadalupe - Aseo',NULL),(69,'PJCR San Jose Centro - Aseo',NULL),(70,'PJCR Cartago -Aseo',NULL),(71,'SEGURIDAD JAPDEVA','Stephanie Molina Madrigal'),(73,'AREA DE SALUD CARLOS DURAN CARTIN',NULL),(74,'GAM OESTE','MARIAN RODRIGUEZ'),(75,'GAM ASEO -NACIONAL 2',NULL),(76,'CUBRE VACACIONES ASEO',NULL),(77,'COMODINES TURRIALBA','Comodines Turrialba -Cartago');
/*!40000 ALTER TABLE `m_rol_monitoreo` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:52:59
