import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Use sandbox keys if available, otherwise fallback to main keys
const stripeSecretKey = process.env.SANDBOX_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey!);

const isTestMode = stripeSecretKey?.startsWith('sk_test_');

export async function POST(request: NextRequest) {
  try {
    const { amount, title } = await request.json();

    if (!amount || isNaN(amount)) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${isTestMode ? '[TEST] ' : ''}Podcast Generation: ${title || 'Untitled'}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.nextUrl.origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/?payment_cancelled=true`,
    });

    return NextResponse.json({ id: session.id, url: session.url, isTestMode });
  } catch (error) {
    console.error('Stripe session creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment session' },
      { status: 500 }
    );
  }
}
