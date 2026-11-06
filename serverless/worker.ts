import {
  parseSchema,
  synthesizeMockData,
  exportDataset,
  DatabaseMasker,
  OrmMigrationSynchronizer,
  type ExportFormat
} from '../src/index.js';

export interface Env {
  API_SECRET_KEY?: string;
  ENVIRONMENT?: string;
}

/**
 * api.mockforge.io — Serverless Edge API for Headless Relational Seed Generation & Masking
 *
 * Runs on Cloudflare Workers (100,000 requests/day at $0/month)
 * Sub-5ms execution time, zero external cloud database dependencies.
 */
export default {
  async fetch(request: Request, env: Env = {}, _ctx: any = {}): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // 2. Health & Service Metadata
    if (pathname === '/health' || pathname === '/v1/health') {
      return jsonResponse({
        status: 'ok',
        service: 'api.mockforge.io',
        version: '0.1.0',
        runtime: 'cloudflare-workers-edge',
        timestamp: new Date().toISOString(),
        cost: '$0.00/month',
        capabilities: [
          'headless_relational_synthesis',
          'production_database_masking',
          'orm_migration_synchronization',
          'dynamic_openapi_spec'
        ],
        supportedFormats: [
          'json',
          'postgres',
          'postgres-copy',
          'mysql',
          'sqlite',
          'prisma',
          'drizzle',
          'csv'
        ]
      });
    }

    // 3. Optional API Key Authentication
    if (env.API_SECRET_KEY) {
      const authHeader = request.headers.get('Authorization') || '';
      const apiKeyHeader = request.headers.get('X-API-Key') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '') || apiKeyHeader;
      if (!token || token !== env.API_SECRET_KEY) {
        return jsonResponse({ error: 'Unauthorized: Invalid or missing API key' }, 401);
      }
    }

    // 4. Endpoint: POST /v1/generate (Headless Relational Seed Synthesizer)
    if (method === 'POST' && (pathname === '/v1/generate' || pathname === '/generate')) {
      try {
        const body: any = await request.json();
        const schemaText = body.schema;

        if (!schemaText || typeof schemaText !== 'string' || schemaText.trim().length === 0) {
          return jsonResponse({ error: "Missing or invalid 'schema' string in request body" }, 400);
        }

        const format: ExportFormat = (body.format?.toLowerCase() || 'json') as ExportFormat;
        const rowCount = typeof body.rows === 'number' ? body.rows : 20;
        const seed = typeof body.seed === 'number' ? body.seed : 42;

        const startTime = performance.now();

        // 1. Parse SQL or Prisma schema
        const schema = parseSchema(schemaText);

        // 2. Synthesize relational dataset
        const dataset = synthesizeMockData(schema, {
          defaultRowCount: rowCount,
          seed
        });

        const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

        // If JSON format requested, return directly
        if (format === 'json') {
          return jsonResponse({
            success: true,
            format: 'json',
            totalRows: dataset.totalRows,
            tables: Object.keys(dataset.tables),
            executionOrder: dataset.executionOrder,
            seed: dataset.seed,
            durationMs,
            data: dataset.tables
          });
        }

        // Otherwise format with multi-format exporter
        const exported = exportDataset(dataset, schema, { format });

        return jsonResponse({
          success: true,
          format,
          totalRows: dataset.totalRows,
          tables: Object.keys(dataset.tables),
          executionOrder: dataset.executionOrder,
          filename: exported.primaryFile.filename,
          mimeType: exported.primaryFile.mimeType,
          sizeBytes: exported.totalBytes,
          durationMs,
          content: exported.primaryFile.content
        });
      } catch (err: any) {
        return jsonResponse({ error: `Synthesis failed: ${err.message}` }, 400);
      }
    }

    // 5. Endpoint: POST /v1/mask (Production Database Masking & Anonymization)
    if (method === 'POST' && (pathname === '/v1/mask' || pathname === '/mask')) {
      try {
        const body: any = await request.json();
        const seed = typeof body.seed === 'number' ? body.seed : 42;
        const salt = body.salt || 'api-mockforge-enterprise-salt';

        const masker = new DatabaseMasker({ seed, salt });

        // Case A: Raw SQL Dump string
        if (typeof body.sqlDump === 'string') {
          const { maskedSql, auditReport } = masker.maskSqlDump(body.sqlDump);
          return jsonResponse({
            success: true,
            type: 'sql_dump',
            maskedSql,
            auditReport
          });
        }

        // Case B: In-Memory Relational Dataset (JSON Record of arrays)
        if (body.dataset && typeof body.dataset === 'object') {
          const result = masker.maskDataset(body.dataset);
          return jsonResponse({
            success: true,
            type: 'dataset',
            data: result.data,
            auditReport: result.auditReport
          });
        }

        return jsonResponse({ error: "Missing 'dataset' object or 'sqlDump' string in payload" }, 400);
      } catch (err: any) {
        return jsonResponse({ error: `Masking failed: ${err.message}` }, 400);
      }
    }

    // 6. Endpoint: POST /v1/diff (Bidirectional ORM Diff & Migration Fixture)
    if (method === 'POST' && (pathname === '/v1/diff' || pathname === '/diff')) {
      try {
        const body: any = await request.json();
        if (!body.previousSchema || !body.currentSchema) {
          return jsonResponse({ error: "Both 'previousSchema' and 'currentSchema' are required" }, 400);
        }

        const prev = parseSchema(body.previousSchema);
        const curr = parseSchema(body.currentSchema);

        const diff = OrmMigrationSynchronizer.diffSchemas(prev, curr);
        const orm = body.orm || 'prisma';
        const fixture = OrmMigrationSynchronizer.generateFixture(curr, {
          orm,
          rowsPerTable: body.rows || 10,
          seed: body.seed || 42
        });

        return jsonResponse({
          success: true,
          diff,
          fixture
        });
      } catch (err: any) {
        return jsonResponse({ error: `Diff generation failed: ${err.message}` }, 400);
      }
    }

    return jsonResponse({ error: `Route not found: ${method} ${pathname}` }, 404);
  }
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
