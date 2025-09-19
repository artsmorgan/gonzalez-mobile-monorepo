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
-- Table structure for table `c_tramite_portacion_arma`
--

DROP TABLE IF EXISTS `c_tramite_portacion_arma`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_tramite_portacion_arma` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipoTramite` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `fecha` date NOT NULL,
  `path` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `empleadoTramitePortacionArma_id` int(11) NOT NULL,
  `descripcion` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `resultado` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_B71936626D892826` (`empleadoTramitePortacionArma_id`),
  CONSTRAINT `FK_B71936626D892826` FOREIGN KEY (`empleadoTramitePortacionArma_id`) REFERENCES `c_empleado_tramite_portacion_arma` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `c_tramite_portacion_arma`
--

LOCK TABLES `c_tramite_portacion_arma` WRITE;
/*!40000 ALTER TABLE `c_tramite_portacion_arma` DISABLE KEYS */;
INSERT INTO `c_tramite_portacion_arma` VALUES (1,'teorico_practico','2021-10-10','4b02c8320ef422da73f43b9d2ad2cf16dce141dc.pdf',1,'AMBOS','APR'),(2,'teorico_practico','2020-06-19','074c18f2645dcc327f0e94a9c3ae4901b41b5d70.pdf',2,'NOTA DE PREVENCIÓN POR SUBSANAR','APR'),(3,'teorico_practico','2022-04-12','b900c4509aca0622f667974badb45078889b9d45.pdf',3,'LOS RECHAZARON POR PARTE POLICIAL QUE AUN NO HA SIDO ARCHIVADO','REC'),(4,'carnet_seguridad_privada','2023-05-04','783672de0708f0993552f604c51cebcc05614dfe.pdf',4,'EN REVISION DE ANTECEDENTES','REC'),(5,'teorico_practico','2023-03-14','e763d04208a528cae096dc1d1cb08c416a404767.pdf',5,'EN REVISIÓN','REC'),(6,'carnet_seguridad_privada','2023-04-13','8f5d6d26d0997d75cf0dffefd1130a9eeee0b551.pdf',6,'N/A','APR'),(7,'teorico_practico','2023-10-20','445f2ee20e3585e62a076d7f11251a9808d7905f.pdf',7,'COPIAS','APR'),(8,'carnet_portacion','2026-12-03','fdf8274835110e15f74cd6a30622d390a3ba54e5.pdf',8,'VIGENTE','APR'),(9,'carnet_seguridad_privada','2026-12-03','824fe4b0f8fc43641049ad1be9bfccf984ea8cd6.pdf',8,'VIGENTE','APR');
/*!40000 ALTER TABLE `c_tramite_portacion_arma` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:59:46
