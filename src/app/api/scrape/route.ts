import { NextRequest, NextResponse } from 'next/server';
import { scrapeUrl } from '@/lib/scraper';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Basic URL validation
    let normalizedUrl = url;
    try {
      const urlObj = new URL(url);
      // Remove trailing slash and normalize
      normalizedUrl = urlObj.origin + urlObj.pathname.replace(/\/$/, '') + urlObj.search;
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Check for existing episode with this source_url
    try {
      // Check for exact match or normalized match
      const { data: existingEpisode } = await supabase
        .from('episodes')
        .select('*')
        .or(`source_url.eq."${url}",source_url.eq."${normalizedUrl}"`)
        .order('published_at', { ascending: false })
        .limit(1)
        .single();

      if (existingEpisode) {
        console.log(`Found existing episode for URL: ${url}`);
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          episode: existingEpisode
        });
      }
    } catch (e) {
      // Ignore error and proceed to scrape if check fails (e.g. column missing)
      console.log('Existing episode check failed or no match found:', e);
    }

    // Scrape the URL
    const content = await scrapeUrl(url);

    // Validate we got meaningful content
    if (content.paragraphs.length === 0) {
      return NextResponse.json(
        { error: 'Could not extract content from this URL. The page may be dynamically loaded or require authentication.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: content
    });

  } catch (error) {
    console.error('Scraping error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: `Failed to scrape URL: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Also support GET for simple testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required. Usage: /api/scrape?url=https://example.com/article' },
      { status: 400 }
    );
  }

  // Redirect to POST handler logic
  let normalizedUrl = url;
  try {
    const urlObj = new URL(url);
    normalizedUrl = urlObj.origin + urlObj.pathname.replace(/\/$/, '') + urlObj.search;
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format' },
      { status: 400 }
    );
  }

  try {
    // Check for existing episode
    const { data: existingEpisode } = await supabase
      .from('episodes')
      .select('*')
      .or(`source_url.eq."${url}",source_url.eq."${normalizedUrl}"`)
      .order('published_at', { ascending: false })
      .limit(1)
      .single();

    if (existingEpisode) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        episode: existingEpisode
      });
    }

    const content = await scrapeUrl(url);

    if (content.paragraphs.length === 0) {
      return NextResponse.json(
        { error: 'Could not extract content from this URL.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: content
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to scrape URL: ${errorMessage}` },
      { status: 500 }
    );
  }
}
