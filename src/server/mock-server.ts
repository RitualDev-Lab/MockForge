import http from 'node:http';
import type { DatabaseSchema } from '../types/schema.js';
import type { RelationalDataset } from '../generator/engine.js';
import { InMemoryMockDatabase } from '../wasm/memory-db.js';

export interface MockServerOptions {
  port?: number;
  schema?: DatabaseSchema;
  dataset?: RelationalDataset;
  prefix?: string;
  enableOpenApi?: boolean;
}

/**
 * Ephemeral In-Memory REST API Server for CI/CD Test Runners & Microservices
 * Zero cloud dependencies, sub-millisecond response times, full CRUD + relational sub-resources.
 */
export class EphemeralMockServer {
  private server: http.Server | null = null;
  private dataset: Record<string, any[]>;
  private schema?: DatabaseSchema;
  private prefix: string;
  private port = 0;
  private baseUrl = '';
  private memoryDb: InMemoryMockDatabase;
  private enableOpenApi: boolean;

  constructor(options: MockServerOptions) {
    this.schema = options.schema;
    this.prefix = (options.prefix ?? '/api').replace(/\/+$/, '');
    this.enableOpenApi = options.enableOpenApi ?? true;

    // Initialize dataset copy so mutations are isolated
    this.dataset = {};
    const rawTables = (options.dataset as any)?.tables || options.dataset;
    if (rawTables) {
      for (const [table, rows] of Object.entries(rawTables)) {
        if (Array.isArray(rows)) {
          this.dataset[table] = JSON.parse(JSON.stringify(rows));
        }
      }
    }

    this.memoryDb = new InMemoryMockDatabase(this.schema || { dialect: 'postgres', tables: [], enums: {} });
    if (this.dataset && Object.keys(this.dataset).length > 0) {
      this.memoryDb.loadDataset({
        tables: this.dataset,
        totalRows: Object.values(this.dataset).reduce((acc, r) => acc + (r?.length || 0), 0),
        executionOrder: Object.keys(this.dataset),
        durationMs: 0,
        seed: 0
      });
    }
  }

  /**
   * Starts HTTP mock server on specified or ephemeral port
   */
  public async start(port = 0): Promise<{ port: number; url: string }> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(port, () => {
        const addr = this.server?.address();
        if (typeof addr === 'object' && addr !== null) {
          this.port = addr.port;
          this.baseUrl = `http://127.0.0.1:${this.port}`;
          resolve({ port: this.port, url: this.baseUrl });
        } else {
          reject(new Error('Failed to obtain server address'));
        }
      });
    });
  }

  /**
   * Stops HTTP server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        this.server = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public getUrl(): string {
    return this.baseUrl;
  }

  public getPort(): number {
    return this.port;
  }

  public getDataset(): Record<string, any[]> {
    return this.dataset;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, 'http://127.0.0.1');
    const pathname = parsed.pathname;
    const method = (req.method || 'GET').toUpperCase();

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (pathname === '/health' || pathname === `${this.prefix}/health`) {
      const stats: Record<string, number> = {};
      for (const [tbl, rows] of Object.entries(this.dataset)) {
        stats[tbl] = rows.length;
      }
      this.sendJson(res, 200, {
        status: 'ok',
        uptime: process.uptime(),
        tables: Object.keys(this.dataset),
        recordsCount: stats
      });
      return;
    }

    // Dynamic OpenAPI 3.0 specification
    if (this.enableOpenApi && (pathname === '/openapi.json' || pathname === `${this.prefix}/openapi.json`)) {
      this.sendJson(res, 200, this.generateOpenApiSpec());
      return;
    }

    // Route matching for /api/:table, /api/:table/:id, /api/:parent/:parentId/:child
    if (!pathname.startsWith(this.prefix)) {
      this.sendJson(res, 404, { error: 'Route not found' });
      return;
    }

    const subPath = pathname.slice(this.prefix.length).replace(/^\/+/, '');
    const segments = subPath.split('/').filter(Boolean);

    if (segments.length === 0) {
      this.sendJson(res, 200, { message: 'MockForge In-Memory REST API', tables: Object.keys(this.dataset) });
      return;
    }

    const [table, id, childTable] = segments;

    // Check if table exists
    const rows = this.dataset[table];
    if (!rows && !this.dataset[table.toLowerCase()]) {
      this.sendJson(res, 404, { error: `Table '${table}' not found in mock database` });
      return;
    }
    const resolvedTable = rows ? table : table.toLowerCase();
    const tableData = this.dataset[resolvedTable];

    // Case 1: Relational Child Resource /api/:parentTable/:parentId/:childTable
    if (segments.length === 3 && childTable) {
      const childData = this.dataset[childTable] || this.dataset[childTable.toLowerCase()];
      if (!childData) {
        this.sendJson(res, 404, { error: `Child table '${childTable}' not found` });
        return;
      }
      // Look for fk column like user_id, order_id, etc.
      const singularParent = resolvedTable.replace(/s$/, '');
      const fkCandidate = `${singularParent}_id`;
      const matches = childData.filter((r) => String(r[fkCandidate]) === id || String(r[resolvedTable + '_id']) === id);
      this.sendJson(res, 200, matches);
      return;
    }

    // Case 2: Specific record /api/:table/:id
    if (segments.length === 2 && id) {
      if (method === 'GET') {
        const item = tableData.find((r) => String(r.id) === id || String(r[`${resolvedTable}_id`]) === id);
        if (!item) {
          this.sendJson(res, 404, { error: `Record with id '${id}' not found in '${resolvedTable}'` });
        } else {
          this.sendJson(res, 200, item);
        }
        return;
      }

      if (method === 'DELETE') {
        const idx = tableData.findIndex((r) => String(r.id) === id || String(r[`${resolvedTable}_id`]) === id);
        if (idx === -1) {
          this.sendJson(res, 404, { error: `Record with id '${id}' not found` });
        } else {
          const deleted = tableData.splice(idx, 1)[0];
          this.sendJson(res, 200, { success: true, deleted });
        }
        return;
      }

      if (method === 'PUT' || method === 'PATCH') {
        this.readBody(req, (err, body) => {
          if (err) {
            this.sendJson(res, 400, { error: 'Invalid JSON payload' });
            return;
          }
          const idx = tableData.findIndex((r) => String(r.id) === id || String(r[`${resolvedTable}_id`]) === id);
          if (idx === -1) {
            this.sendJson(res, 404, { error: `Record with id '${id}' not found` });
          } else {
            tableData[idx] = { ...tableData[idx], ...body, id: tableData[idx].id };
            this.sendJson(res, 200, tableData[idx]);
          }
        });
        return;
      }
    }

    // Case 3: Collection resource /api/:table
    if (segments.length === 1) {
      if (method === 'GET') {
        let results = [...tableData];

        // Filtering by query params
        for (const [key, value] of parsed.searchParams.entries()) {
          if (key === 'limit' || key === 'offset' || key === 'sort' || key === 'order') continue;
          results = results.filter((r) => String(r[key]).toLowerCase() === value.toLowerCase());
        }

        // Sorting
        const sortKey = parsed.searchParams.get('sort');
        const order = parsed.searchParams.get('order')?.toLowerCase() === 'desc' ? -1 : 1;
        if (sortKey) {
          results.sort((a, b) => {
            if (a[sortKey] > b[sortKey]) return 1 * order;
            if (a[sortKey] < b[sortKey]) return -1 * order;
            return 0;
          });
        }

        // Pagination
        const limit = parseInt(parsed.searchParams.get('limit') || '50', 10);
        const offset = parseInt(parsed.searchParams.get('offset') || '0', 10);
        const paginated = results.slice(offset, offset + limit);

        res.setHeader('X-Total-Count', String(results.length));
        this.sendJson(res, 200, paginated);
        return;
      }

      if (method === 'POST') {
        this.readBody(req, (err, body) => {
          if (err || !body || typeof body !== 'object') {
            this.sendJson(res, 400, { error: 'Invalid JSON body' });
            return;
          }
          // Assign id if missing
          const newRecord = {
            id: body.id ?? (tableData.length > 0 && typeof tableData[0]?.id === 'number' ? tableData.length + 1 : `gen_${Date.now()}`),
            ...body
          };
          tableData.push(newRecord);
          this.sendJson(res, 201, newRecord);
        });
        return;
      }
    }

    this.sendJson(res, 405, { error: `Method ${method} not allowed` });
  }

  private readBody(req: http.IncomingMessage, cb: (err: any, data: any) => void): void {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = body.trim() ? JSON.parse(body) : {};
        cb(null, parsed);
      } catch (e) {
        cb(e, null);
      }
    });
  }

  private sendJson(res: http.ServerResponse, code: number, data: any): void {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  private generateOpenApiSpec(): any {
    const paths: Record<string, any> = {};

    for (const table of Object.keys(this.dataset)) {
      paths[`${this.prefix}/${table}`] = {
        get: {
          summary: `List all ${table} records`,
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
            { name: 'sort', in: 'query', schema: { type: 'string' } },
            { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } }
          ],
          responses: {
            '200': { description: `Array of ${table} records` }
          }
        },
        post: {
          summary: `Create a new ${table} record`,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } }
          },
          responses: {
            '201': { description: `Created ${table} record` }
          }
        }
      };

      paths[`${this.prefix}/${table}/{id}`] = {
        get: {
          summary: `Get ${table} record by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Record found' }, '404': { description: 'Not found' } }
        },
        put: {
          summary: `Update ${table} record by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Updated' } }
        },
        delete: {
          summary: `Delete ${table} record by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Deleted' } }
        }
      };
    }

    return {
      openapi: '3.0.0',
      info: {
        title: 'MockForge Ephemeral In-Memory REST API',
        version: '0.1.0',
        description: 'Auto-generated zero-dependency mock REST endpoints for CI/CD test runners'
      },
      paths
    };
  }
}
