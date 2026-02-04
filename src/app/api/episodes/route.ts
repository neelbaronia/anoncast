import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
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

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedEpisodes = data.map((ep: any) => ({
      ...ep,
      show_title: ep.shows?.title,
      show_author: 'anoncast.net',
      display_image: ep.image_url || ep.shows?.image_url // Prioritize episode image
    }));

    return NextResponse.json({ success: true, data: formattedEpisodes });
  } catch (err) {
    console.error("Internal error:", err);
    return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 });
  }
}
