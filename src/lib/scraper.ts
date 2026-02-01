import { load, CheerioAPI } from 'cheerio';

export interface ScrapedContent {
  title: string;
  author: string;
  publishDate: string | null;
  featuredImage: string | null;
  content: string;
  paragraphs: string[];
  wordCount: number;
  estimatedReadTime: string;
  platform: string;
  url: string;
}

interface PlatformScraper {
  detect: (url: string, $: CheerioAPI) => boolean;
  scrape: (url: string, $: CheerioAPI) => Partial<ScrapedContent>;
}

// Medium scraper
const mediumScraper: PlatformScraper = {
  detect: (url: string) => {
    return url.includes('medium.com') || url.includes('.medium.com');
  },
  scrape: (url: string, $: CheerioAPI) => {
    const title = $('h1').first().text().trim() || 
                  $('article h1').text().trim() ||
                  $('meta[property="og:title"]').attr('content') || '';
    
    const author = $('a[rel="author"]').text().trim() ||
                   $('meta[name="author"]').attr('content') ||
                   $('[data-testid="authorName"]').text().trim() || '';
    
    const publishDate = $('time').attr('datetime') ||
                        $('meta[property="article:published_time"]').attr('content') || null;
    
    const featuredImage = $('meta[property="og:image"]').attr('content') ||
                          $('article img').first().attr('src') || null;
    
    // Medium article content is in <article> with specific structure
    const articleElement = $('article');
    const contentParagraphs: string[] = [];
    
    articleElement.find('p, h2, h3, blockquote').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        contentParagraphs.push(text);
      }
    });
    
    return {
      title,
      author,
      publishDate,
      featuredImage,
      paragraphs: contentParagraphs,
      platform: 'Medium'
    };
  }
};

// Substack scraper
const substackScraper: PlatformScraper = {
  detect: (url: string) => {
    return url.includes('substack.com') || url.includes('.substack.com');
  },
  scrape: (url: string, $: CheerioAPI) => {
    const title = $('h1.post-title').text().trim() ||
                  $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') || '';
    
    const author = $('.author-name').text().trim() ||
                   $('meta[name="author"]').attr('content') ||
                   $('.publication-name').text().trim() || '';
    
    const publishDate = $('time').attr('datetime') ||
                        $('meta[property="article:published_time"]').attr('content') || null;
    
    const featuredImage = $('meta[property="og:image"]').attr('content') ||
                          $('.post-hero img').attr('src') || null;
    
    const contentParagraphs: string[] = [];
    
    // Substack content is typically in .body or .post-content
    $('.body p, .body h2, .body h3, .body blockquote, .post-content p, .post-content h2, .post-content h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        contentParagraphs.push(text);
      }
    });
    
    return {
      title,
      author,
      publishDate,
      featuredImage,
      paragraphs: contentParagraphs,
      platform: 'Substack'
    };
  }
};

// WordPress scraper
const wordpressScraper: PlatformScraper = {
  detect: (url: string, $: CheerioAPI) => {
    // Check for WordPress meta tags or common WordPress patterns
    return $('meta[name="generator"]').attr('content')?.includes('WordPress') ||
           $('link[rel="https://api.w.org/"]').length > 0 ||
           $('.wp-content').length > 0 ||
           $('body').hasClass('wordpress');
  },
  scrape: (url: string, $: CheerioAPI) => {
    const title = $('h1.entry-title').text().trim() ||
                  $('h1.post-title').text().trim() ||
                  $('article h1').text().trim() ||
                  $('meta[property="og:title"]').attr('content') || '';
    
    const author = $('.author a').text().trim() ||
                   $('meta[name="author"]').attr('content') ||
                   $('.entry-author').text().trim() || '';
    
    const publishDate = $('time.entry-date').attr('datetime') ||
                        $('meta[property="article:published_time"]').attr('content') || null;
    
    const featuredImage = $('meta[property="og:image"]').attr('content') ||
                          $('.wp-post-image').attr('src') ||
                          $('article img').first().attr('src') || null;
    
    const contentParagraphs: string[] = [];
    
    // WordPress content selectors
    $('.entry-content p, .entry-content h2, .entry-content h3, .post-content p, article p, article h2, article h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        contentParagraphs.push(text);
      }
    });
    
    return {
      title,
      author,
      publishDate,
      featuredImage,
      paragraphs: contentParagraphs,
      platform: 'WordPress'
    };
  }
};

// Ghost scraper
const ghostScraper: PlatformScraper = {
  detect: (url: string, $: CheerioAPI) => {
    return $('meta[name="generator"]').attr('content')?.includes('Ghost') ||
           $('link[rel="icon"]').attr('href')?.includes('ghost') ||
           $('.gh-content').length > 0;
  },
  scrape: (url: string, $: CheerioAPI) => {
    const title = $('h1.article-title').text().trim() ||
                  $('h1.post-full-title').text().trim() ||
                  $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') || '';
    
    const author = $('.author-name').text().trim() ||
                   $('meta[name="author"]').attr('content') ||
                   $('.post-full-meta-date a').text().trim() || '';
    
    const publishDate = $('time').attr('datetime') ||
                        $('meta[property="article:published_time"]').attr('content') || null;
    
    const featuredImage = $('meta[property="og:image"]').attr('content') ||
                          $('.post-full-image img').attr('src') ||
                          $('.article-image img').attr('src') || null;
    
    const contentParagraphs: string[] = [];
    
    // Ghost content selectors
    $('.post-content p, .post-content h2, .post-content h3, .gh-content p, .gh-content h2, .gh-content h3, .article-content p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        contentParagraphs.push(text);
      }
    });
    
    return {
      title,
      author,
      publishDate,
      featuredImage,
      paragraphs: contentParagraphs,
      platform: 'Ghost'
    };
  }
};

// Generic fallback scraper
const genericScraper: PlatformScraper = {
  detect: () => true, // Always matches as fallback
  scrape: (url: string, $: CheerioAPI) => {
    // Try common title patterns
    const title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('title').text().trim() || '';
    
    // Try common author patterns
    const author = $('meta[name="author"]').attr('content') ||
                   $('[rel="author"]').text().trim() ||
                   $('[class*="author"]').first().text().trim() ||
                   $('[itemprop="author"]').text().trim() || '';
    
    const publishDate = $('meta[property="article:published_time"]').attr('content') ||
                        $('time').first().attr('datetime') ||
                        $('[itemprop="datePublished"]').attr('content') || null;
    
    const featuredImage = $('meta[property="og:image"]').attr('content') ||
                          $('article img').first().attr('src') ||
                          $('main img').first().attr('src') || null;
    
    const contentParagraphs: string[] = [];
    
    // Try to find the main content area
    const mainContent = $('article').length ? $('article') :
                        $('main').length ? $('main') :
                        $('.content').length ? $('.content') :
                        $('[class*="post"]').first().length ? $('[class*="post"]').first() :
                        $('body');
    
    // First try standard paragraph tags
    mainContent.find('p, h2, h3, h4').each((_, el) => {
      const text = $(el).text().trim();
      // Filter out very short paragraphs and navigation/footer text
      if (text && text.length > 20 && !text.includes('©') && !text.includes('cookie')) {
        contentParagraphs.push(text);
      }
    });
    
    // If no paragraphs found, try extracting from font tags or raw text (legacy HTML like paulgraham.com)
    if (contentParagraphs.length === 0) {
      // Look for font tags (legacy HTML)
      const fontContent = mainContent.find('font[size="2"]');
      if (fontContent.length > 0) {
        // Get the HTML and split by <br><br> patterns
        let html = fontContent.html() || '';
        // Clean up the HTML - remove tags and split by double line breaks
        html = html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?[^>]+(>|$)/g, ' ')  // Remove remaining HTML tags
          .replace(/\s+/g, ' ');  // Normalize whitespace
        
        // Split into paragraphs by double newlines
        const parts = html.split(/\n\s*\n/);
        for (const part of parts) {
          const text = part.trim();
          if (text && text.length > 50 && !text.includes('©')) {
            contentParagraphs.push(text);
          }
        }
      }
      
      // If still no content, try table cells (some legacy sites use tables for layout)
      if (contentParagraphs.length === 0) {
        mainContent.find('td').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 100 && !text.includes('©')) {
            // Split long text blocks by sentences into reasonable paragraphs
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
            let paragraph = '';
            for (const sentence of sentences) {
              paragraph += sentence.trim() + ' ';
              // Create a new paragraph every ~500 chars
              if (paragraph.length > 500) {
                contentParagraphs.push(paragraph.trim());
                paragraph = '';
              }
            }
            if (paragraph.trim().length > 50) {
              contentParagraphs.push(paragraph.trim());
            }
          }
        });
      }
    }
    
    return {
      title,
      author,
      publishDate,
      featuredImage,
      paragraphs: contentParagraphs,
      platform: 'Custom'
    };
  }
};

// Ordered list of scrapers (most specific first)
const scrapers: PlatformScraper[] = [
  mediumScraper,
  substackScraper,
  ghostScraper,
  wordpressScraper,
  genericScraper
];

function calculateReadTime(wordCount: number): string {
  const wordsPerMinute = 200;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min read`;
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  // Fetch the HTML
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = load(html);
  
  // Find the appropriate scraper
  let scraperResult: Partial<ScrapedContent> = {};
  let detectedPlatform = 'Custom';
  
  for (const scraper of scrapers) {
    if (scraper.detect(url, $)) {
      scraperResult = scraper.scrape(url, $);
      detectedPlatform = scraperResult.platform || 'Custom';
      break;
    }
  }
  
  // Deduplicate paragraphs (some pages have the same content in multiple places)
  const rawParagraphs = scraperResult.paragraphs || [];
  const seen = new Set<string>();
  const paragraphs = rawParagraphs.filter(p => {
    // Normalize for comparison (trim and lowercase)
    const normalized = p.trim().toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
  
  // Combine paragraphs into full content
  const content = paragraphs.join('\n\n');
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  
  return {
    title: scraperResult.title || 'Untitled',
    author: scraperResult.author || 'Unknown Author',
    publishDate: scraperResult.publishDate || null,
    featuredImage: scraperResult.featuredImage || null,
    content,
    paragraphs,
    wordCount,
    estimatedReadTime: calculateReadTime(wordCount),
    platform: detectedPlatform,
    url
  };
}
