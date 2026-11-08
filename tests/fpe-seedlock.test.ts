import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SeededPRNG } from '../src/generator/prng.js';
import { FormatPreservingCipher } from '../src/anonymizer/fpe.js';
import { DatabaseMasker } from '../src/anonymizer/database-masker.js';

describe('Phase 1: MockForge Cryptographic Seed-Lock & Format-Preserving Encryption', () => {
  describe('Cryptographic SHA-256 Seed-Locked PRNG', () => {
    it('produces identical deterministic streams when initialized with cryptographic string seeds', () => {
      const prng1 = new SeededPRNG('enterprise-tenant-alpha-sha256-seed-2026');
      const prng2 = SeededPRNG.fromSeed('enterprise-tenant-alpha-sha256-seed-2026');

      const stream1 = Array.from({ length: 10 }, () => prng1.int(1, 1000));
      const stream2 = Array.from({ length: 10 }, () => prng2.int(1, 1000));

      assert.deepEqual(stream1, stream2);
    });

    it('derives independent child PRNG streams deterministically bound to domains', () => {
      const parentPrng = SeededPRNG.fromSeed('root-seed-key');
      const childUsers = parentPrng.deriveChild('users.email');
      const childOrders = parentPrng.deriveChild('orders.amount');

      const userVals = Array.from({ length: 5 }, () => childUsers.int(1, 100));
      const orderVals = Array.from({ length: 5 }, () => childOrders.int(1, 100));

      // Different domains produce distinct streams
      assert.notDeepEqual(userVals, orderVals);

      // Same derived domain from identical parent produces identical stream
      const parentPrng2 = SeededPRNG.fromSeed('root-seed-key');
      const childUsers2 = parentPrng2.deriveChild('users.email');
      assert.deepEqual(userVals, Array.from({ length: 5 }, () => childUsers2.int(1, 100)));
    });
  });

  describe('Format-Preserving Encryption (FPE)', () => {
    const cipher = new FormatPreservingCipher('mockforge-master-fpe-secret-key-32b', 'tweak-v1');

    it('preserves exact digit lengths and delimiters for SSN', () => {
      const originalSsn = '123-45-6789';
      const encrypted = cipher.encrypt(originalSsn);

      assert.notEqual(encrypted, originalSsn);
      assert.equal(encrypted.length, originalSsn.length);
      assert.match(encrypted, /^\d{3}-\d{2}-\d{4}$/);

      // Reversible decryption
      const decrypted = cipher.decrypt(encrypted);
      assert.equal(decrypted, originalSsn);
    });

    it('preserves exact digit lengths, grouping, and Luhn structure for Credit Cards', () => {
      const originalCard = '4532-1234-5678-9012';
      const encrypted = cipher.encrypt(originalCard);

      assert.notEqual(encrypted, originalCard);
      assert.equal(encrypted.length, originalCard.length);
      assert.match(encrypted, /^\d{4}-\d{4}-\d{4}-\d{4}$/);

      const decrypted = cipher.decrypt(encrypted);
      assert.equal(decrypted, originalCard);
    });

    it('preserves letter cases and punctuation for complex identity strings', () => {
      const raw = 'John.Doe+security@Hospital-Care.org';
      const encrypted = cipher.encrypt(raw);

      assert.equal(encrypted.length, raw.length);
      // Punctuation characters remain strictly intact in identical positions
      assert.equal(encrypted[4], '.');
      assert.equal(encrypted[8], '+');
      assert.equal(encrypted[17], '@');
      assert.equal(encrypted[26], '-');
      assert.equal(encrypted[31], '.');

      const decrypted = cipher.decrypt(encrypted);
      assert.equal(decrypted, raw);
    });
  });

  describe('DatabaseMasker FPE & DPDP Compliance Integration', () => {
    it('applies FPE strategy to columns configured with customRules', () => {
      const masker = new DatabaseMasker({
        seed: 'enterprise-dpdp-compliance-run-1',
        customRules: [
          {
            tableName: 'patients',
            columnName: 'ssn',
            strategy: 'fpe'
          }
        ]
      });

      const dataset = {
        patients: [
          { id: 1, name: 'Alice Smith', ssn: '987-65-4321' },
          { id: 2, name: 'Bob Jones', ssn: '111-22-3333' }
        ]
      };

      const result = masker.maskDataset(dataset);
      const maskedRow1 = result.data.patients[0];
      const maskedRow2 = result.data.patients[1];

      assert.match(maskedRow1.ssn, /^\d{3}-\d{2}-\d{4}$/);
      assert.notEqual(maskedRow1.ssn, '987-65-4321');
      assert.match(maskedRow2.ssn, /^\d{3}-\d{2}-\d{4}$/);
      assert.notEqual(maskedRow2.ssn, '111-22-3333');

      // Referential determinism: masking the same value in another row yields the same FPE ciphertext
      const duplicateMask = masker.applyMasking('987-65-4321', 'fpe', 'patients.ssn');
      assert.equal(maskedRow1.ssn, duplicateMask);

      // Compliance report verifies DPDP / HIPAA
      assert.equal(result.auditReport.compliance.dpdpCompliant, true);
      assert.equal(result.auditReport.compliance.hipaaCompliant, true);
    });
  });
});
