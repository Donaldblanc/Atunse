// ADR-0012: money is never a raw float. All prices/deposits/balances pass
// through this type — integer cents + currency, no exceptions.

export type Currency = "USD";

export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: Currency,
  ) {
    if (!Number.isInteger(cents)) {
      throw new Error(`Money.cents must be an integer, got ${cents}`);
    }
  }

  static fromCents(cents: number, currency: Currency = "USD"): Money {
    return new Money(cents, currency);
  }

  static zero(currency: Currency = "USD"): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  /** 50% deposit, rounded down to the cent (never over-collect). */
  percentage(fraction: number): Money {
    return new Money(Math.floor(this.cents * fraction), this.currency);
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  toString(): string {
    return `${(this.cents / 100).toFixed(2)} ${this.currency}`;
  }

  private assertSameCurrency(other: Money) {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
