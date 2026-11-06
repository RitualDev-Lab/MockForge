import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LicenseManager } from '../src/licensing/commercial.js';

describe('Commercial Freemium Licensing Engine Tests', () => {
  test('Defaults to Community Edition ($0 Free Tier) without license key', () => {
    const license = LicenseManager.getLicense();

    assert.equal(license.tier, 'community');
    assert.equal(license.isValid, true);
    assert.equal(license.maxRowsPerTable, 10000);
    assert.equal(license.features.inBrowserWasm, true);
    assert.equal(license.features.geminiAiInference, true);
    assert.equal(license.features.unlimitedRows, false);
  });

  test('Validates Team Edition commercial license key', () => {
    const license = LicenseManager.getLicense('MF-TEAM-DEVSTUDIO-2026');

    assert.equal(license.tier, 'team');
    assert.equal(license.isValid, true);
    assert.equal(license.maxRowsPerTable, 1000000);
    assert.equal(license.features.customEnterpriseDictionary, true);
  });

  test('Validates Enterprise Edition commercial license key', () => {
    const license = LicenseManager.getLicense('MF-ENT-CORP-9999');

    assert.equal(license.tier, 'enterprise');
    assert.equal(license.isValid, true);
    assert.equal(license.maxRowsPerTable, Infinity);
    assert.equal(license.features.unlimitedRows, true);
    assert.equal(license.features.prioritySla, true);
  });

  test('Enforces row count boundary per license tier', () => {
    const communityLicense = LicenseManager.getLicense();

    // 5,000 rows is valid on Community
    assert.doesNotThrow(() => {
      LicenseManager.validateRowCount(5000, communityLicense);
    });

    // 25,000 rows throws on Community
    assert.throws(
      () => {
        LicenseManager.validateRowCount(25000, communityLicense);
      },
      /exceeds COMMUNITY license limit/
    );
  });
});
