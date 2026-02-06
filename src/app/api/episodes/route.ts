import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // First try the query with the shows join
    let data: any[] | null = null;

    const joinResult = await supabase
      .from('episodes')
      .select(`
        *,
        shows (
          title,
          author,
          image_url
        )
      `)
      .order('published_at', { ascending: false });

    if (joinResult.error) {
      // If the join fails (e.g., relationship not found), fall back to a simple query
      console.warn("Episodes join query failed, falling back to simple query:", joinResult.error.message);
      
      const simpleResult = await supabase
        .from('episodes')
        .select('*')
        .order('published_at', { ascending: false });

      if (simpleResult.error) {
        console.error("Supabase error (simple query):", simpleResult.error);
        return NextResponse.json(
          { success: false, error: simpleResult.error.message },
          { status: 500 }
        );
      }

      data = simpleResult.data;
    } else {
      data = joinResult.data;
    }

    if (!data) {
      return NextResponse.json({ success: true, data: [] });
    }

    const formattedEpisodes = data.map((ep: any) => ({
      ...ep,
      show_title: ep.shows?.title || null,
      show_author: 'anoncast.net',
      display_image: ep.image_url || ep.shows?.image_url || null
    }));

    return NextResponse.json({ success: true, data: formattedEpisodes });
  } catch (err) {
    console.error("Internal error fetching episodes:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}
