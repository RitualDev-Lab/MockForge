export type LicenseTier = 'community' | 'team' | 'enterprise';

export interface LicenseInfo {
  tier: LicenseTier;
  licensedTo?: string;
  maxRowsPerTable: number;
  features: {
    inBrowserWasm: boolean;
    geminiAiInference: boolean;
    localHeuristics: boolean;
    allExporters: boolean;
    unlimitedRows: boolean;
    customEnterpriseDictionary: boolean;
    cliAutomation: boolean;
    prioritySla: boolean;
  };
  expiresAt?: string;
  isValid: boolean;
}

export class LicenseManager {
  private static readonly COMMUNITY_LIMIT = 10000;
  private static readonly TEAM_LIMIT = 1000000;

  /**
   * Resolves license info and features based on optional license key
   */
  static getLicense(licenseKey?: string): LicenseInfo {
    const key = licenseKey?.trim();

    if (!key) {
      return {
        tier: 'community',
        licensedTo: 'Community Developer ($0 Free Tier)',
        maxRowsPerTable: this.COMMUNITY_LIMIT,
        features: {
          inBrowserWasm: true,
          geminiAiInference: true,
          localHeuristics: true,
          allExporters: true,
          unlimitedRows: false,
          customEnterpriseDictionary: false,
          cliAutomation: true,
          prioritySla: false
        },
        isValid: true
      };
    }

    if (key.startsWith('MF-ENT-')) {
      return {
        tier: 'enterprise',
        licensedTo: 'Enterprise Organization',
        maxRowsPerTable: Infinity,
        features: {
          inBrowserWasm: true,
          geminiAiInference: true,
          localHeuristics: true,
          allExporters: true,
          unlimitedRows: true,
          customEnterpriseDictionary: true,
          cliAutomation: true,
          prioritySla: true
        },
        isValid: true
      };
    }

    if (key.startsWith('MF-TEAM-')) {
      return {
        tier: 'team',
        licensedTo: 'Professional Team',
        maxRowsPerTable: this.TEAM_LIMIT,
        features: {
          inBrowserWasm: true,
          geminiAiInference: true,
          localHeuristics: true,
          allExporters: true,
          unlimitedRows: false,
          customEnterpriseDictionary: true,
          cliAutomation: true,
          prioritySla: false
        },
        isValid: true
      };
    }

    // Invalid key fallback to community
    return {
      tier: 'community',
      licensedTo: 'Community Developer (Invalid Key)',
      maxRowsPerTable: this.COMMUNITY_LIMIT,
      features: {
        inBrowserWasm: true,
        geminiAiInference: true,
        localHeuristics: true,
        allExporters: true,
        unlimitedRows: false,
        customEnterpriseDictionary: false,
        cliAutomation: true,
        prioritySla: false
      },
      isValid: false
    };
  }

  /**
   * Asserts row count against license tier limits
   */
  static validateRowCount(requestedRows: number, license: LicenseInfo): void {
    if (requestedRows > license.maxRowsPerTable) {
      throw new Error(
        `Requested row count (${requestedRows.toLocaleString()}) exceeds ${license.tier.toUpperCase()} license limit (${license.maxRowsPerTable.toLocaleString()}). Upgrade to MockForge Team or Enterprise for higher volume.`
      );
    }
  }
}
