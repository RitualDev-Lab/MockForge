import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { GeminiInferenceClient } from '../src/inference/gemini-client.js';
import { SchemaSemanticResolver } from '../src/inference/resolver.js';
import { SchemaSemanticCache } from '../src/inference/cache.js';

describe('Gemini 1.5 Flash AI Inference Engine Tests', () => {
  const sampleSql = `
    CREATE TABLE subscriptions (
      id UUID PRIMARY KEY,
      cust_id UUID NOT NULL,
      usr_tier VARCHAR(20) NOT NULL,
      mrr_val INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `;

  test('Enforces Strict Zero-Plaintext Rule on payload metadata', () => {
    const schema = SqlDdlParser.parse(sampleSql, 'postgres');
    const payload = GeminiInferenceClient.buildZeroPlaintextPayload(schema);

    assert.equal(payload.length, 1);
    assert.equal(payload[0].table, 'subscriptions');
    assert.equal(payload[0].columns.length, 5);

    // Verify absolutely NO row data or external values are attached
    for (const col of payload[0].columns) {
      assert.ok('name' in col);
      assert.ok('type' in col);
      assert.ok('isPk' in col);
      assert.ok('isFk' in col);
      assert.equal(Object.keys(col).length, 4, 'Column metadata must strictly contain only name, type, isPk, isFk');
    }
  });

  test('Correctly parses structured JSON response from Gemini 1.5 Flash', () => {
    const mockGeminiJson = JSON.stringify({
      profiles: [
        {
          tableName: 'subscriptions',
          columnName: 'usr_tier',
          inferredDomain: 'enum',
          description: 'SaaS user tier classification',
          enumOptions: ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'],
          confidence: 0.98
        },
        {
          tableName: 'subscriptions',
          columnName: 'mrr_val',
          inferredDomain: 'numeric_range',
          description: 'Monthly recurring revenue in USD',
          range: { min: 29, max: 2999, precision: 0 },
          confidence: 0.94
        }
      ]
    });

    const parsed = GeminiInferenceClient.parseGeminiResponse(mockGeminiJson);

    assert.ok(parsed['subscriptions']);
    assert.equal(parsed['subscriptions']['usr_tier'].inferredDomain, 'enum');
    assert.deepEqual(parsed['subscriptions']['usr_tier'].enumOptions, ['FREE', 'PRO', 'TEAM', 'ENTERPRISE']);
    assert.equal(parsed['subscriptions']['mrr_val'].range?.min, 29);
    assert.equal(parsed['subscriptions']['mrr_val'].range?.max, 2999);
  });

  test('SchemaSemanticResolver uses Gemini API with mock fetch and caches result', async () => {
    SchemaSemanticCache.clear();
    const schema = SqlDdlParser.parse(sampleSql, 'postgres');

    const mockFetch: typeof fetch = async (url, init) => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      profiles: [
                        {
                          tableName: 'subscriptions',
                          columnName: 'usr_tier',
                          inferredDomain: 'enum',
                          description: 'User pricing tier',
                          enumOptions: ['FREE', 'PRO', 'ENTERPRISE']
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        })
      } as any;
    };

    const resolver = new SchemaSemanticResolver(schema, {
      apiKey: 'test-gemini-key',
      fetchFn: mockFetch
    });

    // 1st Call: Runs Gemini API
    const result1 = await resolver.resolve();
    assert.equal(result1.source, 'gemini-1.5-flash');
    assert.equal(result1.cached, false);
    assert.ok(result1.profiles['subscriptions']['usr_tier']);

    // 2nd Call: Hits Cache ($0 latency, 0 API calls)
    const resolver2 = new SchemaSemanticResolver(schema, {
      apiKey: 'test-gemini-key',
      fetchFn: mockFetch
    });
    const result2 = await resolver2.resolve();
    assert.equal(result2.source, 'cache');
    assert.equal(result2.cached, true);
    assert.equal(result2.schemaHash, result1.schemaHash);
  });

  test('Gracefully falls back to local heuristics if Gemini API returns 500 error', async () => {
    SchemaSemanticCache.clear();
    const schema = SqlDdlParser.parse(sampleSql, 'postgres');

    const failingFetch: typeof fetch = async () => {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Quota exceeded or server error'
      } as any;
    };

    const resolver = new SchemaSemanticResolver(schema, {
      apiKey: 'test-gemini-key',
      fetchFn: failingFetch,
      cache: false
    });

    const result = await resolver.resolve();
    // Must gracefully succeed via local heuristics instead of crashing
    assert.equal(result.source, 'local-heuristics');
    assert.ok(result.profiles['subscriptions']);
  });
});
