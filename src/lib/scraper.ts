import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright';

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

function calculateReadTime(wordCount: number): string {
  const wordsPerMinute = 200;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min read`;
}

async function fetchWithBrowserbase(url: string, retryCount = 0): Promise<{ html: string; browserText: string; featuredImage: string | null }> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn('BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID not set');
    throw new Error('Headless browser required but Browserbase credentials missing');
  }

  const bb = new Browserbase({
    apiKey,
  });

  let browser = null;
  let sessionId: string | null = null;

  try {
    // 1. Create a session
    const session = await bb.sessions.create({
      projectId,
      proxies: false,
    });
    sessionId = session.id;

    console.log(`Created Browserbase session: ${sessionId}`);

    // 2. Connect using Playwright with timeout
    const connectUrl = `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`;
    
    // Add a connection timeout
    const connectionPromise = chromium.connectOverCDP(connectUrl);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 15000)
    );
    
    browser = await Promise.race([connectionPromise, timeoutPromise]) as any;

    // 3. Get the default context and page
    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0] || await defaultContext.newPage();

    // 4. Navigate to the URL with a more lenient wait strategy
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Check if this is a Notion page by inspecting the actual page content
    const isNotion = await page.evaluate(() => {
      return document.documentElement.classList.contains('notion-html') ||
             document.querySelector('[data-notion-html]') !== null ||
             document.body?.classList.contains('notion-body') !== undefined ||
             window.location.hostname.includes('notion');
    });
    
    console.log(`Is Notion page: ${isNotion}`);

    if (isNotion) {
      console.log('Detected Notion page, waiting for content to load...');
      try {
        // Wait for either Notion blocks or significant body content
        await page.waitForSelector('[data-block-id], .notion-page-content', { timeout: 15000 });
        console.log('Notion selector found, waiting for content to render...');
        // Give Notion extra time to fully render all content
        await page.waitForTimeout(5000);
      } catch (e) {
        console.log('Notion selector wait failed, trying general wait...');
        await page.waitForTimeout(8000);
      }
    } else {
      // Wait a bit for JavaScript to execute
      await page.waitForTimeout(3000);
    }

    // 5. Get the HTML content AND extract text directly
    const html = await page.content();
    console.log(`Fetched HTML, length: ${html.length}`);
    
    // Get the rendered text content directly from the browser, preserving paragraph structure
    const browserText = await page.evaluate(() => {
      const textBlocks: string[] = [];
      const seenTexts = new Set<string>();
      
      // Strategy: Only get LEAF-level text blocks (blocks that don't contain other blocks)
      // This prevents parent blocks from duplicating child content
      
      // For Notion pages: get leaf-level [data-block-id] elements
      const notionBlocks = document.querySelectorAll('[data-block-id]');
      if (notionBlocks.length > 0) {
        notionBlocks.forEach(block => {
          // Only get leaf blocks (no child blocks inside)
          const hasChildBlocks = block.querySelector('[data-block-id]');
          if (hasChildBlocks) return; // Skip parent blocks
          
          const text = block.textContent?.trim();
          if (text && text.length > 10 && !seenTexts.has(text)) {
            seenTexts.add(text);
            textBlocks.push(text);
          }
        });
      }
      
      // If Notion blocks didn't give us enough, try standard HTML elements
      if (textBlocks.length < 3) {
        const elements = document.querySelectorAll('p, h1, h2, h3, h4, blockquote, li');
        elements.forEach(el => {
          // Skip if inside nav, header, footer
          if (el.closest('nav, header, footer, .sidebar, .comments')) return;
          
          const text = el.textContent?.trim();
          if (text && text.length > 10 && !seenTexts.has(text)) {
            seenTexts.add(text);
            textBlocks.push(text);
          }
        });
      }
      
      // If we got structured blocks, return them joined with double newlines
      if (textBlocks.length > 0) {
        return textBlocks.join('\n\n');
      }
      
      // Otherwise fall back to innerText (preserves visual line breaks)
      return document.body?.innerText || '';
    });
    console.log(`Body text from browser: ${browserText.length} chars`);
    
    // Extract the first meaningful image from the page
    const featuredImage = await page.evaluate(() => {
      // Look for og:image first
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImage) return ogImage;
      
      // Look for the first large image in the content
      const images = document.querySelectorAll('img');
      for (const img of Array.from(images)) {
        const src = img.src || img.getAttribute('data-src');
        // Skip small images (likely icons or avatars)
        if (src && img.naturalWidth > 200 && img.naturalHeight > 200) {
          return src;
        }
      }
      
      // Fallback to first image with reasonable src
      for (const img of Array.from(images)) {
        const src = img.src || img.getAttribute('data-src');
        if (src && !src.includes('icon') && !src.includes('avatar') && !src.includes('logo')) {
          return src;
        }
      }
      
      return null;
    });
    console.log(`Featured image: ${featuredImage || 'none found'}`);

    return { html, browserText, featuredImage };
  } catch (error: any) {
    console.error('Browserbase fetch error:', error);
    
    // Handle rate limiting
    if (error?.message?.includes('429') && retryCount < 2) {
      console.log(`Browserbase rate limited (429), retrying in 5s... (Attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return fetchWithBrowserbase(url, retryCount + 1);
    }
    throw new Error(`Browserbase error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // Cleanup: Close browser connection
    if (browser) {
      try {
        await browser.close();
        console.log('Browser connection closed');
      } catch (e) {
        console.warn('Failed to close browser:', e);
      }
    }
  }
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  let html = '';
  let browserText = ''; // Store text extracted directly from browser
  let browserImage: string | null = null; // Store image extracted from browser
  
  try {
    // Attempt 1: Static Fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      }
    });
    
    if (response.ok) {
      html = await response.text();
      console.log(`Static fetch successful, HTML length: ${html.length}`);
      
      // Only use Browserbase if we get very little HTML or clear signs of JS-only rendering
      const needsBrowser = (
        html.length < 2000 || 
        (html.includes('JavaScript must be enabled') || html.includes('enable JavaScript')) ||
        (html.includes('id="app"') && html.length < 5000) ||
        (html.includes('id="root"') && html.length < 5000)
      );

      if (needsBrowser) {
        console.log(`Site requires JavaScript rendering, trying Browserbase...`);
        const result = await fetchWithBrowserbase(url);
        html = result.html;
        browserText = result.browserText;
        browserImage = result.featuredImage;
        console.log(`Browserbase fetch successful, HTML length: ${html.length}, browser text: ${browserText.length}`);
      }
    } else {
      console.log(`Static fetch failed (${response.status}), trying Browserbase...`);
      const result = await fetchWithBrowserbase(url);
      html = result.html;
      browserText = result.browserText;
      browserImage = result.featuredImage;
    }
  } catch (error) {
    console.log('Static fetch error, falling back to Browserbase:', error);
    const result = await fetchWithBrowserbase(url);
    html = result.html;
    browserText = result.browserText;
    browserImage = result.featuredImage;
  }

  // Use Readability to extract metadata (title, author) from HTML
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document.cloneNode(true) as any);
  let article = reader.parse();

  let paragraphs: string[] = [];
  let title = 'Untitled';
  let author = 'Unknown Author';
  let textContent = '';

  // Extract title and author from Readability or DOM
  if (article) {
    title = article.title || 'Untitled';
    author = article.byline || 'Unknown Author';
  }
  if (title === 'Untitled') {
    const doc = dom.window.document;
    title = doc.querySelector('h1')?.textContent?.trim() || 
            doc.querySelector('title')?.textContent?.trim() || 
            'Untitled';
  }

  // PRIORITY 1: Use browserText if available (best paragraph structure from rendered page)
  if (browserText && browserText.length > 200) {
    console.log(`Using browser-extracted text for paragraphs: ${browserText.length} chars`);
    
    // browserText is already split by \n\n between blocks
    const textBlocks = browserText
      .split(/\n\n+/)
      .map(t => t.replace(/\s+/g, ' ').trim())
      .filter(t => {
        if (t.length < 20) return false;
        // Filter out navigation/UI chrome
        const lower = t.toLowerCase();
        if (/^(menu|navigation|footer|header|sidebar|cookie|subscribe|sign up|log in|share|search)/i.test(lower.slice(0, 30))) return false;
        return true;
      });
    
    console.log(`Browser text split into ${textBlocks.length} paragraphs`);
    paragraphs = textBlocks;
    textContent = textBlocks.join('\n\n');
  }
  // PRIORITY 2: Use Readability textContent
  else if (article && article.textContent && article.textContent.length > 500) {
    console.log('Using Readability for paragraph extraction');
    textContent = article.textContent;
    paragraphs = textContent
      .split(/\n\n+|\n(?=[A-Z])/)  // Split on double newlines OR single newline before capital letter
      .map(p => p.trim())
      .filter(p => p.length > 30);
    
    // If we got too few paragraphs (text may be joined), try splitting on single newlines
    if (paragraphs.length < 3 && textContent.length > 1000) {
      paragraphs = textContent
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 30);
    }
    console.log(`Readability extracted ${paragraphs.length} paragraphs`);
  }
  // PRIORITY 3: Manual DOM extraction fallback
  else {
    console.log('Readability and browserText insufficient, using manual DOM extraction...');
    const doc = dom.window.document;
    
    const parts: string[] = [];
    const seenTexts = new Set<string>();
    
    // Get leaf-level content elements
    const elements = doc.querySelectorAll('p, blockquote, h1, h2, h3, h4, li, article p, main p');
    elements.forEach((el: any) => {
      // Skip nav/footer elements
      if (el.closest && el.closest('nav, header, footer, .sidebar, .comments')) return;
      
      let text = el.textContent?.trim().replace(/\s+/g, ' ');
      if (!text || text.length < 20) return;
      if (seenTexts.has(text)) return;
      
      seenTexts.add(text);
      parts.push(text);
    });
    
    paragraphs = parts;
    textContent = parts.join('\n\n');
    console.log(`Manual extraction: ${paragraphs.length} paragraphs, ${textContent.length} chars`);
  }

  if (paragraphs.length === 0) {
    throw new Error('Could not extract any content from this page');
  }

  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

  let platform = 'Custom';
  if (url.includes('medium.com')) platform = 'Medium';
  else if (url.includes('substack.com')) platform = 'Substack';
  else if (url.includes('wordpress.com')) platform = 'WordPress';
  else if (url.includes('ghost.io')) platform = 'Ghost';
  else if (html.includes('wp-content')) platform = 'WordPress';

  return {
    title: title || 'Untitled',
    author: author || 'Unknown Author',
    publishDate: null, 
    featuredImage: browserImage || (dom.window.document.querySelector('meta[property="og:image"]') as any)?.content || null,
    content: textContent,
    paragraphs,
    wordCount,
    estimatedReadTime: calculateReadTime(wordCount),
    platform,
    url
  };
}


