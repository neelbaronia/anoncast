import { NextRequest, NextResponse } from 'next/server';
import { scrapeUrl } from '@/lib/scraper';

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
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
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
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format' },
      { status: 400 }
    );
  }

  try {
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
