import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

// Use sandbox keys if available in development, otherwise prefer production keys
const stripeSecretKey = process.env.NODE_ENV === 'development'
  ? (process.env.SANDBOX_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
  : (process.env.STRIPE_SECRET_KEY || process.env.SANDBOX_STRIPE_SECRET_KEY);
const stripe = new Stripe(stripeSecretKey!);

const isTestMode = stripeSecretKey?.startsWith('sk_test_');

export async function POST(request: NextRequest) {
  try {
    const { amount, title, type, episodeId, segments, metadata, selectedImageIndex } = await request.json();

    if (!amount || isNaN(amount)) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

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
      mode: 'payment',
      success_url: `${baseSuccessUrl}?payment_success=true&type=${type || 'generation'}${episodeId ? `&episodeId=${episodeId}` : ''}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseCancelUrl}?payment_cancelled=true`,
      metadata: {
        type: type || 'generation',
        episodeId: episodeId || '',
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
