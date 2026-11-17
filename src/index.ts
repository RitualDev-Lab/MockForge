export * from './types/schema.js';
export * from './inference/types.js';
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
export {
  HighThroughputStreamingEngine,
  type StreamGenerationOptions,
  type StreamMetrics
} from './generator/streaming-engine.js';
export { LocalSemanticHeuristics } from './inference/local-heuristics.js';
export { SchemaSemanticCache } from './inference/cache.js';
export { GeminiInferenceClient } from './inference/gemini-client.js';
export { SchemaSemanticResolver } from './inference/resolver.js';
export * from './exporters/index.js';
export * from './wasm/types.js';
export { InMemoryMockDatabase } from './wasm/memory-db.js';
export { MockDatabaseBridge, createMockDatabase } from './wasm/pglite-bridge.js';
export * from './licensing/commercial.js';
export { MockForgeCli, type CliArgs } from './cli/index.js';
export * from './anonymizer/index.js';
export { EphemeralMockServer, type MockServerOptions } from './server/mock-server.js';
export * from './orm/synchronizer.js';
export {
  createMockForgeMcpServer,
  runMockForgeMcpServer,
  anonymizeCsvData,
  type CsvAnonymizeResult
} from './mcp/index.js';

import { SqlDdlParser } from './parser/sql-parser.js';
import { PrismaSchemaParser } from './parser/prisma-parser.js';
import { RelationalSynthesisEngine, type GenerationOptions, type RelationalDataset } from './generator/engine.js';
import { SchemaSemanticResolver } from './inference/resolver.js';
import type { DatabaseSchema } from './types/schema.js';
import type { InferenceOptions, SchemaInferenceResult } from './inference/types.js';

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
 * Resolves cryptic schema columns using Gemini 1.5 Flash ($0 Free Tier) or Local Semantic Rules
 */
export async function inferSchemaSemantics(
  schema: DatabaseSchema,
  options?: InferenceOptions
): Promise<SchemaInferenceResult> {
  const resolver = new SchemaSemanticResolver(schema, options);
  return resolver.resolve();
}

/**
 * 1-Click synthesis of referentially intact mock database fixtures from raw schema
 */
export function synthesizeMockData(schema: DatabaseSchema, options?: GenerationOptions): RelationalDataset {
  const engine = new RelationalSynthesisEngine(schema, options);
  return engine.generate();
}
