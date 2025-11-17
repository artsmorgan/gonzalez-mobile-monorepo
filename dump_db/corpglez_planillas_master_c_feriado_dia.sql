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
-- Table structure for table `c_feriado_dia`
--

DROP TABLE IF EXISTS `c_feriado_dia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_feriado_dia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(254) COLLATE utf8_unicode_ci DEFAULT NULL,
  `fecha` date DEFAULT NULL,
  `pago_obligatorio` tinyint(1) DEFAULT NULL,
  `feriadoCalendario_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_9B00E14AB1C52DFC` (`feriadoCalendario_id`),
  CONSTRAINT `FK_9B00E14AB1C52DFC` FOREIGN KEY (`feriadoCalendario_id`) REFERENCES `c_feriado_calendario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_feriado_dia`
--

LOCK TABLES `c_feriado_dia` WRITE;
/*!40000 ALTER TABLE `c_feriado_dia` DISABLE KEYS */;
INSERT INTO `c_feriado_dia` VALUES (1,'Año Nuevo','2016-01-01',1,1),(2,'Día de Juan Santamaría','2016-04-11',1,1),(3,'Día Internacional del Trabajo','2016-05-01',1,1),(4,'Anexión del Partido de Nicoya a Costa Rica','2016-07-25',1,1),(5,'Día de la Madre','2016-08-15',1,1),(6,'Independencia de Costa Rica','2016-09-15',1,1),(7,'Navidad','2016-12-25',1,1),(8,'Día de la Virgen de los Ángeles','2016-08-02',0,1),(9,'Día de las Culturas','2016-10-12',0,1),(10,'Año Nuevo','2017-01-01',1,2),(11,'Día de Juan Santamaría','2017-04-11',1,2),(12,'Día Internacional del Trabajo','2017-05-01',1,2),(13,'Anexión del Partido de Nicoya a Costa Rica','2017-07-25',1,2),(14,'Día de la Madre','2017-08-15',1,2),(15,'Independencia de Costa Rica','2017-09-15',1,2),(16,'Navidad','2017-12-25',1,2),(17,'Día de la Virgen de los Ángeles','2017-08-02',0,2),(18,'Día de las Culturas','2017-10-12',0,2),(19,'Jueves Santo','2017-04-13',1,2),(20,'Viernes Santo','2017-04-14',1,2),(21,'Año Nuevo','2018-01-01',1,3),(22,'Día de Juan Santamaría','2018-04-11',1,3),(23,'Día Internacional del Trabajo','2018-05-01',1,3),(24,'Anexión del Partido de Nicoya a Costa Rica','2018-07-25',1,3),(25,'Día de la Madre','2018-08-15',1,3),(26,'Independencia de Costa Rica','2018-09-15',1,3),(27,'Navidad','2018-12-25',1,3),(28,'Día de la Virgen de los Ángeles','2018-08-02',0,3),(29,'Día de las Culturas','2018-10-12',0,3),(30,'Jueves Santo','2018-03-29',1,3),(31,'Viernes Santo','2018-03-30',1,3),(32,'Año Nuevo','2019-01-01',1,4),(33,'Día de Juan Santamaría','2019-04-11',1,4),(34,'Día Internacional del Trabajo','2019-05-01',1,4),(35,'Anexión del Partido de Nicoya a Costa Rica','2019-07-25',1,4),(36,'Día de la Madre','2019-08-15',1,4),(37,'Independencia de Costa Rica','2019-09-15',1,4),(38,'Navidad','2019-12-25',1,4),(39,'Día de la Virgen de los Ángeles','2019-08-02',0,4),(40,'Día de las Culturas','2019-10-12',0,4),(41,'Jueves Santo','2019-04-18',1,4),(42,'Viernes Santo','2019-04-19',1,4),(43,'Año Nuevo','2020-01-01',1,5),(44,'Día de Juan Santamaría','2020-04-11',1,5),(45,'Día Internacional del Trabajo','2020-05-01',1,5),(46,'Anexión del Partido de Nicoya a Costa Rica','2020-07-27',1,5),(47,'Día de la Madre','2020-08-17',1,5),(48,'Independencia de Costa Rica','2020-09-14',1,5),(49,'Navidad','2020-12-25',1,5),(50,'Día de la Virgen de los Ángeles','2020-08-02',0,5),(51,'Dia Abolicion del Ejercito','2020-11-30',0,5),(52,'Jueves Santo','2020-04-09',1,5),(53,'Viernes Santo','2020-04-10',1,5),(54,'Año Nuevo','2021-01-01',1,6),(55,'Día de Juan Santamaría','2021-04-11',1,6),(56,'Día Internacional del Trabajo','2021-05-01',1,6),(57,'Anexión del Partido de Nicoya a Costa Rica','2021-07-25',1,6),(58,'Día de la Madre','2021-08-15',1,6),(59,'Independencia de Costa Rica','2021-09-13',1,6),(60,'Navidad','2021-12-25',1,6),(61,'Día de la Virgen de los Ángeles','2021-08-02',0,6),(62,'Dia Abolicion del Ejercito','2021-11-29',0,6),(63,'Jueves Santo','2021-04-01',1,6),(64,'Viernes Santo','2021-04-02',1,6),(65,'Año Nuevo','2022-01-01',1,7),(66,'Día de Juan Santamaría','2022-04-11',1,7),(67,'Día Internacional del Trabajo','2022-05-01',1,7),(68,'Anexión del Partido de Nicoya a Costa Rica','2022-07-25',1,7),(69,'Día de la Madre','2022-08-15',1,7),(70,'Independencia de Costa Rica','2022-09-19',1,7),(71,'Navidad','2022-12-25',1,7),(72,'Día de la Virgen de los Ángeles','2022-08-02',0,7),(73,'Dia Abolicion del Ejercito','2022-12-05',0,7),(74,'Jueves Santo','2022-04-14',1,7),(75,'Viernes Santo','2022-04-15',1,7),(76,'Día de la Persona Negra y la Cultura Afrocostarricense','2022-09-04',0,7),(77,'Año Nuevo','2023-01-01',1,8),(78,'Día de Juan Santamaría','2023-04-10',1,8),(79,'Día Internacional del Trabajo','2023-05-01',1,8),(80,'Anexión del Partido de Nicoya a Costa Rica','2023-07-24',1,8),(81,'Día de la Madre','2023-08-14',1,8),(82,'Independencia de Costa Rica','2023-09-15',1,8),(83,'Navidad','2023-12-25',1,8),(84,'Día de la Virgen de los Ángeles','2023-08-02',0,8),(85,'Dia Abolicion del Ejercito','2023-12-01',0,8),(86,'Jueves Santo','2023-04-06',1,8),(87,'Viernes Santo','2023-04-07',1,8),(88,'Día de la Persona Negra y la Cultura Afrocostarricense','2023-09-03',0,8),(89,'Año Nuevo','2024-01-01',1,9),(90,'Día de Juan Santamaría','2024-04-15',1,9),(91,'Día Internacional del Trabajo','2024-05-01',1,9),(92,'Anexión del Partido de Nicoya a Costa Rica','2024-07-25',1,9),(93,'Día de la Madre','2024-08-15',1,9),(94,'Independencia de Costa Rica','2024-09-15',1,9),(95,'Navidad','2024-12-25',1,9),(96,'Día de la Virgen de los Ángeles','2024-08-02',0,9),(97,'Dia Abolicion del Ejercito','2024-12-01',0,9),(98,'Jueves Santo','2024-03-28',1,9),(99,'Viernes Santo','2024-03-29',1,9),(100,'Día de la Persona Negra y la Cultura Afrocostarricense','2024-08-31',0,9),(101,'Año Nuevo','2025-01-01',1,10),(102,'Día de Juan Santamaría','2025-04-11',1,10),(103,'Día Internacional del Trabajo','2025-05-01',1,10),(104,'Anexión del Partido de Nicoya a Costa Rica','2025-07-25',1,10),(105,'Día de la Madre','2025-08-15',1,10),(106,'Independencia de Costa Rica','2025-09-15',1,10),(107,'Navidad','2025-12-25',1,10),(108,'Día de la Virgen de los Ángeles','2025-08-02',0,10),(109,'Dia Abolicion del Ejercito','2025-12-01',0,10),(110,'Jueves Santo','2025-04-17',1,10),(111,'Viernes Santo','2025-04-18',1,10),(112,'Día de la Persona Negra y la Cultura Afrocostarricense','2025-08-31',0,10);
/*!40000 ALTER TABLE `c_feriado_dia` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:49:17
