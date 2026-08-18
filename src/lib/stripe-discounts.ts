import Stripe from 'stripe';

export const MINIMUM_STRIPE_CHARGE_USD = 0.5;

export type DiscountSource = 'internal' | 'promotion_code' | 'coupon';

export interface ResolvedDiscount {
  source: DiscountSource;
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
}

export function getStripeSecretKey(): string {
  const key = process.env.NODE_ENV === 'development'
    ? (process.env.SANDBOX_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
    : (process.env.STRIPE_SECRET_KEY || process.env.SANDBOX_STRIPE_SECRET_KEY);

  if (!key) {
    throw new Error('Stripe secret key is not configured');
  }

  return key;
}

export function getStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey());
}

export function isStripeTestMode(): boolean {
  return getStripeSecretKey().startsWith('sk_test_');
}

function getInternalCodes(): string[] {
  return (process.env.PROMO_CODES || '')
    .split(',')
    .map(code => code.trim().toLowerCase())
    .filter(Boolean);
}

function isUsableCoupon(value: unknown): value is Stripe.Coupon {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { valid?: boolean; deleted?: boolean };
  return candidate.valid === true && candidate.deleted !== true;
}

function toResolvedCoupon(
  source: Exclude<DiscountSource, 'internal'>,
  id: string,
  code: string,
  coupon: Stripe.Coupon,
): ResolvedDiscount {
  return {
    source,
    id,
    code,
    percentOff: coupon.percent_off ?? null,
    amountOff: coupon.amount_off ?? null,
    currency: coupon.currency ?? null,
  };
}

async function resolvePromotionCode(stripe: Stripe, code: string): Promise<ResolvedDiscount | null> {
  const promotionCodes = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 10,
    expand: ['data.promotion.coupon'],
  });

  for (const promotionCode of promotionCodes.data) {
    const compatiblePromotionCode = promotionCode as Stripe.PromotionCode & {
      coupon?: string | Stripe.Coupon;
      promotion?: { coupon?: string | Stripe.Coupon };
    };
    const couponReference = compatiblePromotionCode.promotion?.coupon
      ?? compatiblePromotionCode.coupon;
    const coupon = typeof couponReference === 'string'
      ? await stripe.coupons.retrieve(couponReference)
      : couponReference;

    if (isUsableCoupon(coupon)) {
      return toResolvedCoupon('promotion_code', promotionCode.id, promotionCode.code, coupon);
    }
  }

  return null;
}

async function resolveCoupon(stripe: Stripe, code: string): Promise<ResolvedDiscount | null> {
  const candidates = [...new Set([code, code.toLowerCase()])];

  for (const candidate of candidates) {
    try {
      const coupon = await stripe.coupons.retrieve(candidate);
      if (isUsableCoupon(coupon)) {
        return toResolvedCoupon('coupon', coupon.id, code, coupon);
      }
    } catch (error) {
      const stripeError = error as { code?: string };
      if (stripeError.code !== 'resource_missing') throw error;
    }
  }

  return null;
}

export async function resolveDiscountCode(code: string): Promise<ResolvedDiscount | null> {
  const trimmedCode = code.trim();
  if (!trimmedCode) return null;

  if (getInternalCodes().includes(trimmedCode.toLowerCase())) {
    return {
      source: 'internal',
      id: trimmedCode.toLowerCase(),
      code: trimmedCode,
      percentOff: 100,
      amountOff: null,
      currency: null,
    };
  }

  const stripe = getStripeClient();
  return await resolvePromotionCode(stripe, trimmedCode)
    ?? await resolveCoupon(stripe, trimmedCode);
}

export function calculateDiscountedAmount(amountUsd: number, discount: ResolvedDiscount): number {
  const subtotalCents = Math.max(0, Math.round(amountUsd * 100));
  let totalCents = subtotalCents;

  if (discount.percentOff != null) {
    totalCents = Math.round(subtotalCents * (1 - discount.percentOff / 100));
  } else if (discount.amountOff != null && (!discount.currency || discount.currency === 'usd')) {
    totalCents = subtotalCents - discount.amountOff;
  }

  return Math.max(0, totalCents) / 100;
}

export function shouldWaiveDiscountedPayment(
  discountedAmount: number,
  discount: ResolvedDiscount,
): boolean {
  return discount.source === 'internal'
    || discountedAmount === 0
    || discountedAmount < MINIMUM_STRIPE_CHARGE_USD;
}
