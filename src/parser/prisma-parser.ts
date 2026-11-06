import type {
  DatabaseSchema,
  TableDefinition,
  ColumnDefinition,
  ForeignKeyReference,
  ColumnCategory
} from '../types/schema.js';

export class PrismaSchemaParser {
  /**
   * Parses a Prisma schema file content into a normalized DatabaseSchema
   */
  static parse(schemaContent: string): DatabaseSchema {
    const cleaned = this.stripComments(schemaContent);
    const enums: Record<string, string[]> = {};
    const tables: TableDefinition[] = [];

    // 1. Parse Enums: enum Role { USER ADMIN MODERATOR }
    const enumRegex = /enum\s+([a-zA-Z0-9_]+)\s*\{([^}]+)\}/g;
    let enumMatch: RegExpExecArray | null;
    while ((enumMatch = enumRegex.exec(cleaned)) !== null) {
      const enumName = enumMatch[1].trim();
      const enumValues = enumMatch[2]
        .split(/\s+/)
        .map((v) => v.trim())
        .filter(Boolean);
      enums[enumName] = enumValues;
    }

    // 2. Parse Models: model User { ... }
    const modelRegex = /model\s+([a-zA-Z0-9_]+)\s*\{([^}]+)\}/g;
    let modelMatch: RegExpExecArray | null;

    while ((modelMatch = modelRegex.exec(cleaned)) !== null) {
      const modelName = modelMatch[1].trim();
      const body = modelMatch[2];

      const { columns, primaryKey, foreignKeys, uniqueConstraints } = this.parseModelBody(
        modelName,
        body,
        enums
      );

      tables.push({
        name: modelName,
        columns,
        primaryKey,
        foreignKeys,
        uniqueConstraints,
        checkConstraints: []
      });
    }

    return {
      dialect: 'postgres',
      tables,
      enums
    };
  }

  private static parseModelBody(
    modelName: string,
    body: string,
    enums: Record<string, string[]>
  ): {
    columns: ColumnDefinition[];
    primaryKey: string[];
    foreignKeys: ForeignKeyReference[];
    uniqueConstraints: string[][];
  } {
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    const columns: ColumnDefinition[] = [];
    const primaryKey: string[] = [];
    const foreignKeys: ForeignKeyReference[] = [];
    const uniqueConstraints: string[][] = [];

    const rawRelationDirectives: Array<{
      fields: string[];
      references: string[];
      targetModel: string;
      onDelete?: string;
    }> = [];

    for (const line of lines) {
      // Check for block-level @@id([col1, col2])
      const blockIdMatch = line.match(/^@@id\(\[([^\]]+)\]\)/);
      if (blockIdMatch) {
        primaryKey.push(...blockIdMatch[1].split(',').map((c) => c.trim()));
        continue;
      }

      // Check for block-level @@unique([col1, col2])
      const blockUniqueMatch = line.match(/^@@unique\(\[([^\]]+)\]\)/);
      if (blockUniqueMatch) {
        uniqueConstraints.push(blockUniqueMatch[1].split(',').map((c) => c.trim()));
        continue;
      }

      // Skip other block attributes @@map, @@index
      if (line.startsWith('@@')) continue;

      // Parse field line: name Type [modifiers...]
      const tokens = line.split(/\s+/);
      if (tokens.length < 2) continue;

      const fieldName = tokens[0];
      const rawType = tokens[1];
      const attributes = line.slice(fieldName.length + rawType.length + 1).trim();

      // Check if it's a virtual relational field (e.g. `user User @relation(...)` or `posts Post[]`)
      if (attributes.includes('@relation') || rawType.endsWith('[]')) {
        const relationMatch = attributes.match(/@relation\(([^)]+)\)/);
        if (relationMatch) {
          const relParams = relationMatch[1];
          const fieldsMatch = relParams.match(/fields:\s*\[([^\]]+)\]/);
          const referencesMatch = relParams.match(/references:\s*\[([^\]]+)\]/);
          const onDeleteMatch = relParams.match(/onDelete:\s*([a-zA-Z]+)/);

          if (fieldsMatch && referencesMatch) {
            rawRelationDirectives.push({
              fields: fieldsMatch[1].split(',').map((f) => f.trim()),
              references: referencesMatch[1].split(',').map((r) => r.trim()),
              targetModel: rawType.replace('?', ''),
              onDelete: onDeleteMatch ? onDeleteMatch[1] : undefined
            });
          }
        }
        continue; // Relational navigation properties do not become physical DB columns
      }

      const isNullable = rawType.endsWith('?');
      const cleanType = rawType.replace('?', '');
      const isPrimaryKey = attributes.includes('@id');
      const isUnique = attributes.includes('@unique');
      const isAutoIncrement = attributes.includes('autoincrement()');

      if (isPrimaryKey) {
        primaryKey.push(fieldName);
      }
      if (isUnique) {
        uniqueConstraints.push([fieldName]);
      }

      let defaultValue: string | undefined;
      const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
      if (defaultMatch) {
        defaultValue = defaultMatch[1].replace(/['"]/g, '');
      }

      const { category, normalizedType } = this.mapPrismaType(cleanType, enums);

      columns.push({
        name: fieldName,
        category,
        rawType,
        normalizedType,
        isPrimaryKey,
        isAutoIncrement,
        isNullable,
        isUnique,
        defaultValue,
        enumValues: enums[cleanType]
      });
    }

    // Attach relational foreign keys to physical scalar columns
    const resolvedFks: ForeignKeyReference[] = [];
    for (const rel of rawRelationDirectives) {
      for (let i = 0; i < rel.fields.length; i++) {
        const sourceCol = rel.fields[i];
        const targetCol = rel.references[i] || 'id';

        const fk: ForeignKeyReference = {
          sourceColumn: sourceCol,
          targetTable: rel.targetModel,
          targetColumn: targetCol,
          onDelete: rel.onDelete as any
        };
        resolvedFks.push(fk);

        const col = columns.find((c) => c.name === sourceCol);
        if (col) {
          col.foreignKey = fk;
        }
      }
    }

    return {
      columns,
      primaryKey,
      foreignKeys: resolvedFks,
      uniqueConstraints
    };
  }

  private static mapPrismaType(
    prismaType: string,
    enums: Record<string, string[]>
  ): { category: ColumnCategory; normalizedType: string } {
    if (enums[prismaType]) {
      return { category: 'enum', normalizedType: prismaType };
    }

    switch (prismaType) {
      case 'Int':
        return { category: 'numeric', normalizedType: 'integer' };
      case 'BigInt':
        return { category: 'numeric', normalizedType: 'bigint' };
      case 'Float':
      case 'Decimal':
        return { category: 'numeric', normalizedType: 'decimal' };
      case 'String':
        return { category: 'textual', normalizedType: 'varchar' };
      case 'Boolean':
        return { category: 'boolean', normalizedType: 'boolean' };
      case 'DateTime':
        return { category: 'temporal', normalizedType: 'timestamp' };
      case 'Json':
        return { category: 'json', normalizedType: 'json' };
      case 'Bytes':
        return { category: 'binary', normalizedType: 'blob' };
      default:
        return { category: 'custom', normalizedType: prismaType.toLowerCase() };
    }
  }

  private static stripComments(content: string): string {
    return content.replace(/\/\/.*$/gm, '').trim();
  }
}
