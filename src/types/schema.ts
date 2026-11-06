/**
 * MockForge Relational Database Schema Types
 */

export type SqlDialect = 'postgres' | 'mysql' | 'sqlite' | 'generic';

export type ColumnCategory =
  | 'numeric'
  | 'textual'
  | 'temporal'
  | 'boolean'
  | 'uuid'
  | 'json'
  | 'enum'
  | 'binary'
  | 'custom';

export interface ColumnDefinition {
  name: string;
  category: ColumnCategory;
  rawType: string;
  normalizedType: string;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
  checkConstraint?: string;
  foreignKey?: ForeignKeyReference;
  enumValues?: string[];
  length?: number;
  precision?: number;
  scale?: number;
  comment?: string;
}

export interface ForeignKeyReference {
  constraintName?: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'RESTRICT' | 'NO ACTION';
  isNullable?: boolean;
}

export interface TableDefinition {
  name: string;
  schema?: string;
  columns: ColumnDefinition[];
  primaryKey: string[]; // Supports single & composite primary keys
  foreignKeys: ForeignKeyReference[];
  uniqueConstraints: string[][]; // Unique column sets
  checkConstraints: string[];
  comment?: string;
}

export interface DatabaseSchema {
  dialect: SqlDialect;
  tables: TableDefinition[];
  enums: Record<string, string[]>; // Enum name -> array of string values
}

export interface GenerationStep {
  tableName: string;
  order: number;
  dependsOn: string[];
  deferredForeignKeys: ForeignKeyReference[]; // Foreign keys to resolve in a 2nd pass (e.g. self-referencing or circular)
}

export interface TopologicalSortResult {
  executionOrder: string[];
  steps: GenerationStep[];
  hasCycles: boolean;
  cycles?: string[][];
}
