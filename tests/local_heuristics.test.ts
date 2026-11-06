import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { LocalSemanticHeuristics } from '../src/inference/local-heuristics.js';

describe('LocalSemanticHeuristics Offline Rules Engine Tests', () => {
  const crypticEnterpriseSql = `
    CREATE TABLE acct_transactions (
      tx_id UUID PRIMARY KEY,
      tx_st_cd VARCHAR(20) NOT NULL,
      pay_mthd VARCHAR(30) NOT NULL,
      ip_orig VARCHAR(45) NOT NULL,
      mac_addr VARCHAR(30) NOT NULL,
      mrr_cents INT NOT NULL,
      nps_score INT NOT NULL,
      c_fname VARCHAR(100) NOT NULL,
      c_lname VARCHAR(100) NOT NULL,
      c_eml VARCHAR(150) NOT NULL,
      c_tel VARCHAR(50) NOT NULL,
      kyc_st VARCHAR(30) NOT NULL,
      tier_cd VARCHAR(20) NOT NULL,
      dept_cd VARCHAR(20) NOT NULL,
      lat_coord NUMERIC(9, 6) NOT NULL,
      long_coord NUMERIC(9, 6) NOT NULL
    );
  `;

  test('Correctly infers cryptic status codes, enums, and abbreviations without network', () => {
    const schema = SqlDdlParser.parse(crypticEnterpriseSql, 'postgres');
    const table = schema.tables[0];
    const profiles = LocalSemanticHeuristics.inferTable(table);

    // 1. Transaction status code
    assert.ok(profiles['tx_st_cd'], 'tx_st_cd must have a semantic profile');
    assert.equal(profiles['tx_st_cd'].inferredDomain, 'enum');
    assert.ok(profiles['tx_st_cd'].enumOptions?.includes('CAPTURED'));
    assert.ok(profiles['tx_st_cd'].enumOptions?.includes('SETTLED'));

    // 2. Payment method
    assert.ok(profiles['pay_mthd']);
    assert.equal(profiles['pay_mthd'].inferredDomain, 'enum');
    assert.ok(profiles['pay_mthd'].enumOptions?.includes('CREDIT_CARD'));

    // 3. KYC state
    assert.ok(profiles['kyc_st']);
    assert.equal(profiles['kyc_st'].inferredDomain, 'enum');
    assert.ok(profiles['kyc_st'].enumOptions?.includes('VERIFIED'));

    // 4. Tier code
    assert.ok(profiles['tier_cd']);
    assert.ok(profiles['tier_cd'].enumOptions?.includes('ENTERPRISE'));

    // 5. Department code
    assert.ok(profiles['dept_cd']);
    assert.ok(profiles['dept_cd'].enumOptions?.includes('ENG'));

    // 6. Network & Geolocation
    assert.equal(profiles['ip_orig']?.suggestedGenerator, 'geo.ipv4');
    assert.equal(profiles['mac_addr']?.suggestedGenerator, 'geo.mac');
    assert.equal(profiles['lat_coord']?.suggestedGenerator, 'geo.latitude');
    assert.equal(profiles['long_coord']?.suggestedGenerator, 'geo.longitude');

    // 7. Identity & Contact abbreviations
    assert.equal(profiles['c_fname']?.suggestedGenerator, 'identity.first_name');
    assert.equal(profiles['c_lname']?.suggestedGenerator, 'identity.last_name');
    assert.equal(profiles['c_eml']?.suggestedGenerator, 'identity.email');
    assert.equal(profiles['c_tel']?.suggestedGenerator, 'identity.phone');

    // 8. Numeric ranges
    assert.equal(profiles['mrr_cents']?.inferredDomain, 'numeric_range');
    assert.equal(profiles['mrr_cents']?.range?.min, 2500);
    assert.equal(profiles['mrr_cents']?.range?.max, 250000);

    assert.equal(profiles['nps_score']?.inferredDomain, 'numeric_range');
    assert.equal(profiles['nps_score']?.range?.min, 0);
    assert.equal(profiles['nps_score']?.range?.max, 10);
  });

  test('Preserves primary keys and foreign keys from override', () => {
    const schema = SqlDdlParser.parse(crypticEnterpriseSql, 'postgres');
    const table = schema.tables[0];
    const profiles = LocalSemanticHeuristics.inferTable(table);

    // Primary key tx_id should NOT be overridden by heuristic profiles
    assert.equal(profiles['tx_id'], undefined);
  });
});
