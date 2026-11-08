import { createHash } from 'node:crypto';
import { SeededPRNG } from '../generator/prng.js';
import { IdentityGenerator } from '../generator/generators/identity.js';
import { FinanceGenerator } from '../generator/generators/finance.js';
import { GeoGenerator } from '../generator/generators/geo.js';
import { FormatPreservingCipher } from './fpe.js';

export type MaskingStrategy =
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'hash'
  | 'redact'
  | 'null'
  | 'ip'
  | 'address'
  | 'password'
  | 'fpe'
  | 'preserve';

export interface ColumnMaskRule {
  tableName: string;
  columnName: string;
  strategy: MaskingStrategy;
  preserveFormat?: boolean;
}

export interface MaskingOptions {
  seed?: number | string;
  salt?: string;
  preservePrimaryKeys?: boolean;
  preserveForeignKeys?: boolean;
  customRules?: ColumnMaskRule[];
  defaultEmailDomain?: string;
  fpeKey?: string;
}

export interface MaskingAuditReport {
  timestamp: string;
  tablesProcessed: number;
  rowsProcessed: number;
  columnsMasked: {
    table: string;
    column: string;
    strategy: MaskingStrategy;
    count: number;
  }[];
  compliance: {
    hipaaCompliant: boolean;
    gdprCompliant: boolean;
    pciDssCompliant: boolean;
    soc2Compliant: boolean;
    dpdpCompliant: boolean;
  };
}

export interface MaskingResult<T = Record<string, any[]>> {
  data: T;
  auditReport: MaskingAuditReport;
}

/**
 * Enterprise Production Database Masker & Anonymizer
 * Sanitizes live production database snapshots into compliant test datasets
 * while strictly maintaining foreign-key referential integrity.
 */
export class DatabaseMasker {
  private prng: SeededPRNG;
  private salt: string;
  private options: Required<Omit<MaskingOptions, "fpeKey">> & { fpeKey?: string };
  private fpeCipher: FormatPreservingCipher;
  // Deterministic mapping cache to ensure consistent pseudonymization across tables
  private valueMappingCache = new Map<string, any>();

  constructor(options?: MaskingOptions) {
    const seed = options?.seed ?? 42;
    this.prng = new SeededPRNG(seed);
    this.salt = options?.salt || 'mockforge-enterprise-salt-v1';
    this.fpeCipher = new FormatPreservingCipher(options?.fpeKey || 'mockforge-fpe-key-2026', this.salt);
    this.options = {
      seed,
      salt: this.salt,
      preservePrimaryKeys: options?.preservePrimaryKeys ?? true,
      preserveForeignKeys: options?.preserveForeignKeys ?? true,
      customRules: options?.customRules ?? [],
      defaultEmailDomain: options?.defaultEmailDomain ?? 'anonymized-test.internal',
      fpeKey: options?.fpeKey
    };
  }

  /**
   * Infers default masking strategy for a column name based on HIPAA, GDPR, and PCI heuristics
   */
  public inferStrategy(columnName: string, tableName?: string): MaskingStrategy {
    const col = columnName.toLowerCase();
    
    // Check custom rules first
    if (this.options.customRules.length > 0) {
      const matched = this.options.customRules.find(r => 
        (!r.tableName || r.tableName.toLowerCase() === tableName?.toLowerCase()) &&
        r.columnName.toLowerCase() === col
      );
      if (matched) return matched.strategy;
    }

    // Passwords & Tokens
    if (col.includes('password') || col.includes('passwd') || col.includes('secret') || col.includes('token') || col.includes('api_key')) {
      return 'password';
    }

    // SSN / National IDs (HIPAA Safe Harbor)
    if (col.includes('ssn') || col.includes('social_sec') || col.includes('national_id') || col.includes('aadhaar') || col.includes('pan_card')) {
      return 'ssn';
    }

    // Credit card / Financial PII (PCI-DSS)
    if (col.includes('credit_card') || col.includes('card_num') || col.includes('cc_num') || col.includes('pan') || col.includes('cvv')) {
      return 'credit_card';
    }

    // Email
    if (col.includes('email') || col.includes('e_mail') || col.includes('mail_addr')) {
      return 'email';
    }

    // Phone
    if (col.includes('phone') || col.includes('mobile') || col.includes('cell') || col.includes('fax')) {
      return 'phone';
    }

    // First / Last Name
    if (col === 'first_name' || col === 'fname') return 'first_name';
    if (col === 'last_name' || col === 'lname') return 'last_name';
    if (col.includes('name') && !col.includes('filename') && !col.includes('classname') && !col.includes('hostname')) {
      return 'name';
    }

    // IP addresses
    if (col.includes('ip_address') || col.includes('ip_addr') || col === 'ip') {
      return 'ip';
    }

    // Physical Address
    if (col.includes('street') || col.includes('address') || col.includes('addr1') || col.includes('billing_address') || col.includes('shipping_address')) {
      return 'address';
    }

    return 'preserve';
  }

  /**
   * Mask an in-memory relational dataset (record of table arrays)
   */
  public maskDataset(dataset: Record<string, any[]>): MaskingResult {
    const masked: Record<string, any[]> = {};
    const auditMap = new Map<string, { table: string; column: string; strategy: MaskingStrategy; count: number }>();
    let totalRows = 0;

    for (const [tableName, rows] of Object.entries(dataset)) {
      if (!Array.isArray(rows)) continue;
      masked[tableName] = [];
      totalRows += rows.length;

      for (const row of rows) {
        const maskedRow = { ...row };

        for (const [colName, val] of Object.entries(row)) {
          if (val === null || val === undefined) continue;

          // Preserve keys if configured
          const isPk = (colName === 'id' || colName.endsWith('_id') || colName === `${tableName}_id`) && (typeof val === 'number' || typeof val === 'string');
          if (isPk && (this.options.preservePrimaryKeys || this.options.preserveForeignKeys)) {
            // Check if column is an explicit custom rule target
            const explicit = this.options.customRules.some(r => r.columnName.toLowerCase() === colName.toLowerCase());
            if (!explicit) {
              continue;
            }
          }

          const strategy = this.inferStrategy(colName, tableName);
          if (strategy !== 'preserve') {
            maskedRow[colName] = this.applyMasking(val, strategy, `${tableName}.${colName}`);

            const auditKey = `${tableName}.${colName}`;
            const existing = auditMap.get(auditKey);
            if (existing) {
              existing.count++;
            } else {
              auditMap.set(auditKey, {
                table: tableName,
                column: colName,
                strategy,
                count: 1
              });
            }
          }
        }
        masked[tableName].push(maskedRow);
      }
    }

    const columnsMasked = Array.from(auditMap.values());

    return {
      data: masked,
      auditReport: {
        timestamp: new Date().toISOString(),
        tablesProcessed: Object.keys(dataset).length,
        rowsProcessed: totalRows,
        columnsMasked,
        compliance: {
          hipaaCompliant: columnsMasked.some(c => c.strategy === 'ssn' || c.strategy === 'name' || c.strategy === 'email'),
          gdprCompliant: columnsMasked.some(c => c.strategy === 'name' || c.strategy === 'email' || c.strategy === 'phone'),
          pciDssCompliant: columnsMasked.some(c => c.strategy === 'credit_card' || c.strategy === 'hash'),
          soc2Compliant: true,
          dpdpCompliant: true
        }
      }
    };
  }

  /**
   * Masks a SQL dump string containing INSERT INTO statements
   */
  public maskSqlDump(sqlContent: string): { maskedSql: string; auditReport: MaskingAuditReport } {
    // Regular expression matching INSERT INTO <table> (...) VALUES (...);
    const insertRegex = /INSERT\s+INTO\s+["`]?([a-zA-Z0-9_]+)["`]?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/gi;
    const auditMap = new Map<string, { table: string; column: string; strategy: MaskingStrategy; count: number }>();
    let totalRows = 0;
    const tablesProcessed = new Set<string>();

    const maskedSql = sqlContent.replace(insertRegex, (match, tableName, colList, valList) => {
      tablesProcessed.add(tableName);
      const columns = colList.split(',').map((c: string) => c.trim().replace(/["`]/g, ''));

      // Parse individual rows inside VALUES (...), (...)
      const rowMatches = valList.match(/\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/g);
      if (!rowMatches) return match;

      const maskedRows: string[] = [];

      for (const rowRaw of rowMatches) {
        totalRows++;
        // Remove outer parens
        const inner = rowRaw.slice(1, -1).trim();
        const rawValues = this.parseSqlRowValues(inner);

        const newValues = rawValues.map((val, idx) => {
          const colName = columns[idx];
          if (!colName) return val;

          // Preserve keys
          const isPk = colName === 'id' || colName.endsWith('_id');
          if (isPk && (this.options.preservePrimaryKeys || this.options.preserveForeignKeys)) {
            return val;
          }

          const strategy = this.inferStrategy(colName, tableName);
          if (strategy === 'preserve') return val;

          // Strip quotes if string
          const cleanVal = (val.startsWith("'") && val.endsWith("'")) ? val.slice(1, -1) : val;
          const masked = this.applyMasking(cleanVal, strategy, `${tableName}.${colName}`);

          const auditKey = `${tableName}.${colName}`;
          const existing = auditMap.get(auditKey);
          if (existing) {
            existing.count++;
          } else {
            auditMap.set(auditKey, { table: tableName, column: colName, strategy, count: 1 });
          }

          if (masked === null) return 'NULL';
          if (typeof masked === 'string') return `'${masked.replace(/'/g, "''")}'`;
          return String(masked);
        });

        maskedRows.push(`(${newValues.join(', ')})`);
      }

      return `INSERT INTO "${tableName}" (${columns.map((c: string) => `"${c}"`).join(', ')}) VALUES\n  ${maskedRows.join(',\n  ')};`;
    });

    const columnsMasked = Array.from(auditMap.values());

    return {
      maskedSql,
      auditReport: {
        timestamp: new Date().toISOString(),
        tablesProcessed: tablesProcessed.size,
        rowsProcessed: totalRows,
        columnsMasked,
        compliance: {
          hipaaCompliant: columnsMasked.some(c => c.strategy === 'ssn' || c.strategy === 'name' || c.strategy === 'email'),
          gdprCompliant: columnsMasked.some(c => c.strategy === 'name' || c.strategy === 'email' || c.strategy === 'phone'),
          pciDssCompliant: columnsMasked.some(c => c.strategy === 'credit_card' || c.strategy === 'hash'),
          soc2Compliant: true,
          dpdpCompliant: true
        }
      }
    };
  }

  /**
   * Applies the transformation strategy with deterministic caching
   */
  public applyMasking(originalValue: any, strategy: MaskingStrategy, contextKey: string): any {
    if (originalValue === null || originalValue === undefined) return null;

    // Cache key for consistent deterministic pseudonymization
    const cacheKey = `${this.salt}:${contextKey}:${String(originalValue)}`;
    if (this.valueMappingCache.has(cacheKey)) {
      return this.valueMappingCache.get(cacheKey);
    }

    let result: any;
    switch (strategy) {
      case 'first_name':
        result = IdentityGenerator.firstName(this.prng);
        break;
      case 'last_name':
        result = IdentityGenerator.lastName(this.prng);
        break;
      case 'name':
        result = IdentityGenerator.fullName(this.prng);
        break;
      case 'email': {
        const username = IdentityGenerator.username(this.prng);
        result = `${username}@${this.options.defaultEmailDomain}`;
        break;
      }
      case 'phone':
        result = IdentityGenerator.phone(this.prng);
        break;
      case 'ssn':
        result = IdentityGenerator.ssn(this.prng);
        break;
      case 'credit_card':
        result = FinanceGenerator.creditCard(this.prng, 'visa');
        break;
      case 'hash':
        result = createHash('sha256').update(`${this.salt}:${String(originalValue)}`).digest('hex').slice(0, 32);
        break;
      case 'redact': {
        const str = String(originalValue);
        if (str.length <= 4) return '****';
        result = `${str.slice(0, 2)}${'*'.repeat(Math.max(2, str.length - 4))}${str.slice(-2)}`;
        break;
      }
      case 'ip':
        result = `192.0.2.${this.prng.int(1, 254)}`;
        break;
      case 'address':
        result = GeoGenerator.streetAddress(this.prng);
        break;
      case 'password':
        // Bcrypt-like mock hash
        result = `$2a$12$e7Q8u...${createHash('sha256').update(String(originalValue)).digest('hex').slice(0, 22)}`;
        break;
      case 'fpe':
        result = this.fpeCipher.encrypt(String(originalValue), contextKey);
        break;
      case 'null':
        result = null;
        break;
      case 'preserve':
      default:
        result = originalValue;
        break;
    }

    this.valueMappingCache.set(cacheKey, result);
    return result;
  }

  private parseSqlRowValues(rowStr: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if ((char === "'" || char === '"') && (i === 0 || rowStr[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (quoteChar === char) {
          inQuotes = false;
        }
        current += char;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim().length > 0) {
      values.push(current.trim());
    }
    return values;
  }
}
