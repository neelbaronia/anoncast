import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  calculateDiscountedAmount,
  getStripeClient,
  isStripeTestMode,
  resolveDiscountCode,
  shouldWaiveDiscountedPayment,
} from '@/lib/stripe-discounts';

const stripe = getStripeClient();
const isTestMode = isStripeTestMode();

export async function POST(request: NextRequest) {
  try {
    const { amount, title, type, episodeId, segments, metadata, selectedImageIndex, promoCode } = await request.json();

    if (!amount || isNaN(amount)) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const discount = typeof promoCode === 'string' && promoCode.trim()
      ? await resolveDiscountCode(promoCode)
      : null;

    if (promoCode && !discount) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
    }

    if (discount) {
      const discountedAmount = calculateDiscountedAmount(Number(amount), discount);
      if (shouldWaiveDiscountedPayment(discountedAmount, discount)) {
        return NextResponse.json(
          { error: 'This discount does not require a Stripe payment.' },
          { status: 400 },
        );
      }
    }

    const stripeDiscount = discount
      ? discount.source === 'promotion_code'
        ? { promotion_code: discount.id }
        : { coupon: discount.id }
      : null;

    // Determine return paths
    const origin = request.nextUrl.origin;
    const baseSuccessUrl = type === 'download' ? `${origin}/generated` : origin;
    const baseCancelUrl = type === 'download' ? `${origin}/generated` : origin;

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${isTestMode ? '[TEST] ' : ''}${type === 'download' ? 'MP3 Download' : 'Podcast Generation'}: ${title || 'Untitled'}`,
              description: type === 'download' ? 'Direct high-quality MP3 file download' : 'AI Voice synthesis and audio processing',
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      ...(stripeDiscount ? { discounts: [stripeDiscount] } : {}),
      mode: 'payment',
      success_url: `${baseSuccessUrl}?payment_success=true&type=${type || 'generation'}${episodeId ? `&episodeId=${episodeId}` : ''}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseCancelUrl}?payment_cancelled=true`,
      metadata: {
        type: type || 'generation',
        episodeId: episodeId || '',
        promoCode: discount?.code || '',
      }
    });

    // Store pending generation state server-side for reliable resume after redirect
    if (type !== 'download' && segments && session.id) {
      try {
        const { error } = await supabase.from('pending_generations').insert({
          stripe_session_id: session.id,
          segments,
          metadata: metadata || null,
          selected_image_index: selectedImageIndex ?? 0,
        });
        if (error) {
          console.error('Failed to store pending generation:', error);
        }
      } catch (e) {
        console.error('Failed to store pending generation:', e);
      }
    }

    return NextResponse.json({ id: session.id, url: session.url, isTestMode });
  } catch (error) {
    console.error('Stripe session creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment session' },
      { status: 500 }
    );
  }
}
