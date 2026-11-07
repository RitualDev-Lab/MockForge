import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  parseSchema,
  synthesizeMockData,
  exportDataset,
  DatabaseMasker
} from '../index.js';

export interface CsvAnonymizeResult {
  anonymizedCsv: string;
  rowsProcessed: number;
  columnsMasked: Array<{
    column: string;
    strategy: string;
    count: number;
  }>;
  compliance: {
    hipaaCompliant: boolean;
    gdprCompliant: boolean;
    pciDssCompliant: boolean;
    soc2Compliant: boolean;
  };
}

/**
 * Anonymizes CSV data by inferring PII strategies per column header and preserving relational formatting
 */
export function anonymizeCsvData(
  csvData: string,
  tableName: string = 'records',
  options?: { salt?: string; seed?: number }
): CsvAnonymizeResult {
  const lines = csvData
    .trim()
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return {
      anonymizedCsv: '',
      rowsProcessed: 0,
      columnsMasked: [],
      compliance: {
        hipaaCompliant: true,
        gdprCompliant: true,
        pciDssCompliant: true,
        soc2Compliant: true
      }
    };
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rawRows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, any> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rawRows.push(row);
  }

  const masker = new DatabaseMasker({
    salt: options?.salt,
    seed: options?.seed ?? 42
  });

  const maskingResult = masker.maskDataset({ [tableName]: rawRows });
  const maskedRows = maskingResult.data[tableName] || [];

  const csvOutputLines: string[] = [headers.join(',')];
  for (const row of maskedRows) {
    const formatted = headers.map(h => {
      const val = row[h] ?? '';
      const str = String(val);
      return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
    });
    csvOutputLines.push(formatted.join(','));
  }

  return {
    anonymizedCsv: csvOutputLines.join('\n'),
    rowsProcessed: rawRows.length,
    columnsMasked: maskingResult.auditReport.columnsMasked.map(c => ({
      column: c.column,
      strategy: c.strategy,
      count: c.count
    })),
    compliance: maskingResult.auditReport.compliance
  };
}

/**
 * Factory for MockForge Model Context Protocol (MCP) server
 */
export function createMockForgeMcpServer(): McpServer {
  const server = new McpServer({
    name: 'io.github.RitualDev-Lab/mockforge',
    version: '0.1.1'
  });

  // Tool 1: mockforge_synthesize_fixtures
  server.tool(
    'mockforge_synthesize_fixtures',
    'Synthesize relational, foreign-key-consistent database mock fixtures from SQL DDL or Prisma schemas using Kahn topological DAG resolution. Generates realistic names, emails, timestamps, UUIDs, and foreign key relations.',
    {
      schema: z
        .string()
        .describe('SQL DDL (CREATE TABLE statements) or Prisma schema text.'),
      format: z
        .enum(['sql', 'prisma'])
        .optional()
        .describe('Optional schema syntax format. If omitted, automatically detected.'),
      outputFormat: z
        .enum(['json', 'sql', 'csv'])
        .optional()
        .describe('Output data serialization format. Default: "json"'),
      rowsPerTable: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe('Number of mock rows to generate per table. Default: 10'),
      seed: z
        .number()
        .optional()
        .describe('PRNG seed for reproducible deterministic fixture synthesis. Default: 42')
    },
    async ({ schema, format, outputFormat, rowsPerTable, seed }) => {
      try {
        const parsedSchema = parseSchema(schema, format);
        const rows = rowsPerTable ?? 10;
        const dataset = synthesizeMockData(parsedSchema, {
          defaultRowCount: rows,
          seed: seed ?? 42
        });

        const chosenFormat = outputFormat || 'json';

        if (chosenFormat === 'sql') {
          const exportBundle = exportDataset(dataset, parsedSchema, {
            format: 'postgres'
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'SUCCESS',
                    outputFormat: 'sql',
                    totalTables: parsedSchema.tables.length,
                    totalRows: dataset.totalRows,
                    generationDurationMs: dataset.durationMs,
                    topologicalOrder: dataset.executionOrder,
                    sqlFixtures: exportBundle.primaryFile.content
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        if (chosenFormat === 'csv') {
          const exportBundle = exportDataset(dataset, parsedSchema, { format: 'csv' });
          const csvFiles = exportBundle.files.map(f => ({
            table: f.filename.replace('.csv', ''),
            content: f.content
          }));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'SUCCESS',
                    outputFormat: 'csv',
                    totalTables: parsedSchema.tables.length,
                    totalRows: dataset.totalRows,
                    generationDurationMs: dataset.durationMs,
                    csvFiles
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        // Default JSON
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  outputFormat: 'json',
                  totalTables: parsedSchema.tables.length,
                  totalRows: dataset.totalRows,
                  generationDurationMs: dataset.durationMs,
                  topologicalOrder: dataset.executionOrder,
                  tables: dataset.tables
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'ERROR',
                message: err.message || String(err)
              })
            }
          ]
        };
      }
    }
  );

  // Tool 2: mockforge_seed_schema
  server.tool(
    'mockforge_seed_schema',
    'Generate complete, executable database seed scripts (INSERT statements) with topologically ordered foreign keys for PostgreSQL, MySQL, SQLite, or Prisma.',
    {
      schema: z
        .string()
        .describe('SQL DDL or Prisma schema definition.'),
      dialect: z
        .enum(['postgres', 'mysql', 'sqlite', 'prisma'])
        .optional()
        .describe('Target database dialect for INSERT syntax. Default: "postgres"'),
      rowsPerTable: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe('Number of seed rows per table. Default: 5'),
      seed: z
        .number()
        .optional()
        .describe('PRNG seed for reproducible deterministic fixture synthesis. Default: 42')
    },
    async ({ schema, dialect, rowsPerTable, seed }) => {
      try {
        const parsedSchema = parseSchema(schema);
        const rows = rowsPerTable ?? 5;
        const dataset = synthesizeMockData(parsedSchema, {
          defaultRowCount: rows,
          seed: seed ?? 42
        });

        const targetDialect = dialect || 'postgres';
        const bundle = exportDataset(dataset, parsedSchema, {
          format: targetDialect as any
        });

        const tableSummary: Record<string, number> = {};
        for (const [table, items] of Object.entries(dataset.tables)) {
          tableSummary[table] = items.length;
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  dialect: targetDialect,
                  totalTables: parsedSchema.tables.length,
                  totalRows: dataset.totalRows,
                  topologicalOrder: dataset.executionOrder,
                  tableSummary,
                  seedScript: bundle.primaryFile.content
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'ERROR',
                message: err.message || String(err)
              })
            }
          ]
        };
      }
    }
  );

  // Tool 3: mockforge_anonymize_csv
  server.tool(
    'mockforge_anonymize_csv',
    'Pseudonymize and mask sensitive customer data (PII, emails, names, SSNs, credit cards, phones) in CSV or tabular data with GDPR, HIPAA, and PCI-DSS compliance audits.',
    {
      data: z
        .string()
        .describe('Raw CSV text containing rows with sensitive data to anonymize.'),
      tableName: z
        .string()
        .optional()
        .describe('Optional table or dataset name. Default: "records"'),
      salt: z
        .string()
        .optional()
        .describe('Optional cryptographic salt for consistent pseudonymization.'),
      seed: z
        .number()
        .optional()
        .describe('Optional PRNG seed for deterministic generation.')
    },
    async ({ data, tableName, salt, seed }) => {
      try {
        const result = anonymizeCsvData(data, tableName || 'records', { salt, seed });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  rowsProcessed: result.rowsProcessed,
                  columnsMasked: result.columnsMasked,
                  compliance: result.compliance,
                  anonymizedCsv: result.anonymizedCsv
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'ERROR',
                message: err.message || String(err)
              })
            }
          ]
        };
      }
    }
  );

  return server;
}

/**
 * Runs the MockForge MCP server on standard I/O for direct use in Cursor, Claude Desktop, Antigravity, etc.
 */
export async function runMockForgeMcpServer(): Promise<void> {
  const server = createMockForgeMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🔨 [MockForge] Relational Mock DB & Fixture Synthesis MCP Server active on stdio');
}
