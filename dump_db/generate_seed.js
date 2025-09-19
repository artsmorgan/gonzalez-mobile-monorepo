const fs = require('fs');
const path = require('path');

// Función para extraer datos INSERT de un archivo SQL
function extractInsertData(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const insertData = [];
        let inInsertStatement = false;
        let currentStatement = '';
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detectar inicio de INSERT INTO
            if (line.match(/^INSERT\s+INTO/i)) {
                inInsertStatement = true;
                currentStatement = line;
                braceCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
                
                // Si la declaración termina en la misma línea
                if (braceCount === 0) {
                    insertData.push(currentStatement);
                    inInsertStatement = false;
                    currentStatement = '';
                }
            }
            // Si estamos dentro de un INSERT statement, continuar agregando líneas
            else if (inInsertStatement) {
                currentStatement += '\n' + line;
                braceCount += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
                
                // Si llegamos al final del INSERT statement
                if (braceCount === 0) {
                    insertData.push(currentStatement);
                    inInsertStatement = false;
                    currentStatement = '';
                }
            }
        }
        
        return insertData;
    } catch (error) {
        console.error(`Error procesando archivo ${filePath}:`, error.message);
        return [];
    }
}

// Función para parsear INSERT statement y extraer datos
function parseInsertStatement(insertStatement) {
    try {
        // Extraer nombre de la tabla
        const tableMatch = insertStatement.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
        if (!tableMatch) return null;
        
        const tableName = tableMatch[1];
        
        // Extraer columnas
        const columnsMatch = insertStatement.match(/INSERT\s+INTO\s+`?\w+`?\s*\(([^)]+)\)/i);
        if (!columnsMatch) return null;
        
        const columns = columnsMatch[1]
            .split(',')
            .map(col => col.trim().replace(/`/g, ''));
        
        // Extraer valores
        const valuesMatch = insertStatement.match(/VALUES\s*(.+)/i);
        if (!valuesMatch) return null;
        
        const valuesString = valuesMatch[1];
        
        // Parsear valores - esto es complejo, vamos a usar una aproximación simple
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        let quoteChar = '';
        let parenCount = 0;
        
        for (let i = 0; i < valuesString.length; i++) {
            const char = valuesString[i];
            
            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
                currentValue += char;
            } else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
                currentValue += char;
            } else if (!inQuotes && char === '(') {
                parenCount++;
                if (parenCount === 1) {
                    // Inicio de un nuevo conjunto de valores
                    currentValue = '';
                    continue;
                }
                currentValue += char;
            } else if (!inQuotes && char === ')') {
                parenCount--;
                if (parenCount === 0) {
                    // Fin de un conjunto de valores
                    if (currentValue.trim()) {
                        values.push(parseValueRow(currentValue, columns.length));
                    }
                    currentValue = '';
                    continue;
                }
                currentValue += char;
            } else if (!inQuotes && char === ',' && parenCount === 1) {
                // Separador entre valores en el mismo conjunto
                if (currentValue.trim()) {
                    values.push(parseValueRow(currentValue, columns.length));
                }
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        return {
            tableName,
            columns,
            values
        };
    } catch (error) {
        console.error('Error parseando INSERT statement:', error.message);
        return null;
    }
}

// Función para parsear una fila de valores
function parseValueRow(valueString, expectedColumns) {
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    let quoteChar = '';
    let parenCount = 0;
    
    for (let i = 0; i < valueString.length; i++) {
        const char = valueString[i];
        
        if (!inQuotes && (char === '"' || char === "'")) {
            inQuotes = true;
            quoteChar = char;
            currentValue += char;
        } else if (inQuotes && char === quoteChar) {
            inQuotes = false;
            quoteChar = '';
            currentValue += char;
        } else if (!inQuotes && char === ',' && parenCount === 0) {
            values.push(cleanValue(currentValue.trim()));
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    
    if (currentValue.trim()) {
        values.push(cleanValue(currentValue.trim()));
    }
    
    return values;
}

// Función para limpiar valores
function cleanValue(value) {
    // Remover comillas si están presentes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    
    // Convertir NULL a null
    if (value === 'NULL') {
        return null;
    }
    
    // Convertir números
    if (!isNaN(value) && value !== '') {
        return Number(value);
    }
    
    return value;
}

// Función para convertir datos a formato Prisma
function convertToPrismaCreate(tableName, columns, values) {
    const modelName = tableName.charAt(0).toUpperCase() + tableName.slice(1);
    let prismaCode = '';
    
    values.forEach((row, index) => {
        const dataObject = {};
        
        columns.forEach((column, colIndex) => {
            if (row[colIndex] !== undefined) {
                dataObject[column] = row[colIndex];
            }
        });
        
        prismaCode += `    prisma.${tableName}.create({\n`;
        prismaCode += `      data: {\n`;
        
        Object.entries(dataObject).forEach(([key, value], i, arr) => {
            const isLast = i === arr.length - 1;
            if (value === null) {
                prismaCode += `        ${key}: null${isLast ? '' : ','}\n`;
            } else if (typeof value === 'string') {
                prismaCode += `        ${key}: '${value.replace(/'/g, "\\'")}'${isLast ? '' : ','}\n`;
            } else {
                prismaCode += `        ${key}: ${value}${isLast ? '' : ','}\n`;
            }
        });
        
        prismaCode += `      },\n`;
        prismaCode += `    })${index < values.length - 1 ? ',' : ''}\n`;
    });
    
    return prismaCode;
}

// Función principal
function generateSeedFile() {
    const dumpDir = __dirname;
    const outputFile = path.join(dumpDir, 'seed.ts');
    
    console.log('Iniciando generación del archivo seed.ts...');
    
    // Leer todos los archivos .sql
    const files = fs.readdirSync(dumpDir).filter(file => file.endsWith('.sql'));
    console.log(`Encontrados ${files.length} archivos .sql`);
    
    let allInsertData = [];
    
    // Procesar cada archivo
    files.forEach(file => {
        const filePath = path.join(dumpDir, file);
        console.log(`Procesando: ${file}`);
        
        const insertStatements = extractInsertData(filePath);
        allInsertData = allInsertData.concat(insertStatements);
    });
    
    console.log(`Total de INSERT statements encontrados: ${allInsertData.length}`);
    
    // Parsear todos los INSERT statements
    const parsedData = {};
    
    allInsertData.forEach(insertStatement => {
        const parsed = parseInsertStatement(insertStatement);
        if (parsed) {
            if (!parsedData[parsed.tableName]) {
                parsedData[parsed.tableName] = {
                    columns: parsed.columns,
                    values: []
                };
            }
            parsedData[parsed.tableName].values = parsedData[parsed.tableName].values.concat(parsed.values);
        }
    });
    
    // Generar contenido del archivo seed.ts
    let seedContent = `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de la base de datos...');
  
  try {
    // Crear datos de todas las tablas
    await Promise.all([
`;

    // Agregar cada tabla
    Object.entries(parsedData).forEach(([tableName, data], tableIndex) => {
        if (data.values.length > 0) {
            seedContent += `      // ${tableName}\n`;
            seedContent += convertToPrismaCreate(tableName, data.columns, data.values);
            if (tableIndex < Object.keys(parsedData).length - 1) {
                seedContent += ',\n\n';
            }
        }
    });

    seedContent += `    ]);
    
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
`;

    // Escribir archivo
    fs.writeFileSync(outputFile, seedContent, 'utf8');
    console.log(`Archivo seed.ts generado exitosamente en: ${outputFile}`);
    console.log(`Tamaño del archivo: ${fs.statSync(outputFile).size} bytes`);
    console.log(`Tablas procesadas: ${Object.keys(parsedData).length}`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
    generateSeedFile();
}

module.exports = { generateSeedFile, extractInsertData, parseInsertStatement };