export * from './types/schema.js';
export { SqlDdlParser } from './parser/sql-parser.js';
export { PrismaSchemaParser } from './parser/prisma-parser.js';
export { DependencyGraph } from './graph/dag.js';
export { SeededPRNG } from './generator/prng.js';
export { GeneratorRegistry } from './generator/registry.js';
export { PrimaryKeyPool } from './generator/relational-pool.js';
export { ConstraintSolver } from './generator/constraints.js';
export {
  RelationalSynthesisEngine,
  type GenerationOptions,
  type RelationalDataset
} from './generator/engine.js';

import { SqlDdlParser } from './parser/sql-parser.js';
import { PrismaSchemaParser } from './parser/prisma-parser.js';
import { RelationalSynthesisEngine, type GenerationOptions, type RelationalDataset } from './generator/engine.js';
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

/**
 * 1-Click synthesis of referentially intact mock database fixtures from raw schema
 */
export function synthesizeMockData(schema: DatabaseSchema, options?: GenerationOptions): RelationalDataset {
  const engine = new RelationalSynthesisEngine(schema, options);
  return engine.generate();
}
