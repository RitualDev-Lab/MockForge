import type { ColumnDefinition, TableDefinition } from '../types/schema.js';
import type { SemanticColumnProfile, InferredDomainType } from './types.js';

interface HeuristicPattern {
  regex: RegExp;
  domain: InferredDomainType;
  description: string;
  suggestedGenerator?: string;
  enumOptions?: string[];
  range?: { min: number; max: number; precision?: number };
  confidence: number;
}

export class LocalSemanticHeuristics {
  private static readonly RULES: HeuristicPattern[] = [
    // 1. Transaction & Payment Status Codes
    {
      regex: /^(tx|txn|trans)(_(st|state|status|cd|code))+$/i,
      domain: 'enum',
      description: 'Transaction status lifecycle code',
      enumOptions: ['INIT', 'PENDING', 'AUTH', 'CAPTURED', 'SETTLED', 'FAILED', 'REFUNDED'],
      confidence: 0.95
    },
    {
      regex: /^(order|ord)(_(st|state|status|cd|code))+$/i,
      domain: 'enum',
      description: 'Order fulfillment status code',
      enumOptions: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'],
      confidence: 0.95
    },
    {
      regex: /^(kyc|identity)(_(st|status|state|cd|code))+$/i,
      domain: 'enum',
      description: 'Customer KYC verification lifecycle state',
      enumOptions: ['PENDING', 'DOCS_SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'],
      confidence: 0.95
    },
    {
      regex: /^((usr_|acct_|sub_)?tier(_cd|_code)?|plan_cd)$/i,
      domain: 'enum',
      description: 'User or subscription pricing tier code',
      enumOptions: ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'],
      confidence: 0.92
    },
    {
      regex: /^(sub|subscription)(_(st|status|state|cd|code))+$/i,
      domain: 'enum',
      description: 'SaaS subscription status state',
      enumOptions: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED'],
      confidence: 0.94
    },
    {
      regex: /^(pay_mthd|pmt_type|pmt_meth|payment_mode)$/i,
      domain: 'enum',
      description: 'Payment method classification',
      enumOptions: ['CREDIT_CARD', 'DEBIT_CARD', 'ACH', 'WIRE', 'PAYPAL', 'APPLE_PAY'],
      confidence: 0.95
    },
    {
      regex: /^(dept_cd|dept_code|department_cd)$/i,
      domain: 'enum',
      description: 'Corporate organizational department code',
      enumOptions: ['ENG', 'SALES', 'MKTG', 'HR', 'FIN', 'LEGAL', 'OPS', 'SUPPORT'],
      confidence: 0.92
    },
    {
      regex: /^(cust_seg|seg_cd|customer_segment)$/i,
      domain: 'enum',
      description: 'Customer market segmentation category',
      enumOptions: ['SMB', 'MID_MARKET', 'ENTERPRISE', 'VIP'],
      confidence: 0.92
    },
    {
      regex: /^(log_lvl|severity_cd|log_level)$/i,
      domain: 'enum',
      description: 'Logging or event severity level',
      enumOptions: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'],
      confidence: 0.96
    },
    {
      regex: /^(env_cd|env_type|environment)$/i,
      domain: 'enum',
      description: 'Deployment runtime environment code',
      enumOptions: ['DEV', 'STAGING', 'SANDBOX', 'PRODUCTION'],
      confidence: 0.9
    },
    {
      regex: /^(priority_cd|prio_lvl)$/i,
      domain: 'enum',
      description: 'Issue or ticket priority code',
      enumOptions: ['P0', 'P1', 'P2', 'P3'],
      confidence: 0.9
    },
    {
      regex: /^(http_st|http_code|resp_code|status_code)$/i,
      domain: 'enum',
      description: 'HTTP response status code',
      enumOptions: ['200', '201', '204', '400', '401', '403', '404', '500', '502', '503'],
      confidence: 0.95
    },

    // 2. Financial & Business Metrics (Ranges)
    {
      regex: /^(mrr_cents|mrr_in_cents)$/i,
      domain: 'numeric_range',
      description: 'Monthly Recurring Revenue in cents',
      range: { min: 2500, max: 250000, precision: 0 },
      confidence: 0.95
    },
    {
      regex: /^(arr_dollars|arr_amt|arr)$/i,
      domain: 'numeric_range',
      description: 'Annual Recurring Revenue in dollars',
      range: { min: 12000, max: 600000, precision: 2 },
      confidence: 0.95
    },
    {
      regex: /^(nps_score|csat_score)$/i,
      domain: 'numeric_range',
      description: 'Customer satisfaction/NPS score (0 to 10)',
      range: { min: 0, max: 10, precision: 0 },
      confidence: 0.95
    },
    {
      regex: /^(churn_rate|churn_pct)$/i,
      domain: 'numeric_range',
      description: 'Customer or revenue churn rate percentage',
      range: { min: 0.01, max: 0.075, precision: 4 },
      confidence: 0.92
    },
    {
      regex: /^(uptime_pct|uptime_percent)$/i,
      domain: 'numeric_range',
      description: 'Service availability SLA uptime percentage',
      range: { min: 99.1, max: 99.99, precision: 2 },
      confidence: 0.95
    },
    {
      regex: /^(latency_ms|resp_time_ms)$/i,
      domain: 'numeric_range',
      description: 'Network or API response latency in milliseconds',
      range: { min: 15, max: 350, precision: 0 },
      confidence: 0.95
    },
    {
      regex: /^(cpu_pct|mem_pct|disk_pct)$/i,
      domain: 'numeric_range',
      description: 'Hardware resource utilization percentage',
      range: { min: 8.5, max: 88.0, precision: 1 },
      confidence: 0.9
    },
    {
      regex: /^(retry_cnt|retry_count|attempts)$/i,
      domain: 'numeric_range',
      description: 'Operation retry attempt count',
      range: { min: 0, max: 4, precision: 0 },
      confidence: 0.9
    },
    {
      regex: /^(disc_pct|discount_rate|discount_pct)$/i,
      domain: 'numeric_range',
      description: 'Promotional discount percentage rate',
      range: { min: 0.0, max: 0.3, precision: 2 },
      confidence: 0.9
    },

    // 3. Cryptic Identity & Contact Abbreviations
    {
      regex: /^(c_fname|first_nm|cust_fn|f_name)$/i,
      domain: 'identity.first_name',
      description: 'Customer or user first name abbreviation',
      suggestedGenerator: 'identity.first_name',
      confidence: 0.92
    },
    {
      regex: /^(c_lname|last_nm|cust_ln|l_name)$/i,
      domain: 'identity.last_name',
      description: 'Customer or user last name abbreviation',
      suggestedGenerator: 'identity.last_name',
      confidence: 0.92
    },
    {
      regex: /^(c_eml|usr_eml|cust_email|email_addr)$/i,
      domain: 'identity.email',
      description: 'Contact email address abbreviation',
      suggestedGenerator: 'identity.email',
      confidence: 0.95
    },
    {
      regex: /^(c_tel|contact_no|ph_num|mob_no|phone_no)$/i,
      domain: 'identity.phone',
      description: 'Telephone / mobile number abbreviation',
      suggestedGenerator: 'identity.phone',
      confidence: 0.95
    },
    {
      regex: /^(org_nm|comp_nm|client_nm|vendor_name)$/i,
      domain: 'ecommerce.company',
      description: 'Company / organization name abbreviation',
      suggestedGenerator: 'ecommerce.company',
      confidence: 0.92
    },
    {
      regex: /^(postal_cd|zip_cd|pin_cd|zipcode)$/i,
      domain: 'geo.postal_code',
      description: 'Postal / ZIP code abbreviation',
      suggestedGenerator: 'geo.postal_code',
      confidence: 0.95
    },
    {
      regex: /^(ip_orig|client_ip|src_ip|dst_ip|remote_ip)$/i,
      domain: 'geo.ipv4',
      description: 'Origin or client IPv4 address',
      suggestedGenerator: 'geo.ipv4',
      confidence: 0.96
    },
    {
      regex: /^(mac_addr|hw_addr|ether_addr)$/i,
      domain: 'geo.mac',
      description: 'Hardware MAC physical address',
      suggestedGenerator: 'geo.mac',
      confidence: 0.96
    },
    {
      regex: /^(lat_coord|latitude|geo_lat)$/i,
      domain: 'geo.latitude',
      description: 'Geographic latitude coordinate',
      suggestedGenerator: 'geo.latitude',
      confidence: 0.95
    },
    {
      regex: /^(long_coord|longitude|geo_lng|geo_lon)$/i,
      domain: 'geo.longitude',
      description: 'Geographic longitude coordinate',
      suggestedGenerator: 'geo.longitude',
      confidence: 0.95
    }
  ];

  /**
   * Evaluates a single column against local semantic rules
   */
  static inferColumn(col: ColumnDefinition, table: TableDefinition): SemanticColumnProfile | null {
    const colName = col.name.trim();

    for (const rule of this.RULES) {
      if (rule.regex.test(colName)) {
        return {
          tableName: table.name,
          columnName: col.name,
          inferredDomain: rule.domain,
          description: rule.description,
          suggestedGenerator: rule.suggestedGenerator,
          enumOptions: rule.enumOptions,
          range: rule.range,
          confidence: rule.confidence
        };
      }
    }

    return null;
  }

  /**
   * Infers semantic profiles for all columns in a table using local heuristics
   */
  static inferTable(table: TableDefinition): Record<string, SemanticColumnProfile> {
    const profiles: Record<string, SemanticColumnProfile> = {};

    for (const col of table.columns) {
      // Primary keys and explicit foreign keys already have structural generators
      if (col.isPrimaryKey || col.foreignKey) continue;

      const profile = this.inferColumn(col, table);
      if (profile) {
        profiles[col.name.toLowerCase()] = profile;
      }
    }

    return profiles;
  }
}
