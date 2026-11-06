import type { RelationalDataset } from '../generator/engine.js';
import type { DatabaseSchema } from '../types/schema.js';
import type { QueryResult, TableMetadata, WasmDatabaseEngine } from './types.js';

export class InMemoryMockDatabase implements WasmDatabaseEngine {
  private tables = new Map<string, Record<string, any>[]>();
  private schema: DatabaseSchema | null = null;

  constructor(schema?: DatabaseSchema, dataset?: RelationalDataset) {
    if (schema) this.loadSchema(schema);
    if (dataset) this.loadDataset(dataset);
  }

  loadSchema(schema: DatabaseSchema): void {
    this.schema = schema;
    for (const table of schema.tables) {
      if (!this.tables.has(table.name.toLowerCase())) {
        this.tables.set(table.name.toLowerCase(), []);
      }
    }
  }

  loadDataset(dataset: RelationalDataset): void {
    for (const [tableName, rows] of Object.entries(dataset.tables)) {
      // Store deep clones of rows to prevent mutation side-effects
      this.tables.set(tableName.toLowerCase(), rows.map((r) => ({ ...r })));
    }
  }

  getTables(): TableMetadata[] {
    const list: TableMetadata[] = [];
    for (const [name, rows] of this.tables.entries()) {
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      list.push({
        name,
        rowCount: rows.length,
        columns
      });
    }
    return list;
  }

  getTableRows(tableName: string): Record<string, any>[] {
    return this.tables.get(tableName.toLowerCase()) || [];
  }

  /**
   * Executes a standard SQL query against the in-memory database
   */
  query(sql: string): QueryResult {
    const startTime = performance.now();
    const cleanSql = sql.trim().replace(/;+$/, '');
    const firstWord = cleanSql.split(/\s+/)[0]?.toUpperCase();

    let resultRows: Record<string, any>[] = [];
    let columns: string[] = [];

    switch (firstWord) {
      case 'SELECT':
        ({ rows: resultRows, columns } = this.executeSelect(cleanSql));
        break;

      case 'INSERT':
        resultRows = this.executeInsert(cleanSql);
        columns = ['status', 'inserted_count'];
        break;

      case 'DELETE':
        resultRows = this.executeDelete(cleanSql);
        columns = ['status', 'deleted_count'];
        break;

      default:
        throw new Error(`Unsupported SQL statement: ${firstWord}. InMemoryMockDatabase supports SELECT, INSERT, DELETE.`);
    }

    return {
      rows: resultRows,
      columns,
      rowCount: resultRows.length,
      durationMs: performance.now() - startTime
    };
  }

  private executeSelect(sql: string): { rows: Record<string, any>[]; columns: string[] } {
    // Basic regex parser for SELECT ... FROM ... [JOIN ...] [WHERE ...] [ORDER BY ...] [LIMIT ... OFFSET ...]
    const fromMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_"`]+)([\s\S]*)/i);
    if (!fromMatch) {
      throw new Error(`Malformed SELECT query: ${sql}`);
    }

    const selectPart = fromMatch[1].trim();
    const primaryTableName = fromMatch[2].replace(/[`"]/g, '').toLowerCase();
    const restPart = fromMatch[3].trim();

    let sourceRows = this.tables.get(primaryTableName);
    if (!sourceRows) {
      throw new Error(`Table '${primaryTableName}' does not exist in mock database`);
    }

    // Check for JOIN
    const joinMatch = restPart.match(/(?:INNER\s+|LEFT\s+)?JOIN\s+([a-zA-Z0-9_"`]+)\s+ON\s+([\s\S]+?)(?=\s+WHERE|\s+ORDER|\s+LIMIT|$)/i);
    let workingRows: Record<string, any>[] = [...sourceRows];

    if (joinMatch) {
      const joinTableName = joinMatch[1].replace(/[`"]/g, '').toLowerCase();
      const onCondition = joinMatch[2].trim();
      const joinRows = this.tables.get(joinTableName) || [];

      // Parse ON t1.col = t2.col
      const onParts = onCondition.split('=').map((s) => s.trim());
      if (onParts.length === 2) {
        const leftCol = onParts[0].split('.').pop()!.replace(/[`"]/g, '');
        const rightCol = onParts[1].split('.').pop()!.replace(/[`"]/g, '');

        const joined: Record<string, any>[] = [];
        for (const row1 of workingRows) {
          const matches = joinRows.filter((row2) => row1[leftCol] === row2[rightCol] || row1[rightCol] === row2[leftCol]);
          for (const match of matches) {
            joined.push({ ...row1, ...match });
          }
        }
        workingRows = joined;
      }
    }

    // WHERE Clause
    const whereMatch = restPart.match(/WHERE\s+([\s\S]+?)(?=\s+ORDER|\s+LIMIT|$)/i);
    if (whereMatch) {
      const whereCondition = whereMatch[1].trim();
      workingRows = workingRows.filter((row) => this.evaluateCondition(whereCondition, row));
    }

    // Aggregate Checks: COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)
    const countMatch = selectPart.match(/COUNT\(([\s\S]*?)\)/i);
    const sumMatch = selectPart.match(/SUM\(([a-zA-Z0-9_"`]+)\)/i);
    const avgMatch = selectPart.match(/AVG\(([a-zA-Z0-9_"`]+)\)/i);

    if (countMatch || sumMatch || avgMatch) {
      const aggRow: Record<string, any> = {};
      const cols: string[] = [];

      if (countMatch) {
        aggRow['count'] = workingRows.length;
        cols.push('count');
      }
      if (sumMatch) {
        const col = sumMatch[1].replace(/[`"]/g, '');
        const sum = workingRows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);
        aggRow['sum'] = sum;
        cols.push('sum');
      }
      if (avgMatch) {
        const col = avgMatch[1].replace(/[`"]/g, '');
        const sum = workingRows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);
        aggRow['avg'] = workingRows.length > 0 ? sum / workingRows.length : 0;
        cols.push('avg');
      }

      return { rows: [aggRow], columns: cols };
    }

    // ORDER BY Clause
    const orderMatch = restPart.match(/ORDER\s+BY\s+([a-zA-Z0-9_"`]+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const orderCol = orderMatch[1].replace(/[`"]/g, '');
      const isDesc = (orderMatch[2] || 'ASC').toUpperCase() === 'DESC';

      workingRows.sort((a, b) => {
        const valA = a[orderCol];
        const valB = b[orderCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return isDesc ? 1 : -1;
        if (valB === null || valB === undefined) return isDesc ? -1 : 1;
        if (valA < valB) return isDesc ? 1 : -1;
        return isDesc ? -1 : 1;
      });
    }

    // LIMIT & OFFSET Clause
    const limitMatch = restPart.match(/LIMIT\s+([0-9]+)(?:\s+OFFSET\s+([0-9]+))?/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      const offset = limitMatch[2] ? parseInt(limitMatch[2], 10) : 0;
      workingRows = workingRows.slice(offset, offset + limit);
    }

    // Projections
    if (selectPart === '*') {
      const cols = workingRows.length > 0 ? Object.keys(workingRows[0]) : [];
      return { rows: workingRows, columns: cols };
    }

    const requestedCols = selectPart.split(',').map((c) => c.trim().replace(/[`"]/g, ''));
    const projectedRows = workingRows.map((row) => {
      const proj: Record<string, any> = {};
      for (const col of requestedCols) {
        // Strip table prefix if present (e.g. users.name -> name)
        const pureCol = col.includes('.') ? col.split('.').pop()! : col;
        proj[pureCol] = row[pureCol];
      }
      return proj;
    });

    return { rows: projectedRows, columns: requestedCols.map((c) => c.split('.').pop()!) };
  }

  private evaluateCondition(condition: string, row: Record<string, any>): boolean {
    // Handle AND / OR boolean conditions
    if (condition.includes(' AND ')) {
      const parts = condition.split(' AND ');
      return parts.every((p) => this.evaluateCondition(p.trim(), row));
    }
    if (condition.includes(' OR ')) {
      const parts = condition.split(' OR ');
      return parts.some((p) => this.evaluateCondition(p.trim(), row));
    }

    // Equality: col = 'value'
    const eqMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s*=\s*(.+)$/);
    if (eqMatch) {
      const col = eqMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      const rawVal = eqMatch[2].trim().replace(/^['"]|['"]$/g, '');
      return String(row[col]) === rawVal;
    }

    // Inequality: col != 'value' or col <> 'value'
    const neqMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s*(?:!=|<>)\s*(.+)$/);
    if (neqMatch) {
      const col = neqMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      const rawVal = neqMatch[2].trim().replace(/^['"]|['"]$/g, '');
      return String(row[col]) !== rawVal;
    }

    // Greater than or equal: col >= 10
    const gteMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s*>=\s*([0-9.]+)$/);
    if (gteMatch) {
      const col = gteMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      return Number(row[col]) >= Number(gteMatch[2]);
    }

    // Less than or equal: col <= 10
    const lteMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s*<=\s*([0-9.]+)$/);
    if (lteMatch) {
      const col = lteMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      return Number(row[col]) <= Number(lteMatch[2]);
    }

    // Greater than: col > 10
    const gtMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s*>\s*([0-9.]+)$/);
    if (gtMatch) {
      const col = gtMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      return Number(row[col]) > Number(gtMatch[2]);
    }

    // Less than: col < 10
    const ltMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s*<\s*([0-9.]+)$/);
    if (ltMatch) {
      const col = ltMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      return Number(row[col]) < Number(ltMatch[2]);
    }

    // LIKE: col LIKE '%value%'
    const likeMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s+LIKE\s+'(.+)'$/i);
    if (likeMatch) {
      const col = likeMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      const pattern = likeMatch[2].replace(/%/g, '.*');
      const reg = new RegExp(`^${pattern}$`, 'i');
      return reg.test(String(row[col] || ''));
    }

    // IS NULL
    const isNullMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s+IS\s+NULL$/i);
    if (isNullMatch) {
      const col = isNullMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      return row[col] === null || row[col] === undefined;
    }

    // IS NOT NULL
    const isNotNullMatch = condition.match(/^([a-zA-Z0-9_."`]+)\s+IS\s+NOT\s+NULL$/i);
    if (isNotNullMatch) {
      const col = isNotNullMatch[1].split('.').pop()!.replace(/[`"]/g, '');
      return row[col] !== null && row[col] !== undefined;
    }

    return true;
  }

  private executeInsert(sql: string): Record<string, any>[] {
    const insertMatch = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_"`]+)\s*\(([\s\S]+?)\)\s*VALUES\s*\(([\s\S]+?)\)/i);
    if (!insertMatch) {
      throw new Error(`Malformed INSERT query: ${sql}`);
    }

    const tableName = insertMatch[1].replace(/[`"]/g, '').toLowerCase();
    const cols = insertMatch[2].split(',').map((c) => c.trim().replace(/[`"]/g, ''));
    const rawValues = insertMatch[3].split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''));

    const rows = this.tables.get(tableName);
    if (!rows) throw new Error(`Table '${tableName}' not found`);

    const newRow: Record<string, any> = {};
    for (let i = 0; i < cols.length; i++) {
      newRow[cols[i]] = rawValues[i];
    }

    rows.push(newRow);
    return [{ status: 'success', inserted_count: 1 }];
  }

  private executeDelete(sql: string): Record<string, any>[] {
    const delMatch = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_"`]+)(?:\s+WHERE\s+([\s\S]+))?/i);
    if (!delMatch) throw new Error(`Malformed DELETE query: ${sql}`);

    const tableName = delMatch[1].replace(/[`"]/g, '').toLowerCase();
    const whereCond = delMatch[2]?.trim();

    const rows = this.tables.get(tableName);
    if (!rows) throw new Error(`Table '${tableName}' not found`);

    const initialLen = rows.length;
    if (!whereCond) {
      this.tables.set(tableName, []);
      return [{ status: 'success', deleted_count: initialLen }];
    }

    const remaining = rows.filter((r) => !this.evaluateCondition(whereCond, r));
    this.tables.set(tableName, remaining);
    return [{ status: 'success', deleted_count: initialLen - remaining.length }];
  }
}
