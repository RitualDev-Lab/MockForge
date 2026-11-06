import type { DatabaseSchema } from '../types/schema.js';

export type InferredDomainType =
  | 'identity.name'
  | 'identity.first_name'
  | 'identity.last_name'
  | 'identity.email'
  | 'identity.phone'
  | 'identity.avatar'
  | 'identity.ssn'
  | 'finance.credit_card'
  | 'finance.cvv'
  | 'finance.currency'
  | 'finance.amount'
  | 'finance.tax_rate'
  | 'finance.stripe_customer_id'
  | 'finance.stripe_payment_id'
  | 'finance.iban'
  | 'ecommerce.product'
  | 'ecommerce.sku'
  | 'ecommerce.order_number'
  | 'ecommerce.company'
  | 'ecommerce.job_title'
  | 'ecommerce.department'
  | 'geo.address'
  | 'geo.city'
  | 'geo.state'
  | 'geo.country'
  | 'geo.postal_code'
  | 'geo.latitude'
  | 'geo.longitude'
  | 'geo.ipv4'
  | 'geo.ipv6'
  | 'geo.mac'
  | 'temporal.created_at'
  | 'temporal.updated_at'
  | 'temporal.birth_date'
  | 'enum'
  | 'numeric_range'
  | 'custom_pattern'
  | 'generic';

export interface SemanticColumnProfile {
  tableName: string;
  columnName: string;
  inferredDomain: InferredDomainType;
  description: string;
  suggestedGenerator?: string;
  enumOptions?: string[];
  range?: {
    min: number;
    max: number;
    precision?: number;
  };
  pattern?: string;
  confidence: number; // 0.0 to 1.0
}

export type TableSemanticProfiles = Record<string, SemanticColumnProfile>; // columnName (lowercase) -> profile
export type SchemaSemanticProfiles = Record<string, TableSemanticProfiles>; // tableName (lowercase) -> TableSemanticProfiles

export interface SchemaInferenceResult {
  profiles: SchemaSemanticProfiles;
  source: 'gemini-1.5-flash' | 'local-heuristics' | 'cache';
  cached: boolean;
  model?: string;
  schemaHash: string;
  inferredColumnsCount: number;
  durationMs: number;
}

export interface InferenceOptions {
  apiKey?: string; // Gemini API Key (optional - falls back to local heuristics if absent)
  model?: string; // default: 'gemini-1.5-flash'
  forceLocal?: boolean; // bypass Gemini API call and use local heuristics engine directly
  cache?: boolean; // default: true
  fetchFn?: typeof fetch; // injectable fetch for tests or proxy environments
}
