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
-- Table structure for table `p_planillas_bonificaciones_pagadas`
--

DROP TABLE IF EXISTS `p_planillas_bonificaciones_pagadas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `p_planillas_bonificaciones_pagadas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bonificacion_id` int(11) NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `planillaEmpleado_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_12CD276786CE56DC` (`bonificacion_id`),
  KEY `IDX_12CD2767799EE823` (`planillaEmpleado_id`),
  CONSTRAINT `FK_12CD2767799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado` (`id`),
  CONSTRAINT `FK_12CD276786CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `c_bonificaciones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `p_planillas_bonificaciones_pagadas`
--

LOCK TABLES `p_planillas_bonificaciones_pagadas` WRITE;
/*!40000 ALTER TABLE `p_planillas_bonificaciones_pagadas` DISABLE KEYS */;
/*!40000 ALTER TABLE `p_planillas_bonificaciones_pagadas` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:53:58
