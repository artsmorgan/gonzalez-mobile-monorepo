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
-- Table structure for table `c_combo_uniforme_plaza`
--

DROP TABLE IF EXISTS `c_combo_uniforme_plaza`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_combo_uniforme_plaza` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQ_7E3DD1833A909126` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_combo_uniforme_plaza`
--

LOCK TABLES `c_combo_uniforme_plaza` WRITE;
/*!40000 ALTER TABLE `c_combo_uniforme_plaza` DISABLE KEYS */;
INSERT INTO `c_combo_uniforme_plaza` VALUES (2,'Combo Supervisor Corporación González',NULL),(3,'Combo Estandar Seguridad',NULL),(4,'Combo Ejecutivo de Cuenta',NULL),(5,'Combo Coopeande',NULL),(6,'Combo Estandar Misceláneo',NULL),(7,'Combo Cuadrilla AYL',NULL),(8,'Combo AYA',NULL),(9,'Combo Estándar',NULL),(10,'Combo Supervisión SEG/AL Corpo',NULL),(11,'Combo de Radiooperador',NULL),(14,'Combo cuadrilla AyL INS',NULL),(16,'Combo CNFL Estandar',NULL),(17,'CNFL Subestación',NULL),(18,'Combo CNFL Plantel',NULL),(19,'Combo Nuestro Amo y Belen, Vivero Coronado, La carpio, Rio Segundo (236-237-239-240-242-243-244-245-247-248)',NULL),(20,'Combo CNFL Sucursales',NULL),(21,'Combo Administrativos de Sucursales (Jornada Diurna)',NULL),(22,'Administrativos Diurno CNFL',NULL),(23,'Administrativos 24 Horas CNFL',NULL),(24,'ICE estándar',NULL),(25,'ICE Agencia',NULL),(26,'ICE Subestación',NULL),(27,'ICE Tomas de Agua',NULL),(28,'ICE Almacenes',NULL),(29,'ICE Radio Bases',NULL),(30,'ICE Centro de Operaciones',NULL),(31,'ICE Centro de Producción',NULL),(32,'ICE Vivero',NULL),(33,'ICE Casa de Máquinas',NULL),(34,'Misceláneo INS',NULL),(35,'Scrub',NULL),(36,'Miscelaneo Estandar',NULL),(37,'UTN',NULL),(38,'CNFL',NULL);
/*!40000 ALTER TABLE `c_combo_uniforme_plaza` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:44:37
