import type { DatabaseSchema, TableDefinition } from '../types/schema.js';
import type { SemanticColumnProfile, SchemaSemanticProfiles, InferenceOptions } from './types.js';

export class GeminiInferenceClient {
  private static readonly GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  /**
   * Infers semantic column profiles across a DatabaseSchema using Gemini 1.5 Flash ($0 Free Tier)
   */
  static async inferSchema(
    schema: DatabaseSchema,
    options: InferenceOptions
  ): Promise<SchemaSemanticProfiles> {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new Error('Gemini API key is required for GeminiInferenceClient');
    }

    const model = options.model || 'gemini-1.5-flash';
    const fetchFn = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);

    if (!fetchFn) {
      throw new Error('Global fetch API is not available in current runtime environment');
    }

    // Prepare metadata-only schema representation
    const sanitizedSchemaSummary = this.buildZeroPlaintextPayload(schema);

    const systemPrompt = `You are MockForge AI, an expert relational database reverse-engineer.
Analyze the following SQL database schema structure (table names, column names, data types, and keys).
For each column—especially cryptic, abbreviated, or industry-specific column names (e.g. tx_st_cd, mrr_cents, kyc_status, usr_tier)—infer its real-world semantic purpose, data format, and appropriate mock generation strategy.

Respond STRICTLY in JSON format conforming to this JSON schema:
{
  "profiles": [
    {
      "tableName": "string",
      "columnName": "string",
      "inferredDomain": "string (one of: 'identity.name', 'identity.email', 'identity.phone', 'finance.credit_card', 'finance.currency', 'finance.amount', 'ecommerce.product', 'ecommerce.sku', 'ecommerce.order_number', 'ecommerce.company', 'geo.address', 'geo.city', 'geo.ipv4', 'enum', 'numeric_range', 'generic')",
      "description": "brief explanation",
      "suggestedGenerator": "optional dot-notation generator name",
      "enumOptions": ["optional", "array", "of", "string", "values", "for", "enums"],
      "range": { "min": 0, "max": 100, "precision": 0 },
      "confidence": 0.95
    }
  ]
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            { text: `DATABASE SCHEMA METADATA:\n${JSON.stringify(sanitizedSchemaSummary, null, 2)}` }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1
      }
    };

    const url = `${this.GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status} ${response.statusText}): ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      throw new Error('Gemini API returned an empty or invalid response structure');
    }

    return this.parseGeminiResponse(rawContent);
  }

  /**
   * Enforces the Strict Zero-Plaintext Rule:
   * Strips all non-metadata fields. Absolutely NO database row data or user content can ever be included.
   */
  static buildZeroPlaintextPayload(schema: DatabaseSchema): Array<{
    table: string;
    columns: Array<{ name: string; type: string; isPk: boolean; isFk: boolean }>;
  }> {
    return schema.tables.map((table) => ({
      table: table.name,
      columns: table.columns.map((c) => ({
        name: c.name,
        type: c.rawType,
        isPk: !!c.isPrimaryKey,
        isFk: !!c.foreignKey
      }))
    }));
  }

  /**
   * Parses the structured JSON returned by Gemini into SchemaSemanticProfiles
   */
  static parseGeminiResponse(jsonText: string): SchemaSemanticProfiles {
    const parsed = JSON.parse(jsonText);
    const profilesList: SemanticColumnProfile[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.profiles)
      ? parsed.profiles
      : [];

    const result: SchemaSemanticProfiles = {};

    for (const item of profilesList) {
      if (!item.tableName || !item.columnName) continue;
      const tableKey = item.tableName.toLowerCase();
      const colKey = item.columnName.toLowerCase();

      if (!result[tableKey]) {
        result[tableKey] = {};
      }

      result[tableKey][colKey] = {
        tableName: item.tableName,
        columnName: item.columnName,
        inferredDomain: item.inferredDomain || 'generic',
        description: item.description || '',
        suggestedGenerator: item.suggestedGenerator,
        enumOptions: Array.isArray(item.enumOptions) ? item.enumOptions : undefined,
        range: item.range && typeof item.range.min === 'number' && typeof item.range.max === 'number' ? item.range : undefined,
        pattern: item.pattern,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.85
      };
    }

    return result;
  }
}
