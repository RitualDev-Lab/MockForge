export * from './types/schema.js';
export { SqlDdlParser } from './parser/sql-parser.js';
export { PrismaSchemaParser } from './parser/prisma-parser.js';
export { DependencyGraph } from './graph/dag.js';

import { SqlDdlParser } from './parser/sql-parser.js';
import { PrismaSchemaParser } from './parser/prisma-parser.js';
import type { DatabaseSchema } from './types/schema.js';

/**
 * Universal schema parser that auto-detects SQL DDL vs Prisma schema
 */
export function parseSchema(schemaText: string, format?: 'sql' | 'prisma'): DatabaseSchema {
  const isPrisma = format === 'prisma' || (!format && (schemaText.includes('model ') || schemaText.includes('generator client')));
  if (isPrisma) {
    return PrismaSchemaParser.parse(schemaText);
  }
  return SqlDdlParser.parse(schemaText);
}
