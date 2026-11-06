import type { SeededPRNG } from '../prng.js';

export class FinanceGenerator {
  /**
   * Generates a 16-digit credit card number with mathematically valid Luhn checksum
   */
  static creditCard(prng: SeededPRNG, brand: 'visa' | 'mastercard' | 'amex' | 'discover' = 'visa'): string {
    let prefix = '4'; // Visa
    let length = 16;

    if (brand === 'mastercard') {
      prefix = String(prng.int(51, 55));
    } else if (brand === 'amex') {
      prefix = prng.pick(['34', '37']);
      length = 15;
    } else if (brand === 'discover') {
      prefix = '6011';
    }

    let partial = prefix;
    while (partial.length < length - 1) {
      partial += String(prng.int(0, 9));
    }

    const checkDigit = this.calculateLuhnCheckDigit(partial);
    return partial + checkDigit;
  }

  static cvv(prng: SeededPRNG, isAmex = false): string {
    const length = isAmex ? 4 : 3;
    let s = '';
    for (let i = 0; i < length; i++) s += String(prng.int(0, 9));
    return s;
  }

  static currency(prng: SeededPRNG): string {
    return prng.pick(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'SGD', 'CHF']);
  }

  static price(prng: SeededPRNG, min = 5.0, max = 500.0): number {
    return prng.float(min, max, 2);
  }

  static taxRate(prng: SeededPRNG): number {
    return prng.float(0.04, 0.12, 4); // 4% to 12%
  }

  static stripeCustomerId(prng: SeededPRNG): string {
    return `cus_${prng.nanoid(14).toLowerCase()}`;
  }

  static stripePaymentIntentId(prng: SeededPRNG): string {
    return `pi_${prng.nanoid(24).toLowerCase()}`;
  }

  static stripeSubscriptionId(prng: SeededPRNG): string {
    return `sub_${prng.nanoid(14).toLowerCase()}`;
  }

  static iban(prng: SeededPRNG, countryCode = 'GB'): string {
    let bban = '';
    for (let i = 0; i < 16; i++) {
      bban += String(prng.int(0, 9));
    }
    const check = String(prng.int(10, 98));
    return `${countryCode}${check}${bban}`;
  }

  private static calculateLuhnCheckDigit(partial: string): number {
    let sum = 0;
    const reversed = partial.split('').reverse().map(Number);

    for (let i = 0; i < reversed.length; i++) {
      let digit = reversed[i];
      // Double every other digit starting from the rightmost
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }

    return (10 - (sum % 10)) % 10;
  }
}
