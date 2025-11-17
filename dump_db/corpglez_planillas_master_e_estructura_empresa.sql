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
-- Table structure for table `e_estructura_empresa`
--

DROP TABLE IF EXISTS `e_estructura_empresa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `e_estructura_empresa` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `numero_patronal` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `tipo_patrono` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `cedula_juridica` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `segregado` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `sector` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `codigo_sucursal_ccss` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `deleted` date DEFAULT NULL,
  `document` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `updated_at` date DEFAULT NULL,
  `codigo` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `numero_cuenta_banco` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `fecha_insercion` datetime DEFAULT NULL,
  `usuario_insercion` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `fecha_actualizacion` datetime DEFAULT NULL,
  `usuario_actualizacion` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `fecha_inactivacion` datetime DEFAULT NULL,
  `usuario_inactivacion` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `numero_cliente` varchar(6) COLLATE utf8_unicode_ci NOT NULL,
  `correo` varchar(64) COLLATE utf8_unicode_ci DEFAULT NULL,
  `telefono` varchar(32) COLLATE utf8_unicode_ci DEFAULT NULL,
  `plan_banco_bac` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `e_estructura_empresa`
--

LOCK TABLES `e_estructura_empresa` WRITE;
/*!40000 ALTER TABLE `e_estructura_empresa` DISABLE KEYS */;
INSERT INTO `e_estructura_empresa` VALUES (9,'Corporación González y Asociados Internacional S.A.','2-03101153170-001-001','2','03101153170','001','001','1123',NULL,'EMPRESA_LOGO_CORPORACION_GLEZ_170224_202255.png','2017-02-26','CG','100010001881184',NULL,NULL,'2024-10-31 11:43:26','admin',NULL,NULL,'002867',NULL,NULL,'ED55'),(10,'Charmander Servicios Electrónicos en Seguridad S.A.','2-03101264066-001-001','2','03101264066','001','001','1123',NULL,'EMPRESA_LOGO_CHARMANDER_SERVICI_170224_202230.png','2017-02-26','CH','100012020001432',NULL,NULL,'2024-10-31 11:43:14','admin',NULL,NULL,'002867',NULL,NULL,'EMM6');
/*!40000 ALTER TABLE `e_estructura_empresa` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:52:36
