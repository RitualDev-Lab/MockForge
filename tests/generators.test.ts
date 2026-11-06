import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SeededPRNG } from '../src/generator/prng.js';
import { FinanceGenerator } from '../src/generator/generators/finance.js';
import { IdentityGenerator } from '../src/generator/generators/identity.js';
import { EcommerceGenerator } from '../src/generator/generators/ecommerce.js';

function verifyLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

describe('Domain Generators Tests', () => {
  test('Generates Luhn-valid Credit Cards for Visa, Mastercard, and Amex', () => {
    const prng = new SeededPRNG(42);

    for (let i = 0; i < 20; i++) {
      const visa = FinanceGenerator.creditCard(prng, 'visa');
      assert.equal(visa.startsWith('4'), true);
      assert.equal(visa.length, 16);
      assert.equal(verifyLuhn(visa), true);

      const mc = FinanceGenerator.creditCard(prng, 'mastercard');
      assert.equal(verifyLuhn(mc), true);

      const amex = FinanceGenerator.creditCard(prng, 'amex');
      assert.equal(amex.length, 15);
      assert.equal(verifyLuhn(amex), true);
    }
  });

  test('Generates valid Identity details with coherent usernames and emails', () => {
    const prng = new SeededPRNG(42);

    for (let i = 0; i < 10; i++) {
      const email = IdentityGenerator.email(prng, 'alice.smith');
      assert.ok(email.startsWith('alice.smith@'));
      assert.ok(email.includes('.'));

      const ssn = IdentityGenerator.ssn(prng);
      assert.match(ssn, /^\d{3}-\d{2}-\d{4}$/);

      const pan = IdentityGenerator.pan(prng);
      assert.match(pan, /^[A-Z]{5}[0-9]{4}[A-Z]$/);
    }
  });

  test('Generates valid E-commerce and Stripe IDs', () => {
    const prng = new SeededPRNG(42);

    const cus = FinanceGenerator.stripeCustomerId(prng);
    assert.ok(cus.startsWith('cus_'));

    const pi = FinanceGenerator.stripePaymentIntentId(prng);
    assert.ok(pi.startsWith('pi_'));

    const sku = EcommerceGenerator.sku(prng);
    assert.match(sku, /^SKU-[A-Z]{3}-[0-9]{4}$/);

    const ord = EcommerceGenerator.orderNumber(prng);
    assert.match(ord, /^ORD-[A-Z0-9]+-[0-9]{4}$/);
  });
});
