import type { DatabaseSchema } from '../types/schema.js';
import type {
  InferenceOptions,
  SchemaInferenceResult,
  SchemaSemanticProfiles,
  SemanticColumnProfile
} from './types.js';
import { LocalSemanticHeuristics } from './local-heuristics.js';
import { SchemaSemanticCache } from './cache.js';
import { GeminiInferenceClient } from './gemini-client.js';

export class SchemaSemanticResolver {
  private schema: DatabaseSchema;
  private options: InferenceOptions;
  private cachedResult: SchemaInferenceResult | null = null;

  constructor(schema: DatabaseSchema, options: InferenceOptions = {}) {
    this.schema = schema;
    this.options = {
      model: 'gemini-1.5-flash',
      cache: true,
      ...options
    };
  }

  /**
   * Resolves semantic column profiles across all tables in the schema
   */
  async resolve(): Promise<SchemaInferenceResult> {
    const startTime = performance.now();
    const schemaHash = SchemaSemanticCache.computeHash(this.schema);

    // 1. Check Cache Layer
    if (this.options.cache !== false) {
      const cached = SchemaSemanticCache.get(schemaHash);
      if (cached) {
        let count = 0;
        for (const tbl of Object.values(cached)) count += Object.keys(tbl).length;
        const result: SchemaInferenceResult = {
          profiles: cached,
          source: 'cache',
          cached: true,
          schemaHash,
          inferredColumnsCount: count,
          durationMs: performance.now() - startTime
        };
        this.cachedResult = result;
        return result;
      }
    }

    // 2. Direct Local Heuristics (if offline / forceLocal / no apiKey provided)
    if (this.options.forceLocal || !this.options.apiKey?.trim()) {
      const localProfiles = this.runLocalHeuristics();
      let count = 0;
      for (const tbl of Object.values(localProfiles)) count += Object.keys(tbl).length;

      if (this.options.cache !== false) {
        SchemaSemanticCache.set(schemaHash, localProfiles);
      }

      const result: SchemaInferenceResult = {
        profiles: localProfiles,
        source: 'local-heuristics',
        cached: false,
        schemaHash,
        inferredColumnsCount: count,
        durationMs: performance.now() - startTime
      };
      this.cachedResult = result;
      return result;
    }

    // 3. Gemini 1.5 Flash AI Inference ($0 Free Tier)
    try {
      const geminiProfiles = await GeminiInferenceClient.inferSchema(this.schema, this.options);

      // Merge with local heuristics to guarantee complete coverage
      const localProfiles = this.runLocalHeuristics();
      const mergedProfiles = this.mergeProfiles(geminiProfiles, localProfiles);

      if (this.options.cache !== false) {
        SchemaSemanticCache.set(schemaHash, mergedProfiles);
      }

      let count = 0;
      for (const tbl of Object.values(mergedProfiles)) count += Object.keys(tbl).length;

      const result: SchemaInferenceResult = {
        profiles: mergedProfiles,
        source: 'gemini-1.5-flash',
        model: this.options.model,
        cached: false,
        schemaHash,
        inferredColumnsCount: count,
        durationMs: performance.now() - startTime
      };
      this.cachedResult = result;
      return result;
    } catch (err) {
      // Graceful fallback to local heuristics on network error / quota limit / invalid key
      console.warn('[MockForge AI] Gemini 1.5 Flash API call failed. Gracefully falling back to local semantic heuristics.', err);

      const localProfiles = this.runLocalHeuristics();
      let count = 0;
      for (const tbl of Object.values(localProfiles)) count += Object.keys(tbl).length;

      const result: SchemaInferenceResult = {
        profiles: localProfiles,
        source: 'local-heuristics',
        cached: false,
        schemaHash,
        inferredColumnsCount: count,
        durationMs: performance.now() - startTime
      };
      this.cachedResult = result;
      return result;
    }
  }

  /**
   * Synchronously retrieves a column profile if resolution has already run
   */
  getProfile(tableName: string, columnName: string): SemanticColumnProfile | null {
    if (!this.cachedResult) return null;
    const tableMap = this.cachedResult.profiles[tableName.toLowerCase()];
    if (!tableMap) return null;
    return tableMap[columnName.toLowerCase()] || null;
  }

  /**
   * Runs local heuristics dictionary across all tables
   */
  private runLocalHeuristics(): SchemaSemanticProfiles {
    const profiles: SchemaSemanticProfiles = {};
    for (const table of this.schema.tables) {
      const tableProfiles = LocalSemanticHeuristics.inferTable(table);
      if (Object.keys(tableProfiles).length > 0) {
        profiles[table.name.toLowerCase()] = tableProfiles;
      }
    }
    return profiles;
  }

  /**
   * Merges primary AI profiles with secondary local profiles
   */
  private mergeProfiles(
    primary: SchemaSemanticProfiles,
    secondary: SchemaSemanticProfiles
  ): SchemaSemanticProfiles {
    const merged: SchemaSemanticProfiles = { ...primary };

    for (const [tableKey, secColumns] of Object.entries(secondary)) {
      if (!merged[tableKey]) {
        merged[tableKey] = { ...secColumns };
      } else {
        for (const [colKey, secProfile] of Object.entries(secColumns)) {
          // If Gemini didn't infer this column, use local heuristic profile
          if (!merged[tableKey][colKey]) {
            merged[tableKey][colKey] = secProfile;
          }
        }
      }
    }

    return merged;
  }
}
