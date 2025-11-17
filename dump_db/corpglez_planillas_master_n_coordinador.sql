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
-- Table structure for table `n_coordinador`
--

DROP TABLE IF EXISTS `n_coordinador`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `n_coordinador` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
  `coordinadoPor_id` int(11) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_D7D149E781B56B3` (`coordinadoPor_id`),
  CONSTRAINT `FK_D7D149E781B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=184 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `n_coordinador`
--

LOCK TABLES `n_coordinador` WRITE;
/*!40000 ALTER TABLE `n_coordinador` DISABLE KEYS */;
INSERT INTO `n_coordinador` VALUES (1,'Mario Barrantes',6,1),(2,'Marlem Santander',6,0),(3,'Franklin Navarrete',1,1),(4,'Moises García Trejos',1,1),(5,'Juan Carlos Melendez',1,1),(6,'Diego Corrales',2,0),(7,'Dora Mora',2,0),(8,'Karolina Rivera',8,0),(9,'Diego Vindas',2,0),(10,'Andrea Palma',6,0),(11,'Natalia Sandoval',6,0),(12,'Minor Villegas',4,0),(13,'Marlem Brenes',4,0),(14,'Greivin Quesada',2,1),(15,'Carlos Lobo',2,1),(16,'Julián Bonilla',2,0),(17,'Guillermo Navarrete',2,1),(18,'Eugenio Moreno',2,1),(19,'Carlos Ureña',2,1),(20,'Luis Badilla',2,0),(21,'Juan Carlos Solano',2,0),(22,'Harold Rodríguez',3,1),(23,'Marlon Chavarría',3,1),(24,'Jeffrey Umaña',3,0),(25,'Sonia Azofeifa',3,1),(26,'Jorge Rojas',7,0),(27,'Jose Cubillo',5,1),(28,'Ronald Valverde',5,1),(29,'Martín Sandoval',5,1),(30,'Saul Salas',5,0),(31,'Marcos Zúñiga',2,0),(32,'José Briones',2,1),(33,'Kenneth Gómez',2,0),(34,'Mario Rivera',2,0),(35,'Francisco López',5,1),(36,'Emanuel Aguilar',5,0),(37,'Alexander Arias',5,0),(38,'Jose Alfredo Jiménez',5,0),(39,'Giovanni Cárdenas',5,1),(40,'Dennis Reyes',5,0),(41,'Oscar Dengo',7,1),(42,'Francis Nuñez',6,0),(43,'Yessenia Siezar',8,0),(44,'Sassy Calderón',8,0),(45,'Mayra Navarro',8,0),(46,'Wendy Cordero',8,0),(47,'Dagoberto Fallas',2,0),(48,'Greivin Quiros',2,0),(49,'Victor Arce',8,0),(50,'Maribel Chacón',8,0),(51,'Patricia Ovares',8,0),(52,'Carlos Perez',8,0),(53,'Christopher Fernandez',2,0),(54,'Erick Araya',3,0),(55,'Ronald Leon',2,0),(56,'Stephanie Andrade',8,0),(57,'Esteban Amador',3,0),(58,'Bryan Arce',2,0),(59,'Roger Piedra',2,0),(60,'Steward Obando',2,0),(61,'Mario Murillo',3,0),(62,'Floribel de la O Jara',8,0),(63,'Olman Mejia',6,0),(64,'Jorge Alvarez',5,0),(65,'Marco Gonzalez Villarreal',2,1),(66,'William Mondragon',3,0),(67,'Jason Herrera',7,0),(68,'Erick Solano',8,1),(69,'Ernest Bizcaino',7,0),(70,'Michael Solano',7,0),(71,'Wagner Lopez',2,0),(72,'Ivannia Mendez',8,1),(73,'Laura Ortiz',8,0),(74,'Jessica Gonzalez Salas',8,0),(75,'Ronald Gonzalez',3,0),(76,'Allan Palacios',5,1),(77,'Felix Cordero',5,0),(78,'Jonathan Tellez',5,1),(79,'Olman Obando',5,1),(80,'Jimmy Nuñez',5,1),(81,'Jorge Arias',5,1),(82,'Victor Hugo Gallo Cortés',2,0),(83,'Gustavo Gómez Suárez',2,1),(84,'Luis Diego Mora',2,0),(85,'Sandra Noguera',5,1),(86,'Jean Carlo Mejia',8,0),(87,'Yendry Navarrete',8,0),(88,'Irene Sirias',8,1),(89,'Maria Elena Jimenez',8,1),(90,'Pamela Castillo',8,0),(91,'Isabel Vega',8,1),(92,'Jorge Barquero',4,0),(93,'Marta Gutierrez Barrientos',8,0),(94,'Sandra Hernandez',8,0),(95,'Kattia Gonzalez Sanchez',8,1),(96,'Monica Useche Escobar',6,0),(97,'Francisco Vargas',7,1),(98,'Yorleny Solorzano Venegas',4,1),(99,'Mayid Rosales',8,0),(100,'Roberto Carlos Quiros Gonzalez',6,1),(101,'Luis Mena Ruiz',8,0),(102,'Natalie Soto',8,1),(103,'johana calderon',8,0),(104,'fabian pereira',8,0),(105,'dayana sarmiento',8,0),(106,'Mitzi Johan Cheves Murillo',8,0),(107,'Johnny Reyes Diaz',8,1),(108,'Evelyn Carvajal',8,0),(109,'Elsie Rivera Gomez',8,1),(110,'EDVIN PEREIRA SALAZAR',8,1),(112,'XINIA MARIA BERMUDEZ ROMERO',8,1),(114,'GLENDA VEGA BARRANTES',8,1),(115,'GRETTEL VIRGINIA BENAVIDES HERNANDEZ',8,1),(116,'CANDIDA TATIANA GALEANO LOPEZ',8,1),(117,'LUIS GUILLERMO ANGULO MEJIA',8,0),(118,'DONALD BOLAÑOS BARQUERO',8,1),(119,'CLAUDIA GRANADOS RUGAMA',8,1),(120,'JENNIFER PAOLA SOJO GARCIA',8,1),(121,'Luis Diego Calvo Garcia',4,0),(122,'SUGEY MARIA BRENES VILLEGAS',8,1),(123,'Laura Zamora',8,1),(124,'Juan Carlos Soto Esquivel',8,1),(125,'Ana Ruiz Chaves',8,0),(126,'Alfonso Ramirez Guillen',8,0),(128,'Richard Amador',9,1),(129,'Jairo Badilla Roman',6,0),(130,'Angel Antonio Solano Ramirez',6,1),(131,'Zoraida Robles Cascante',8,1),(132,'Emily Deidania Cruz Alvarez',8,1),(133,'Lady Sileny Castillo Orocu',8,1),(134,'Fresia Damaris Herrera Muñoz',8,1),(135,'Maria de los Angeles Tijerino Villegas',8,1),(136,'Michelle Vanessa Castillo Brenes',8,1),(137,'Lorena Garcia Castro',8,1),(138,'Lizbeth Villegas Gonzalez',8,1),(139,'Francisco Javier Rodriguez Vega',6,0),(140,'Andrea Morales Morales',4,0),(141,'Stephanie Molina Madrigal',10,1),(142,'Erick Mauricio Fajardo Ramos',2,1),(143,'Lenin Alberto Estrada Pérez',2,1),(144,'Juan Rafael Porras Navarro',2,1),(145,'Jeiner Arturo Valverde Rojas',2,1),(146,'Juan Carlos Solano Corella',2,1),(147,'Ernest Anthony Bizcaino Medrano',2,1),(148,'Gabriel Siles Sanchez',1,1),(149,'Jose Manuel Quesada Salazar',8,1),(150,'MARETH ENGRACIA JIMENEZ HERNANDEZ',8,1),(151,'CONNY MAVEISSY JIMENEZ VALVERDE',8,1),(152,'Ana Carolina Villalobos Esquivel',8,0),(153,'Marlene Araya Vindas',8,1),(154,'Jeremy Ruiz Abarca',6,1),(155,'Jean Carlo Trejos Palacios',6,0),(156,'Cony Jimenez',8,1),(157,'Marian Rodriguez S.',3,1),(158,'Isabel Solis A.',2,1),(159,'Gustavo Fonseca C.',2,1),(160,'Alexander Vargas G.',2,1),(161,'Lucia Mendieta H.',7,1),(162,'Mikol Alvarez S.',2,1),(163,'Maikel Josue Arrieta Lopez',8,1),(164,'DOMINIQUE DIAZ SOLANO',8,1),(165,'Iveth Chaves Espinoza',4,1),(166,'Eduardo Montero Campos',6,1),(167,'Damaris Mora Barahona',8,0),(168,'Flesher Cortes',2,1),(169,'Jorge Reyes M.',2,0),(170,'Kevin Matarrita',4,1),(171,'Modesto Montero S.',2,1),(172,'Jonathan Rivera',4,0),(173,'Ronald León Casasola',2,1),(174,'Pedro Alfaro T.',2,1),(175,'Erick Jimenez',2,1),(176,'Isaac Masis Z.',2,1),(177,'Emadrigal',6,1),(178,'SILVIA ELENA LOIAZA CASTILLO',8,1),(179,'Gerald Varela',3,1),(180,'Ignacio Gomez Fuentes',8,1),(181,'Jorje Mosquera Romero',6,1),(182,'Oscar Alberto Ruiz Oviedo',8,1),(183,'Anthony Barrantes',2,1);
/*!40000 ALTER TABLE `n_coordinador` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-22 11:01:50
