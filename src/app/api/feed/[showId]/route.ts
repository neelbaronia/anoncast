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
    // Prepare show image URL with proper formatting
    const showImageUrl = (show.image_url || 'https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/Anoncast.jpg').trim();
    const formattedShowImageUrl = showImageUrl.replace(/\.png$/i, '.jpg');
    
    const feed = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('rss', { 
        version: '2.0', 
        'xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        'xmlns:content': 'http://purl.org/rss/1.0/modules/content/'
      })
      .ele('channel')
        .ele('title').txt(show.title).up()
        .ele('description').txt(show.description || show.title).up()
        .ele('link').txt('https://www.anoncast.net').up()
        .ele('language').txt('en-us').up()
        .ele('itunes:author').txt('anoncast.net').up()
        .ele('itunes:owner')
          .ele('itunes:name').txt('anoncast.net').up()
          .ele('itunes:email').txt('nbaronia@gmail.com').up()
        .up()
        .ele('itunes:image', { href: formattedShowImageUrl }).up()
        .ele('itunes:category', { text: 'Technology' }).up()
        .ele('itunes:explicit').txt('no').up()
        .ele('itunes:type').txt('episodic').up()
        .ele('itunes:summary').txt(show.description || show.title).up()

    // Add episodes to feed
    episodes.forEach((episode: any) => {
      // Determine the episode image URL, ensuring it's properly formatted
      const episodeImageUrl = (episode.image_url || show.image_url || 'https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/Anoncast.jpg').trim();
      // Ensure the URL uses .jpg extension (Apple Podcasts prefers JPG)
      const formattedImageUrl = episodeImageUrl.replace(/\.png$/i, '.jpg');
      
      const item = feed.ele('item')
        .ele('title').txt(episode.title).up()
        .ele('description').txt(episode.description || episode.title).up()
        .ele('itunes:summary').txt(episode.description || episode.title).up()
        .ele('pubDate').txt(new Date(episode.published_at).toUTCString()).up()
        .ele('guid', { isPermaLink: 'false' }).txt(episode.id).up()
        .ele('itunes:author').txt('anoncast.net').up()
        .ele('itunes:duration').txt(episode.duration?.toString() || '0').up()
        .ele('itunes:explicit').txt('no').up();
      
      // Add episode image using itunes:image (Apple Podcasts standard)
      if (formattedImageUrl) {
        item.ele('itunes:image', { href: formattedImageUrl }).up();
      }
      
      item.ele('enclosure', {
          url: (episode.audio_url || '').trim(),
          length: (episode.file_size || (episode.duration * 16000) || 0).toString(),
          type: 'audio/mpeg'
        }).up();
      
      item.up();
    });

    const xml = feed.end({ prettyPrint: true });

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('RSS Feed Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
