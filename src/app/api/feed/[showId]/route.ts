import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { create } from 'xmlbuilder2';

export async function GET(
  request: NextRequest,
  { params }: { params: { showId: string } }
) {
  const { showId } = params;

  try {
    // 1. Fetch show metadata
    const { data: show, error: showError } = await supabase
      .from('shows')
      .select('*')
      .eq('id', showId)
      .single();

    if (showError || !show) {
      return new Response('Show not found', { status: 404 });
    }

    // 2. Fetch episodes
    const { data: episodes, error: episodesError } = await supabase
      .from('episodes')
      .select('*')
      .eq('show_id', showId)
      .order('published_at', { ascending: false });

    if (episodesError) {
      return new Response('Error fetching episodes', { status: 500 });
    }

    // 3. Build RSS Feed
    const feed = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('rss', { 
        version: '2.0', 
        'xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        'xmlns:content': 'http://purl.org/rss/1.0/modules/content/'
      })
      .ele('channel')
        .ele('title').txt(show.title).up()
        .ele('description').txt(show.description || '').up()
        .ele('link').txt(process.env.NEXT_PUBLIC_APP_URL || '').up()
        .ele('language').txt('en-us').up()
        .ele('itunes:author').txt(show.author || 'Anoncast').up()
        .ele('itunes:owner')
          .ele('itunes:name').txt(show.author || 'Anoncast').up()
          .ele('itunes:email').txt('nbaronia@gmail.com').up() // Your email for Spotify verification
        .up()
        .ele('itunes:image', { href: show.image_url || 'https://anoncast.xyz/logo.png' }).up() // Need a real URL here eventually
        .ele('itunes:category', { text: 'Technology' }).up()

    // Add episodes to feed
    episodes.forEach((episode: any) => {
      const item = feed.ele('item')
        .ele('title').txt(episode.title).up()
        .ele('description').txt(episode.description || '').up()
        .ele('pubDate').txt(new Date(episode.published_at).toUTCString()).up()
        .ele('guid', { isPermaLink: 'false' }).txt(episode.id).up()
        .ele('itunes:author').txt(show.author || 'Anoncast').up()
        .ele('itunes:duration').txt(episode.duration?.toString() || '0').up()
        .ele('enclosure', {
          url: episode.audio_url,
          length: episode.file_size?.toString() || '0',
          type: 'audio/mpeg'
        }).up()
      item.up();
    });

    const xml = feed.end({ prettyPrint: true });

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
      },
    });
  } catch (error) {
    console.error('RSS Feed Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
