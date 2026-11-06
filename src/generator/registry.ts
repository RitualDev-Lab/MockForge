import type { SeededPRNG } from './prng.js';
import type { ColumnDefinition } from '../types/schema.js';
import type { SemanticColumnProfile } from '../inference/types.js';
import { IdentityGenerator } from './generators/identity.js';
import { FinanceGenerator } from './generators/finance.js';
import { EcommerceGenerator } from './generators/ecommerce.js';
import { GeoGenerator } from './generators/geo.js';
import { TemporalGenerator } from './generators/temporal.js';

export interface RowGenerationContext {
  tableName: string;
  rowIndex: number;
  currentRow: Record<string, any>;
  semanticProfile?: SemanticColumnProfile | null;
}

export class GeneratorRegistry {
  /**
   * Synthesizes a contextually appropriate value for a column based on name heuristics, type, and constraints
   */
  static generateValue(col: ColumnDefinition, prng: SeededPRNG, context: RowGenerationContext): any {
    const colName = col.name.toLowerCase();

    // 1. Explicit Enum Values
    if (col.category === 'enum' && col.enumValues && col.enumValues.length > 0) {
      return prng.pick(col.enumValues);
    }

    // 2. Primary Key / Serial Auto-Increment
    if (col.isPrimaryKey) {
      if (col.isAutoIncrement || col.normalizedType === 'serial' || col.normalizedType === 'bigserial') {
        return context.rowIndex + 1; // 1-indexed sequential integer
      }
      if (col.category === 'uuid') {
        return prng.uuid();
      }
      if (col.normalizedType === 'integer' || col.normalizedType === 'bigint') {
        return context.rowIndex + 1;
      }
      return prng.uuid();
    }

    // 2.5 Semantic Profile (Inferred via Gemini 1.5 Flash AI or Local Rules Engine)
    if (context.semanticProfile) {
      const prof = context.semanticProfile;

      if (prof.enumOptions && prof.enumOptions.length > 0) {
        return prng.pick(prof.enumOptions);
      }

      if (prof.range) {
        if (col.normalizedType === 'integer' || col.normalizedType === 'bigint') {
          return prng.int(prof.range.min, prof.range.max);
        }
        return prng.float(prof.range.min, prof.range.max, prof.range.precision ?? 2);
      }

      if (prof.suggestedGenerator) {
        const val = this.dispatchSuggestedGenerator(prof.suggestedGenerator, prng, context);
        if (val !== undefined) return val;
      }
    }

    // 3. Name-Based Semantic Heuristics
    // Identity & Contact
    if (colName === 'email' || colName.endsWith('_email')) {
      const user = context.currentRow.username || context.currentRow.user_name;
      return IdentityGenerator.email(prng, user);
    }
    if (colName === 'username' || colName === 'user_name') {
      return IdentityGenerator.username(prng, context.currentRow.first_name, context.currentRow.last_name);
    }
    if (colName === 'first_name' || colName === 'fname') {
      return IdentityGenerator.firstName(prng);
    }
    if (colName === 'last_name' || colName === 'lname') {
      return IdentityGenerator.lastName(prng);
    }
    if (colName === 'full_name' || (colName === 'name' && context.tableName.toLowerCase().includes('user'))) {
      return IdentityGenerator.fullName(prng);
    }
    if (colName.includes('phone') || colName.includes('mobile') || colName.includes('tel')) {
      return IdentityGenerator.phone(prng);
    }
    if (colName.includes('avatar') || colName.includes('image_url') || colName.includes('photo')) {
      return IdentityGenerator.avatarUrl(prng, context.currentRow.username || `${context.tableName}-${context.rowIndex}`);
    }
    if (colName === 'ssn' || colName.includes('social_security')) {
      return IdentityGenerator.ssn(prng);
    }
    if (colName === 'pan' || colName.includes('pan_number')) {
      return IdentityGenerator.pan(prng);
    }
    if (colName === 'aadhaar' || colName.includes('aadhaar_number')) {
      return IdentityGenerator.aadhaar(prng);
    }

    // Financial & Payments
    if (colName.includes('card_num') || colName.includes('credit_card') || colName === 'pan_card') {
      return FinanceGenerator.creditCard(prng);
    }
    if (colName === 'cvv' || colName === 'cvc') {
      return FinanceGenerator.cvv(prng);
    }
    if (colName === 'currency' || colName.endsWith('_currency')) {
      return FinanceGenerator.currency(prng);
    }
    if (colName.includes('stripe_customer') || (colName.includes('customer_id') && col.category === 'textual')) {
      return FinanceGenerator.stripeCustomerId(prng);
    }
    if (colName.includes('stripe_payment') || colName.includes('payment_intent')) {
      return FinanceGenerator.stripePaymentIntentId(prng);
    }
    if (colName.includes('stripe_sub') || colName.includes('subscription_id')) {
      return FinanceGenerator.stripeSubscriptionId(prng);
    }
    if (colName === 'iban') {
      return FinanceGenerator.iban(prng);
    }
    if (colName.includes('tax_rate') || colName.includes('vat_rate')) {
      return FinanceGenerator.taxRate(prng);
    }
    if (
      colName.includes('price') ||
      colName.includes('amount') ||
      colName.includes('total') ||
      colName.includes('subtotal') ||
      colName.includes('cost') ||
      colName.includes('salary') ||
      colName.includes('balance') ||
      colName.includes('mrr')
    ) {
      return FinanceGenerator.price(prng, 10.0, 1500.0);
    }

    // E-Commerce & Products
    if (colName === 'sku' || colName.endsWith('_sku')) {
      return EcommerceGenerator.sku(prng);
    }
    if (colName.includes('order_no') || colName.includes('order_number') || colName.includes('invoice_no')) {
      return EcommerceGenerator.orderNumber(prng);
    }
    if (colName.includes('product_name') || (colName === 'name' && context.tableName.toLowerCase().includes('product'))) {
      return EcommerceGenerator.productName(prng);
    }
    if (colName.includes('company') || colName.includes('org_name') || (colName === 'name' && context.tableName.toLowerCase().includes('org'))) {
      return EcommerceGenerator.company(prng);
    }
    if (colName.includes('job_title') || colName === 'position' || (colName === 'title' && context.tableName.toLowerCase().includes('employee'))) {
      return EcommerceGenerator.jobTitle(prng);
    }
    if (colName.includes('department') || colName.includes('dept')) {
      return EcommerceGenerator.department(prng);
    }

    // Geospatial & Address
    if (colName.includes('street') || colName === 'address' || colName === 'address_line1') {
      return GeoGenerator.streetAddress(prng);
    }
    if (colName === 'city') {
      return GeoGenerator.city(prng);
    }
    if (colName === 'state' || colName === 'province') {
      return col.length && col.length <= 3 ? GeoGenerator.state(prng).code : GeoGenerator.state(prng).name;
    }
    if (colName === 'zip' || colName.includes('postal_code') || colName === 'zipcode') {
      return GeoGenerator.zipCode(prng);
    }
    if (colName === 'country' || colName.endsWith('_country')) {
      return col.length && col.length <= 3 ? GeoGenerator.country(prng).code : GeoGenerator.country(prng).name;
    }
    if (colName === 'lat' || colName === 'latitude') {
      return GeoGenerator.latitude(prng);
    }
    if (colName === 'lng' || colName === 'lon' || colName === 'longitude') {
      return GeoGenerator.longitude(prng);
    }
    if (colName.includes('ip_address') || colName === 'ip' || colName === 'ipv4') {
      return GeoGenerator.ipv4(prng);
    }
    if (colName === 'mac' || colName.includes('mac_address')) {
      return GeoGenerator.macAddress(prng);
    }

    // Temporal
    if (colName.includes('birth') || colName === 'dob') {
      return TemporalGenerator.birthDate(prng).toISOString().split('T')[0];
    }
    if (colName.includes('created') || colName.includes('inserted') || colName.includes('registered')) {
      return TemporalGenerator.isoTimestamp(prng);
    }
    if (colName.includes('updated') || colName.includes('modified')) {
      // Coordinated with created_at if available
      return TemporalGenerator.isoTimestamp(prng);
    }

    // 4. Fallback by Category & Normalized Type
    switch (col.category) {
      case 'uuid':
        return prng.uuid();

      case 'boolean':
        // Biased true for active/enabled flags, 50% for generic flags
        return colName.includes('active') || colName.includes('enabled') || colName.includes('verified')
          ? prng.boolean(0.85)
          : prng.boolean(0.5);

      case 'numeric':
        if (col.normalizedType === 'integer') return prng.int(1, 500);
        if (col.normalizedType === 'bigint') return prng.int(1000, 500000);
        if (col.normalizedType === 'decimal' || col.normalizedType === 'float') {
          return prng.float(1.0, 999.0, col.scale || 2);
        }
        return prng.int(1, 100);

      case 'temporal':
        if (col.normalizedType === 'date') {
          return TemporalGenerator.datePast(prng).toISOString().split('T')[0];
        }
        return TemporalGenerator.isoTimestamp(prng);

      case 'json':
        return {
          version: '1.0',
          tier: prng.pick(['standard', 'premium', 'enterprise']),
          tags: prng.sample(['ai', 'cloud', 'dev', 'security', 'saas'], 2),
          metadata: {
            retries: prng.int(0, 3),
            flags: { verified: true }
          }
        };

      case 'textual':
        if (col.length && col.length <= 10) {
          return prng.nanoid(col.length).toUpperCase();
        }
        if (colName.includes('title') || colName.includes('header')) {
          return `${EcommerceGenerator.productName(prng)} Announcement`;
        }
        if (colName.includes('desc') || colName.includes('comment') || colName.includes('bio')) {
          return `Automated synthetic test record generated for ${context.tableName} verification testing.`;
        }
        return `${col.name}_${prng.nanoid(6)}`;

      default:
        return `${col.name}_sample`;
    }
  }

  private static dispatchSuggestedGenerator(
    generatorName: string,
    prng: SeededPRNG,
    context: RowGenerationContext
  ): any {
    switch (generatorName) {
      case 'identity.first_name':
        return IdentityGenerator.firstName(prng);
      case 'identity.last_name':
        return IdentityGenerator.lastName(prng);
      case 'identity.name':
        return IdentityGenerator.fullName(prng);
      case 'identity.email':
        return IdentityGenerator.email(prng, context.currentRow.username || context.currentRow.user_name);
      case 'identity.phone':
        return IdentityGenerator.phone(prng);
      case 'identity.avatar':
        return IdentityGenerator.avatarUrl(prng);
      case 'identity.ssn':
        return IdentityGenerator.ssn(prng);
      case 'finance.credit_card':
        return FinanceGenerator.creditCard(prng);
      case 'finance.cvv':
        return FinanceGenerator.cvv(prng);
      case 'finance.currency':
        return FinanceGenerator.currency(prng);
      case 'finance.amount':
        return FinanceGenerator.price(prng, 10, 500);
      case 'finance.tax_rate':
        return FinanceGenerator.taxRate(prng);
      case 'finance.stripe_customer_id':
        return FinanceGenerator.stripeCustomerId(prng);
      case 'finance.stripe_payment_id':
        return FinanceGenerator.stripePaymentIntentId(prng);
      case 'finance.iban':
        return FinanceGenerator.iban(prng);
      case 'ecommerce.product':
        return EcommerceGenerator.productName(prng);
      case 'ecommerce.sku':
        return EcommerceGenerator.sku(prng);
      case 'ecommerce.order_number':
        return EcommerceGenerator.orderNumber(prng);
      case 'ecommerce.company':
        return EcommerceGenerator.company(prng);
      case 'ecommerce.job_title':
        return EcommerceGenerator.jobTitle(prng);
      case 'ecommerce.department':
        return EcommerceGenerator.department(prng);
      case 'geo.address':
        return GeoGenerator.streetAddress(prng);
      case 'geo.city':
        return GeoGenerator.city(prng);
      case 'geo.state':
        return GeoGenerator.state(prng).name;
      case 'geo.country':
        return GeoGenerator.country(prng).name;
      case 'geo.postal_code':
        return GeoGenerator.zipCode(prng);
      case 'geo.latitude':
        return GeoGenerator.latitude(prng);
      case 'geo.longitude':
        return GeoGenerator.longitude(prng);
      case 'geo.ipv4':
        return GeoGenerator.ipv4(prng);
      case 'geo.mac':
        return GeoGenerator.macAddress(prng);
      default:
        return undefined;
    }
  }
}
