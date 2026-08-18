import { NextRequest, NextResponse } from 'next/server';
import {
  calculateDiscountedAmount,
  resolveDiscountCode,
  shouldWaiveDiscountedPayment,
} from '@/lib/stripe-discounts';

export async function POST(request: NextRequest) {
  try {
    const { code, amount } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false });
    }

    const discount = await resolveDiscountCode(code);
    if (!discount) {
      return NextResponse.json({ valid: false });
    }

    const subtotal = Number(amount);
    const hasSubtotal = Number.isFinite(subtotal) && subtotal > 0;
    const calculatedAmount = hasSubtotal
      ? calculateDiscountedAmount(subtotal, discount)
      : null;
    const waivePayment = calculatedAmount == null
      ? discount.source === 'internal' || discount.percentOff === 100
      : shouldWaiveDiscountedPayment(calculatedAmount, discount);

    return NextResponse.json({
      valid: true,
      discount: {
        percentOff: discount.percentOff,
        amountOff: discount.amountOff,
        currency: discount.currency,
      },
      calculatedAmount,
      discountedAmount: waivePayment ? 0 : calculatedAmount,
      waivePayment,
    });
  } catch (error) {
    console.error('Promo validation failed:', error);
    return NextResponse.json({ valid: false });
  }
}
