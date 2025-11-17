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
-- Table structure for table `security_fos_users_roles_tipoaccion`
--

DROP TABLE IF EXISTS `security_fos_users_roles_tipoaccion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `security_fos_users_roles_tipoaccion` (
  `user_id` int(11) NOT NULL,
  `croltipoaccion_id` int(11) NOT NULL,
  PRIMARY KEY (`user_id`,`croltipoaccion_id`),
  KEY `IDX_D81D1251A76ED395` (`user_id`),
  KEY `IDX_D81D1251C9F2F869` (`croltipoaccion_id`),
  CONSTRAINT `FK_D81D1251A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_D81D1251C9F2F869` FOREIGN KEY (`croltipoaccion_id`) REFERENCES `c_rol_tipoaccion` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `security_fos_users_roles_tipoaccion`
--

LOCK TABLES `security_fos_users_roles_tipoaccion` WRITE;
/*!40000 ALTER TABLE `security_fos_users_roles_tipoaccion` DISABLE KEYS */;
INSERT INTO `security_fos_users_roles_tipoaccion` VALUES (6,12),(6,13),(7,7),(10,12),(11,7),(12,3),(13,1),(14,3),(16,3),(17,3),(18,1),(21,13),(30,5),(32,12),(33,2),(34,8),(37,3),(39,1),(41,7),(42,8),(45,2),(46,2),(47,2),(48,2),(49,2),(50,2),(53,2),(56,2),(57,2),(58,2),(59,4),(60,4),(62,5),(64,1),(65,9),(66,9),(67,9),(70,9),(73,5),(73,14),(74,10),(76,9),(77,9),(80,10),(82,10),(83,10),(84,10),(88,1),(88,4),(88,5),(88,11),(89,9),(90,8),(90,12),(91,9),(92,15),(93,2),(95,2),(99,3),(101,12),(102,9),(108,9),(109,9),(114,2),(115,9),(116,10),(117,9),(121,9),(123,4),(124,10),(125,2),(126,9),(127,2),(129,9),(130,9),(131,9),(132,9),(133,10),(134,3),(135,3),(136,9),(138,2),(139,10),(140,9),(142,9),(143,9),(144,1),(145,5),(146,9),(147,3),(148,3),(149,9),(150,2),(151,2),(152,9),(153,2),(154,3),(155,2),(156,2),(157,2),(158,2),(159,2),(161,13),(162,9),(165,10),(166,10),(167,10),(168,10),(169,9),(170,3),(171,10),(172,8),(172,12),(173,2),(174,12),(175,9),(176,2),(177,2),(178,2),(179,2),(180,2),(181,7),(182,1),(183,9),(184,9),(185,3),(186,7),(187,2),(188,9),(189,9),(190,9),(191,1),(192,2),(193,1),(193,5),(193,11),(194,9),(195,2),(195,7),(196,1),(197,9),(198,9),(199,4),(200,4),(201,4),(202,4),(203,13),(204,2),(205,12),(206,3),(207,2),(208,2),(209,2),(210,1),(211,2),(212,6),(213,1),(214,3),(215,9),(216,5),(217,2),(218,2),(219,2),(220,2),(221,4),(222,6),(226,2),(227,2),(228,2),(229,2),(230,2),(231,2),(232,2),(233,2),(234,2),(235,2),(236,2),(237,2),(238,9),(239,2),(240,7),(241,2),(242,2),(243,2),(244,7),(245,11),(246,2),(247,2),(248,12),(249,2),(250,2),(251,2),(252,2),(253,2),(254,2),(255,2),(256,5),(257,3),(258,10),(259,13),(260,13),(261,13),(262,9),(263,2),(265,1),(266,2),(267,9),(268,4),(269,2),(270,1),(271,7),(273,9),(274,10),(275,3),(276,2),(277,1),(278,2),(279,4),(280,4),(281,1),(282,9),(283,9),(284,2),(285,2),(286,9),(287,2),(287,7),(288,5),(289,5),(290,9),(291,2),(291,7),(292,2),(293,9),(294,2),(294,7),(294,11),(295,1),(295,2),(295,3),(295,4),(295,5),(295,6),(295,7),(295,8),(295,9),(295,10),(295,11),(295,12),(295,13),(295,14),(295,15),(296,6),(297,9),(298,9),(299,9),(300,2),(300,6),(300,7),(301,1),(302,5),(303,10),(304,10),(305,10),(306,9),(307,9),(308,4),(309,4),(310,12),(311,12),(312,12),(313,12),(314,2),(314,7),(316,2),(316,7),(318,9),(319,9),(320,2),(321,2),(321,7),(322,2);
/*!40000 ALTER TABLE `security_fos_users_roles_tipoaccion` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 10:50:21
