import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { MockForgeCli } from '../src/cli/index.js';

describe('MockForge CLI Tooling Tests', () => {
  const tempSchemaPath = resolve(tmpdir(), `mockforge_test_schema_${Date.now()}.sql`);
  const tempOutPath = resolve(tmpdir(), `mockforge_test_out_${Date.now()}.sql`);
  const tempInferPath = resolve(tmpdir(), `mockforge_test_infer_${Date.now()}.json`);

  const sampleSql = `
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      c_tel VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `;

  test('Runs version and help flags cleanly', async () => {
    const codeVer = await MockForgeCli.run(['node', 'mockforge', '--version']);
    assert.equal(codeVer, 0);

    const codeHelp = await MockForgeCli.run(['node', 'mockforge', '--help']);
    assert.equal(codeHelp, 0);
  });

  test('Generates relational SQL file via CLI command', async () => {
    writeFileSync(tempSchemaPath, sampleSql, 'utf-8');

    const exitCode = await MockForgeCli.run([
      'node',
      'mockforge',
      'generate',
      '--schema',
      tempSchemaPath,
      '--format',
      'postgres',
      '--out',
      tempOutPath,
      '--rows',
      '15',
      '--seed',
      '100'
    ]);

    assert.equal(exitCode, 0);
    assert.ok(existsSync(tempOutPath));

    const content = readFileSync(tempOutPath, 'utf-8');
    assert.ok(content.includes('BEGIN;'));
    assert.ok(content.includes('INSERT INTO "users"'));
    assert.ok(content.includes('COMMIT;'));

    // Cleanup
    if (existsSync(tempOutPath)) unlinkSync(tempOutPath);
  });

  test('Executes semantic schema inference via CLI command', async () => {
    const exitCode = await MockForgeCli.run([
      'node',
      'mockforge',
      'infer',
      '--schema',
      tempSchemaPath,
      '--out',
      tempInferPath
    ]);

    assert.equal(exitCode, 0);
    assert.ok(existsSync(tempInferPath));

    const content = readFileSync(tempInferPath, 'utf-8');
    const parsed = JSON.parse(content);
    assert.ok(parsed.profiles);
    assert.ok(parsed.profiles.users);
    assert.equal(parsed.profiles.users.c_tel.suggestedGenerator, 'identity.phone');

    // Cleanup
    if (existsSync(tempInferPath)) unlinkSync(tempInferPath);
  });

  test('Executes SQL query against mock database via CLI command', async () => {
    const exitCode = await MockForgeCli.run([
      'node',
      'mockforge',
      'query',
      '--schema',
      tempSchemaPath,
      '--sql',
      'SELECT id, email, full_name FROM users LIMIT 3'
    ]);

    assert.equal(exitCode, 0);

    // Final cleanup of schema file
    if (existsSync(tempSchemaPath)) unlinkSync(tempSchemaPath);
  });
});
