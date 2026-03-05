import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { stripeSessionId, segments, metadata, selectedImageIndex } = await request.json();

    if (!stripeSessionId || !segments) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('pending_generations').insert({
      stripe_session_id: stripeSessionId,
      segments,
      metadata: metadata || null,
      selected_image_index: selectedImageIndex ?? 0,
    });

    if (error) {
      console.error('Failed to store pending generation:', error);
      return NextResponse.json(
        { error: 'Failed to store pending generation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pending generation POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('pending_generations')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .eq('consumed', false)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Pending generation not found' },
        { status: 404 }
      );
    }

    // Mark as consumed to prevent replay
    await supabase
      .from('pending_generations')
      .update({ consumed: true })
      .eq('id', data.id);

    return NextResponse.json({
      segments: data.segments,
      metadata: data.metadata,
      selectedImageIndex: data.selected_image_index,
    });
  } catch (error) {
    console.error('Pending generation GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
