import type { DatabaseSchema } from '../types/schema.js';
import type { SchemaSemanticProfiles } from './types.js';

export class SchemaSemanticCache {
  private static memoryCache = new Map<string, SchemaSemanticProfiles>();
  private static readonly STORAGE_PREFIX = 'mockforge_semantic_cache_';

  /**
   * Fast, deterministic 64-bit FNV-1a hash of schema structure (table names + column names + types)
   */
  static computeHash(schema: DatabaseSchema): string {
    const canonicalTokens: string[] = [];

    const sortedTables = [...schema.tables].sort((a, b) => a.name.localeCompare(b.name));
    for (const table of sortedTables) {
      canonicalTokens.push(`TABLE:${table.name.toLowerCase()}`);
      const sortedCols = [...table.columns].sort((a, b) => a.name.localeCompare(b.name));
      for (const col of sortedCols) {
        canonicalTokens.push(`COL:${col.name.toLowerCase()}:${col.normalizedType}`);
      }
    }

    const input = canonicalTokens.join('|');
    return this.fnv1a(input);
  }

  static get(hash: string): SchemaSemanticProfiles | null {
    // 1. In-Memory Cache
    if (this.memoryCache.has(hash)) {
      return this.memoryCache.get(hash)!;
    }

    // 2. Browser LocalStorage (if running in browser client)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(this.STORAGE_PREFIX + hash);
        if (item) {
          const parsed = JSON.parse(item) as SchemaSemanticProfiles;
          this.memoryCache.set(hash, parsed);
          return parsed;
        }
      } catch {
        // Ignore localStorage access failures in restricted environments
      }
    }

    return null;
  }

  static set(hash: string, profiles: SchemaSemanticProfiles): void {
    this.memoryCache.set(hash, profiles);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(this.STORAGE_PREFIX + hash, JSON.stringify(profiles));
      } catch {
        // Ignore quota exceptions
      }
    }
  }

  static clear(): void {
    this.memoryCache.clear();
  }

  /**
   * Fast FNV-1a 32-bit non-cryptographic hash
   */
  private static fnv1a(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
  }
}
