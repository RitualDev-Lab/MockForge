import type {
  DatabaseSchema,
  TableDefinition,
  ColumnDefinition,
  ForeignKeyReference,
  SqlDialect,
  ColumnCategory
} from '../types/schema.js';

export class SqlDdlParser {
  /**
   * Parses raw SQL DDL script into a normalized DatabaseSchema AST
   */
  static parse(sql: string, explicitDialect?: SqlDialect): DatabaseSchema {
    const cleanedSql = this.stripComments(sql);
    const dialect = explicitDialect || this.detectDialect(cleanedSql);
    const enums: Record<string, string[]> = {};

    // 1. Parse custom Postgres enum types: CREATE TYPE name AS ENUM ('a', 'b')
    const enumRegex = /CREATE\s+TYPE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)\s+AS\s+ENUM\s*\(([^)]+)\)/gi;
    let enumMatch: RegExpExecArray | null;
    while ((enumMatch = enumRegex.exec(cleanedSql)) !== null) {
      const enumName = this.cleanIdentifier(enumMatch[1]);
      const enumValues = enumMatch[2]
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      enums[enumName] = enumValues;
    }

    // 2. Parse CREATE TABLE statements using balanced parentheses scanner
    const tables: TableDefinition[] = [];
    const createHeaderRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_"`.]+)\s*\(/gi;
    let headerMatch: RegExpExecArray | null;

    while ((headerMatch = createHeaderRegex.exec(cleanedSql)) !== null) {
      const fullTableName = this.cleanIdentifier(headerMatch[1]);
      const openParenIdx = createHeaderRegex.lastIndex - 1;

      // Find matching balanced closing parenthesis
      const closeParenIdx = this.findMatchingParen(cleanedSql, openParenIdx);
      if (closeParenIdx === -1) continue;

      const body = cleanedSql.slice(openParenIdx + 1, closeParenIdx);
      createHeaderRegex.lastIndex = closeParenIdx + 1;

      const parts = fullTableName.split('.');
      const schema = parts.length > 1 ? parts[0] : undefined;
      const tableName = parts.length > 1 ? parts[1] : parts[0];

      const table = this.parseTableBody(tableName, schema, body, dialect, enums);
      tables.push(table);
    }

    // 3. Parse ALTER TABLE ADD FOREIGN KEY statements
    const alterFkRegex =
      /ALTER\s+TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_"`.]+)\s+ADD\s+(?:CONSTRAINT\s+([a-zA-Z0-9_"`.]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_"`.]+)\s*(?:\(([^)]+)\))?(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|RESTRICT|NO\s+ACTION))?/gi;

    let alterMatch: RegExpExecArray | null;
    while ((alterMatch = alterFkRegex.exec(cleanedSql)) !== null) {
      const sourceTableRaw = this.cleanIdentifier(alterMatch[1]);
      const constraintName = alterMatch[2] ? this.cleanIdentifier(alterMatch[2]) : undefined;
      const sourceCols = alterMatch[3].split(',').map((c) => this.cleanIdentifier(c));
      const targetTableRaw = this.cleanIdentifier(alterMatch[4]);
      const targetCols = alterMatch[5]
        ? alterMatch[5].split(',').map((c) => this.cleanIdentifier(c))
        : ['id'];
      const onDelete = alterMatch[6] ? (alterMatch[6].toUpperCase().replace(/\s+/g, ' ') as any) : undefined;
      const onUpdate = alterMatch[7] ? (alterMatch[7].toUpperCase() as any) : undefined;

      const sourceTable = sourceTableRaw.includes('.') ? sourceTableRaw.split('.')[1] : sourceTableRaw;
      const targetTable = targetTableRaw.includes('.') ? targetTableRaw.split('.')[1] : targetTableRaw;

      const table = tables.find((t) => t.name.toLowerCase() === sourceTable.toLowerCase());
      if (table) {
        for (let i = 0; i < sourceCols.length; i++) {
          const colName = sourceCols[i];
          const targetCol = targetCols[i] || targetCols[0];

          const fk: ForeignKeyReference = {
            constraintName,
            sourceColumn: colName,
            targetTable,
            targetColumn: targetCol,
            onDelete,
            onUpdate
          };

          table.foreignKeys.push(fk);

          // Update column's foreign key reference
          const col = table.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
          if (col) {
            col.foreignKey = fk;
          }
        }
      }
    }

    return {
      dialect,
      tables,
      enums
    };
  }

  private static parseTableBody(
    tableName: string,
    schema: string | undefined,
    body: string,
    dialect: SqlDialect,
    globalEnums: Record<string, string[]>
  ): TableDefinition {
    const lines = this.splitDefinitions(body);
    const columns: ColumnDefinition[] = [];
    const primaryKey: string[] = [];
    const foreignKeys: ForeignKeyReference[] = [];
    const uniqueConstraints: string[][] = [];
    const checkConstraints: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // 1. Table-level PRIMARY KEY constraint: PRIMARY KEY (col1, col2)
      const pkMatch = line.match(/^(?:CONSTRAINT\s+[a-zA-Z0-9_"`.]+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].split(',').map((c) => this.cleanIdentifier(c));
        primaryKey.push(...cols);
        continue;
      }

      // 2. Table-level FOREIGN KEY constraint: [CONSTRAINT name] FOREIGN KEY (col) REFERENCES target(target_col)
      const fkMatch = line.match(
        /^(?:CONSTRAINT\s+([a-zA-Z0-9_"`.]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_"`.]+)\s*(?:\(([^)]+)\))?(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|RESTRICT|NO\s+ACTION))?/i
      );
      if (fkMatch) {
        const constraintName = fkMatch[1] ? this.cleanIdentifier(fkMatch[1]) : undefined;
        const sourceCols = fkMatch[2].split(',').map((c) => this.cleanIdentifier(c));
        const targetTableRaw = this.cleanIdentifier(fkMatch[3]);
        const targetCols = fkMatch[4] ? fkMatch[4].split(',').map((c) => this.cleanIdentifier(c)) : ['id'];
        const onDelete = fkMatch[5] ? (fkMatch[5].toUpperCase().replace(/\s+/g, ' ') as any) : undefined;
        const onUpdate = fkMatch[6] ? (fkMatch[6].toUpperCase() as any) : undefined;

        const targetTable = targetTableRaw.includes('.') ? targetTableRaw.split('.')[1] : targetTableRaw;

        for (let i = 0; i < sourceCols.length; i++) {
          foreignKeys.push({
            constraintName,
            sourceColumn: sourceCols[i],
            targetTable,
            targetColumn: targetCols[i] || targetCols[0],
            onDelete,
            onUpdate
          });
        }
        continue;
      }

      // 3. Table-level UNIQUE constraint: UNIQUE (col1, col2)
      const uniqueMatch = line.match(/^(?:CONSTRAINT\s+[a-zA-Z0-9_"`.]+\s+)?UNIQUE\s*(?:KEY|INDEX)?\s*(?:[a-zA-Z0-9_"`.]+\s*)?\(([^)]+)\)/i);
      if (uniqueMatch) {
        const cols = uniqueMatch[1].split(',').map((c) => this.cleanIdentifier(c));
        uniqueConstraints.push(cols);
        continue;
      }

      // 4. Table-level CHECK constraint: CHECK (...)
      const checkMatch = line.match(/^(?:CONSTRAINT\s+[a-zA-Z0-9_"`.]+\s+)?CHECK\s*\((.*)\)$/i);
      if (checkMatch) {
        checkConstraints.push(checkMatch[1].trim());
        continue;
      }

      // 5. Index/Key definitions (e.g. MySQL KEY `idx` (`col`))
      if (/^(?:KEY|INDEX)\s+/i.test(line)) {
        continue;
      }

      // 6. Otherwise: parse as Column Definition
      const col = this.parseColumn(line, dialect, globalEnums);
      if (col) {
        columns.push(col);
        if (col.isPrimaryKey && !primaryKey.includes(col.name)) {
          primaryKey.push(col.name);
        }
        if (col.foreignKey) {
          foreignKeys.push(col.foreignKey);
        }
        if (col.isUnique) {
          uniqueConstraints.push([col.name]);
        }
      }
    }

    // Mark primary key columns from table-level constraint
    for (const pkCol of primaryKey) {
      const col = columns.find((c) => c.name.toLowerCase() === pkCol.toLowerCase());
      if (col) {
        col.isPrimaryKey = true;
        col.isNullable = false;
      }
    }

    // Attach table-level foreign keys to column definitions
    for (const fk of foreignKeys) {
      const col = columns.find((c) => c.name.toLowerCase() === fk.sourceColumn.toLowerCase());
      if (col) {
        col.foreignKey = fk;
        fk.isNullable = col.isNullable;
      }
    }

    return {
      name: tableName,
      schema,
      columns,
      primaryKey,
      foreignKeys,
      uniqueConstraints,
      checkConstraints
    };
  }

  private static parseColumn(
    line: string,
    dialect: SqlDialect,
    globalEnums: Record<string, string[]>
  ): ColumnDefinition | null {
    // Column format: name TYPE [MODIFIERS...]
    const tokens = line.split(/\s+/);
    if (tokens.length < 2) return null;

    const name = this.cleanIdentifier(tokens[0]);

    // Handle types with parentheses like VARCHAR(255) or NUMERIC(10, 2) or ENUM('a','b')
    const remainingLine = line.slice(tokens[0].length).trim();
    const typeMatch = remainingLine.match(/^([a-zA-Z0-9_]+(?:\s*\([^)]*\))?)/i);
    if (!typeMatch) return null;

    const rawType = typeMatch[1].trim();
    const modifiers = remainingLine.slice(typeMatch[0].length).trim();

    const normalized = this.normalizeType(rawType, dialect, globalEnums);

    const isPrimaryKey = /PRIMARY\s+KEY/i.test(modifiers) || /SERIAL|AUTO_INCREMENT|AUTOINCREMENT/i.test(rawType);
    const isAutoIncrement = /AUTO_INCREMENT|AUTOINCREMENT|SERIAL|BIGSERIAL/i.test(rawType + ' ' + modifiers);
    const isNullable = !/NOT\s+NULL/i.test(modifiers) && !isPrimaryKey;
    const isUnique = /UNIQUE/i.test(modifiers);

    // Default value: DEFAULT 'abc' or DEFAULT 123 or DEFAULT gen_random_uuid()
    let defaultValue: string | undefined;
    const defaultMatch = modifiers.match(/DEFAULT\s+([^,]+?)(?=\s+(?:NOT|NULL|UNIQUE|PRIMARY|REFERENCES|CHECK)|$)/i);
    if (defaultMatch) {
      defaultValue = defaultMatch[1].trim().replace(/^['"]|['"]$/g, '');
    }

    // Inline CHECK constraint
    let checkConstraint: string | undefined;
    const checkMatch = modifiers.match(/CHECK\s*\(([^)]+)\)/i);
    if (checkMatch) {
      checkConstraint = checkMatch[1].trim();
    }

    // Inline Foreign Key: REFERENCES target_table(target_col)
    let foreignKey: ForeignKeyReference | undefined;
    const fkMatch = modifiers.match(/REFERENCES\s+([a-zA-Z0-9_"`.]+)\s*(?:\(([^)]+)\))?(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i);
    if (fkMatch) {
      const targetTableRaw = this.cleanIdentifier(fkMatch[1]);
      const targetTable = targetTableRaw.includes('.') ? targetTableRaw.split('.')[1] : targetTableRaw;
      const targetColumn = fkMatch[2] ? this.cleanIdentifier(fkMatch[2]) : 'id';
      const onDelete = fkMatch[3] ? (fkMatch[3].toUpperCase().replace(/\s+/g, ' ') as any) : undefined;

      foreignKey = {
        sourceColumn: name,
        targetTable,
        targetColumn,
        onDelete,
        isNullable
      };
    }

    // Extract length/precision
    let length: number | undefined;
    let precision: number | undefined;
    let scale: number | undefined;

    const paramMatch = rawType.match(/\(([^)]+)\)/);
    if (paramMatch) {
      const params = paramMatch[1].split(',').map((p) => p.trim());
      if (params.length === 1 && !isNaN(Number(params[0]))) {
        length = Number(params[0]);
      } else if (params.length === 2) {
        precision = Number(params[0]);
        scale = Number(params[1]);
      }
    }

    // Enum values (MySQL inline ENUM or Postgres custom enum)
    let enumValues: string[] | undefined;
    if (/^ENUM/i.test(rawType) && paramMatch) {
      enumValues = paramMatch[1]
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (globalEnums[normalized.normalizedType]) {
      enumValues = globalEnums[normalized.normalizedType];
    }

    return {
      name,
      category: normalized.category,
      rawType,
      normalizedType: normalized.normalizedType,
      isPrimaryKey,
      isAutoIncrement,
      isNullable,
      isUnique,
      defaultValue,
      checkConstraint,
      foreignKey,
      enumValues,
      length,
      precision,
      scale
    };
  }

  private static normalizeType(
    rawType: string,
    dialect: SqlDialect,
    globalEnums: Record<string, string[]>
  ): { category: ColumnCategory; normalizedType: string } {
    const base = rawType.split('(')[0].trim().toLowerCase();

    // Check if it matches a custom registered enum
    if (globalEnums[base]) {
      return { category: 'enum', normalizedType: base };
    }

    switch (base) {
      // UUID
      case 'uuid':
        return { category: 'uuid', normalizedType: 'uuid' };

      // Numeric
      case 'int':
      case 'integer':
      case 'int2':
      case 'int4':
      case 'smallint':
      case 'mediumint':
      case 'tinyint':
        return { category: 'numeric', normalizedType: 'integer' };

      case 'bigint':
      case 'int8':
        return { category: 'numeric', normalizedType: 'bigint' };

      case 'serial':
      case 'smallserial':
        return { category: 'numeric', normalizedType: 'serial' };

      case 'bigserial':
        return { category: 'numeric', normalizedType: 'bigserial' };

      case 'decimal':
      case 'numeric':
      case 'fixed':
        return { category: 'numeric', normalizedType: 'decimal' };

      case 'float':
      case 'float4':
      case 'float8':
      case 'double':
      case 'real':
        return { category: 'numeric', normalizedType: 'float' };

      // Textual
      case 'varchar':
      case 'character varying':
      case 'nvarchar':
      case 'tinytext':
        return { category: 'textual', normalizedType: 'varchar' };

      case 'char':
      case 'character':
      case 'nchar':
        return { category: 'textual', normalizedType: 'char' };

      case 'text':
      case 'longtext':
      case 'mediumtext':
      case 'citext':
      case 'string':
        return { category: 'textual', normalizedType: 'text' };

      // Temporal
      case 'timestamp':
      case 'timestamptz':
      case 'timestamp with time zone':
      case 'timestamp without time zone':
      case 'datetime':
        return { category: 'temporal', normalizedType: 'timestamp' };

      case 'date':
        return { category: 'temporal', normalizedType: 'date' };

      case 'time':
      case 'timetz':
        return { category: 'temporal', normalizedType: 'time' };

      // Boolean
      case 'boolean':
      case 'bool':
        return { category: 'boolean', normalizedType: 'boolean' };

      // JSON
      case 'json':
      case 'jsonb':
        return { category: 'json', normalizedType: 'json' };

      // Enum
      case 'enum':
        return { category: 'enum', normalizedType: 'enum' };

      // Binary
      case 'bytea':
      case 'blob':
      case 'varbinary':
        return { category: 'binary', normalizedType: 'blob' };

      default:
        return { category: 'custom', normalizedType: base };
    }
  }

  private static cleanIdentifier(identifier: string): string {
    return identifier.replace(/[`"'[\]]/g, '').trim();
  }

  private static stripComments(sql: string): string {
    return sql
      .replace(/--.*$/gm, '') // Single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments
      .trim();
  }

  private static splitDefinitions(body: string): string[] {
    const definitions: string[] = [];
    let current = '';
    let parenDepth = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < body.length; i++) {
      const char = body[i];

      if ((char === "'" || char === '"' || char === '`') && body[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
      }

      if (!inQuotes) {
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
        if (char === ',' && parenDepth === 0) {
          definitions.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      definitions.push(current.trim());
    }

    return definitions;
  }

  private static findMatchingParen(sql: string, openIdx: number): number {
    let depth = 1;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = openIdx + 1; i < sql.length; i++) {
      const char = sql[i];
      const prevChar = sql[i - 1];

      if ((char === "'" || char === '"' || char === '`') && prevChar !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
      }

      if (!inQuotes) {
        if (char === '(') depth++;
        if (char === ')') {
          depth--;
          if (depth === 0) {
            return i;
          }
        }
      }
    }
    return -1;
  }

  private static detectDialect(sql: string): SqlDialect {
    const s = sql.toLowerCase();
    if (s.includes('serial') || s.includes('bigserial') || s.includes('jsonb') || s.includes('timestamptz') || s.includes('gen_random_uuid')) {
      return 'postgres';
    }
    if (s.includes('auto_increment') || s.includes('engine=') || s.includes('`')) {
      return 'mysql';
    }
    if (s.includes('autoincrement') || s.includes('without rowid')) {
      return 'sqlite';
    }
    return 'postgres'; // Default modern standard
  }
}
