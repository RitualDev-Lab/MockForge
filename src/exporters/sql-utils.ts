export class SqlUtils {
  /**
   * Safely escapes and formats a JavaScript value into SQL literal representation
   */
  static formatValue(val: any, dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'): string {
    if (val === null || val === undefined) {
      return 'NULL';
    }

    if (typeof val === 'boolean') {
      if (dialect === 'sqlite') {
        return val ? '1' : '0';
      }
      return val ? 'TRUE' : 'FALSE';
    }

    if (typeof val === 'number') {
      if (isNaN(val)) return 'NULL';
      return String(val);
    }

    if (val instanceof Date) {
      return `'${val.toISOString()}'`;
    }

    if (typeof val === 'object') {
      // JSON objects and arrays
      const jsonStr = JSON.stringify(val).replace(/'/g, "''");
      return `'${jsonStr}'`;
    }

    // String escaping: standard SQL single-quote doubling
    const strVal = String(val).replace(/'/g, "''");
    return `'${strVal}'`;
  }

  /**
   * Quotes an identifier based on SQL dialect
   */
  static quoteIdentifier(identifier: string, dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'): string {
    if (dialect === 'mysql') {
      return `\`${identifier}\``;
    }
    return `"${identifier}"`;
  }

  /**
   * Splits an array of items into chunks of max size
   */
  static chunk<T>(items: T[], size: number): T[][] {
    if (size <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }
}
