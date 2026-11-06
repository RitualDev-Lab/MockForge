import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { inferSchemaSemantics, synthesizeMockData } from '../src/index.js';

describe('Semantic AI Synthesis End-to-End Integration Tests', () => {
  const fintechSql = `
    CREATE TABLE accounts (
      id UUID PRIMARY KEY,
      org_nm VARCHAR(150) NOT NULL,
      acct_tier VARCHAR(30) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE account_users (
      id UUID PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id),
      c_fname VARCHAR(100) NOT NULL,
      c_lname VARCHAR(100) NOT NULL,
      c_eml VARCHAR(150) NOT NULL,
      c_tel VARCHAR(50) NOT NULL,
      kyc_st VARCHAR(30) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE payments (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES account_users(id),
      tx_st_cd VARCHAR(25) NOT NULL,
      pay_mthd VARCHAR(30) NOT NULL,
      mrr_cents INT NOT NULL,
      ip_orig VARCHAR(45) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `;

  test('Synthesizes semantically coherent records for cryptic columns via inferSchemaSemantics', async () => {
    const schema = SqlDdlParser.parse(fintechSql, 'postgres');

    // Run semantic inference (local fallback mode without API key)
    const inferenceResult = await inferSchemaSemantics(schema, { forceLocal: true });
    assert.equal(inferenceResult.source, 'local-heuristics');
    assert.ok(inferenceResult.inferredColumnsCount >= 8);

    // Synthesize mock relational dataset powered by inferred profiles
    const dataset = synthesizeMockData(schema, {
      seed: 777,
      semanticProfiles: inferenceResult,
      rowCounts: {
        accounts: 10,
        account_users: 25,
        payments: 50
      }
    });

    assert.equal(dataset.tables['accounts'].length, 10);
    assert.equal(dataset.tables['account_users'].length, 25);
    assert.equal(dataset.tables['payments'].length, 50);

    // 1. Verify accounts table semantic realism
    const validTiers = new Set(['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']);
    for (const acc of dataset.tables['accounts']) {
      assert.ok(
        validTiers.has(acc.acct_tier),
        `acct_tier (${acc.acct_tier}) must be a valid SaaS tier, not a generic string`
      );
      assert.ok(acc.org_nm.length > 2, 'org_nm must be a realistic company name');
      assert.ok(!acc.org_nm.startsWith('org_nm_'), 'org_nm must not be a dummy column placeholder');
    }

    // 2. Verify account_users table semantic realism
    const validKycStates = new Set(['PENDING', 'DOCS_SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED']);
    for (const usr of dataset.tables['account_users']) {
      assert.ok(
        validKycStates.has(usr.kyc_st),
        `kyc_st (${usr.kyc_st}) must be a valid KYC state`
      );
      assert.ok(usr.c_eml.includes('@'), `c_eml (${usr.c_eml}) must be a valid email`);
      assert.ok(!usr.c_fname.startsWith('c_fname_'), 'c_fname must be a real first name');
      assert.ok(!usr.c_lname.startsWith('c_lname_'), 'c_lname must be a real last name');
      assert.match(usr.c_tel, /^[+\d\s().-]+$/, 'c_tel must be a phone number format');
    }

    // 3. Verify payments table semantic realism
    const validTxStates = new Set(['INIT', 'PENDING', 'AUTH', 'CAPTURED', 'SETTLED', 'FAILED', 'REFUNDED']);
    const validPayMethods = new Set(['CREDIT_CARD', 'DEBIT_CARD', 'ACH', 'WIRE', 'PAYPAL', 'APPLE_PAY']);
    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

    for (const pmt of dataset.tables['payments']) {
      assert.ok(
        validTxStates.has(pmt.tx_st_cd),
        `tx_st_cd (${pmt.tx_st_cd}) must be a valid transaction status code`
      );
      assert.ok(
        validPayMethods.has(pmt.pay_mthd),
        `pay_mthd (${pmt.pay_mthd}) must be a valid payment method`
      );
      assert.ok(
        pmt.mrr_cents >= 2500 && pmt.mrr_cents <= 250000,
        `mrr_cents (${pmt.mrr_cents}) must be within bounded SaaS range 2500 - 250000`
      );
      assert.match(
        pmt.ip_orig,
        ipv4Regex,
        `ip_orig (${pmt.ip_orig}) must be a valid IPv4 address`
      );
    }
  });
});
