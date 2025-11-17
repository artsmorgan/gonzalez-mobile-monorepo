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
-- Table structure for table `e_empleado_lista_negra`
--

DROP TABLE IF EXISTS `e_empleado_lista_negra`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `e_empleado_lista_negra` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empleado_id` int(11) DEFAULT NULL,
  `cliente_id` int(11) DEFAULT NULL,
  `fecha` date DEFAULT NULL,
  `observaciones` varchar(254) COLLATE utf8_unicode_ci DEFAULT NULL,
  `sucursal_id` int(11) DEFAULT NULL,
  `$en_cliente_completo` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_69D24DF1952BE730` (`empleado_id`),
  KEY `IDX_69D24DF1DE734E51` (`cliente_id`),
  KEY `IDX_69D24DF1279A5D5E` (`sucursal_id`),
  CONSTRAINT `FK_69D24DF1279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal` (`id`),
  CONSTRAINT `FK_69D24DF1952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_69D24DF1DE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `e_empleado_lista_negra`
--

LOCK TABLES `e_empleado_lista_negra` WRITE;
/*!40000 ALTER TABLE `e_empleado_lista_negra` DISABLE KEYS */;
INSERT INTO `e_empleado_lista_negra` VALUES (1,3621,96,'2021-01-01','PROBLEMA CON EL CLIENTE',689,1),(2,4492,73,'2022-07-01','EL OFICIAL TIENE UNA QUEJA POR IRRESPETUOSO Y NO PUEDE SER ASIGNADO',191,0),(3,6228,123,'2022-07-29','qUEJA DEL CLIENTE',804,1),(4,11669,175,'2025-05-07','ANABELLE SALAZAR MATA cedula 603050967, NO cuenta con visto bueno para realizar labores de limpieza en el PJ.',958,1),(5,10902,89,'2025-05-02','Queda vetada por decisión del cliente',1166,1),(6,9712,60,'2025-03-28','Vetado por decisión del cliente',351,1),(7,9326,81,'2025-03-28','vetado por decisión del cliente',779,1);
/*!40000 ALTER TABLE `e_empleado_lista_negra` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:52:54
