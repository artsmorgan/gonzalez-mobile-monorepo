import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de la base de datos...');
  
  try {
    // Crear datos de todas las tablas
    await Promise.all([
    ]);
    
    console.log('Base de datos poblada con datos de prueba');
  } catch (error) {
    console.error('Error durante el seed:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
