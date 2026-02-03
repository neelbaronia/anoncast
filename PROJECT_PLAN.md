# Anoncast - Blog to Podcast Converter

> Transform any blog into a listenable podcast with AI-powered voice synthesis

---

## 🎯 Project Overview

A web platform that allows bloggers to convert their written content into audio podcasts, automatically generating RSS feeds compatible with Spotify, Apple Podcasts, and other podcast platforms.

### Core Value Proposition
- **For Bloggers**: Expand reach by making content accessible to audio-first audiences
- **For Listeners**: Consume blog content during commutes, workouts, or while multitasking

---

## 🚧 Next Steps (Immediate TODO)

> **Last updated:** Jan 31, 2026

### Next Tasks
- [ ] **Vercel Deployment & Production Migration**
  - Deploy Next.js app to Vercel
  - Configure production domain (Namecheap)
  - Switch Stripe to production (live) keys
- [ ] **Dynamic Scraping Upgrade**
  - Integrate Puppeteer/Playwright for Notion/Substack support
- [ ] **Search & Discovery**
  - Implement search functionality for the Generated Episodes list
- [ ] **User Accounts & Storage**
  - Supabase Auth integration

### Completed
- [x] Frontend prototype with conversion flow UI
- [x] Voice assignment interface with color-coded paragraphs
- [x] Stripe integration (Sandbox/Test mode)
- [x] ElevenLabs audio generation and concatenation
- [x] Real-time audio playback and export
- [x] Blog scraping for static sites (Cheerio)
- [x] Custom ElevenLabs voice support (ID/Link parsing)
- [x] Cloudflare R2 permanent audio storage
- [x] Supabase metadata persistence
- [x] RSS 2.0 dynamic feed generation (/api/feed/[showId])
- [x] Redesigned Generated Episodes header with top-aligned show art and title

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    (Next.js + React)                            │
├─────────────────────────────────────────────────────────────────┤
│  Landing Page  │  Dashboard  │  Episode Manager  │  RSS Preview │
└────────────────┴─────────────┴──────────────────┴───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                              │
│                    (Next.js API Routes)                         │
├─────────────────────────────────────────────────────────────────┤
│  /api/scrape    │  /api/generate  │  /api/podcast  │  /api/rss  │
└────────────────┴────────────────┴───────────────┴───────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Web Scraper   │  │   TTS Engine    │  │   RSS Builder   │
│   (Cheerio/     │  │   (ElevenLabs/  │  │   (podcast-     │
│    Puppeteer)   │  │    OpenAI TTS)  │  │    feed-gen)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         STORAGE                                  │
├─────────────────────────────────────────────────────────────────┤
│  Database (Postgres/Supabase)  │  Audio Files (S3/Cloudflare R2)│
└────────────────────────────────┴────────────────────────────────┘
```

---

## 🔧 Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | UI component library |
| **React Query** | Data fetching & caching |
| **Zustand** | State management |

### Backend
| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | REST API endpoints |
| **Cheerio** | HTML parsing for blog content extraction |
| **Puppeteer** | Dynamic content scraping (SPAs) |
| **Bull/BullMQ** | Job queue for audio generation |
| **Redis** | Queue storage & caching |

### AI/Voice
| Technology | Purpose |
|------------|---------|
| **ElevenLabs API** | Primary TTS (high quality, natural voices) |
| **OpenAI TTS** | Alternative TTS option |
| **Deepgram** | Optional: speech-to-text for transcripts |

### Storage & Database
| Technology | Purpose |
|------------|---------|
| **Supabase** | PostgreSQL database + Auth |
| **Cloudflare R2** | Audio file storage (S3-compatible, cheaper) |
| **Upstash Redis** | Serverless Redis for queues |

### Podcast Distribution
| Technology | Purpose |
|------------|---------|
| **podcast-feed-parser** | RSS feed generation |
| **Spotify for Podcasters API** | Direct Spotify integration |

---

## 📋 Feature Breakdown

### Phase 1: MVP (Week 1-2)
- [ ] **User Authentication**
  - Email/password signup via Supabase Auth
  - OAuth (Google, GitHub)
  
- [ ] **Blog Scraping**
  - Paste URL → extract article content
  - Support major blog platforms (Medium, Substack, WordPress, Ghost)
  - Handle images → convert to alt text descriptions
  
- [ ] **Text-to-Speech Conversion**
  - Clean/preprocess text for natural reading
  - Generate audio via ElevenLabs
  - Store audio files in R2
  
- [ ] **Basic Dashboard**
  - View all converted episodes
  - Play audio preview
  - Download MP3

### Phase 2: Podcast Features (Week 3-4)
- [ ] **Podcast/Show Management**
  - Create podcast "shows" (name, description, artwork)
  - Organize episodes under shows
  
- [ ] **RSS Feed Generation**
  - Generate valid RSS 2.0 podcast feed
  - Include iTunes/Spotify required tags
  - Public RSS URL for each show
  
- [ ] **Spotify Integration**
  - Guide for submitting RSS to Spotify
  - Optional: Direct API submission
  
- [ ] **Episode Customization**
  - Edit episode title/description
  - Choose voice (male/female, different styles)
  - Adjust reading speed

### Phase 3: Advanced Features (Week 5-6)
- [ ] **Automatic Imports**
  - Connect RSS feed of blog → auto-import new posts
  - Webhook support for real-time updates
  
- [ ] **Audio Enhancement**
  - Add intro/outro music
  - Background music options
  - Audio normalization
  
- [ ] **Analytics**
  - Listen counts per episode
  - Subscriber counts
  - Geographic distribution
  
- [ ] **Monetization**
  - Credit-based system (2x pass-through)
  - Stripe integration for credit purchases
  - Usage dashboard showing credits remaining

---

## 📁 Project Structure

```
anoncast/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── episodes/
│   │   │   ├── shows/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── scrape/
│   │   │   ├── generate/
│   │   │   ├── episodes/
│   │   │   ├── shows/
│   │   │   └── rss/[showId]/
│   │   ├── feed/[showId]/
│   │   │   └── route.ts          # Public RSS endpoint
│   │   └── page.tsx              # Landing page
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── url-input.tsx
│   │   ├── episode-card.tsx
│   │   ├── audio-player.tsx
│   │   └── voice-selector.tsx
│   │
│   ├── lib/
│   │   ├── scraper/
│   │   │   ├── index.ts
│   │   │   ├── extractors/
│   │   │   │   ├── medium.ts
│   │   │   │   ├── substack.ts
│   │   │   │   └── generic.ts
│   │   │   └── text-cleaner.ts
│   │   ├── tts/
│   │   │   ├── elevenlabs.ts
│   │   │   └── openai.ts
│   │   ├── storage/
│   │   │   └── r2.ts
│   │   ├── rss/
│   │   │   └── generator.ts
│   │   └── db/
│   │       ├── schema.ts
│   │       └── queries.ts
│   │
│   └── types/
│       └── index.ts
│
├── public/
├── .env.local
├── package.json
└── README.md
```

---

## 🗄️ Database Schema

```sql
-- Users (handled by Supabase Auth)

-- Shows (Podcasts)
CREATE TABLE shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  artwork_url TEXT,
  rss_slug VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Episodes
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES shows(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source_url TEXT,
  original_text TEXT,
  audio_url TEXT,
  audio_duration INTEGER,  -- seconds
  voice_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Voice Preferences
CREATE TABLE user_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  voice_provider VARCHAR(50),  -- elevenlabs, openai
  voice_id VARCHAR(100),
  voice_name VARCHAR(100),
  is_default BOOLEAN DEFAULT false
);

-- Credit Balance
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  balance BIGINT DEFAULT 0,  -- characters remaining
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit Transactions
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type VARCHAR(50),           -- 'purchase', 'usage', 'refund', 'bonus'
  amount BIGINT,              -- positive for additions, negative for usage
  episode_id UUID REFERENCES episodes(id),  -- null for purchases
  stripe_payment_id VARCHAR(255),           -- null for usage
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 API Endpoints

### Scraping
```
POST /api/scrape
Body: { url: string }
Response: { title, content, author, publishedAt, wordCount }
```

### Audio Generation
```
POST /api/generate
Body: { 
  episodeId: string,
  text: string, 
  voiceId: string,
  speed?: number 
}
Response: { jobId: string }

GET /api/generate/status/:jobId
Response: { status, progress, audioUrl? }
```

### Episodes
```
GET    /api/episodes           # List user's episodes
POST   /api/episodes           # Create new episode
GET    /api/episodes/:id       # Get episode details
PATCH  /api/episodes/:id       # Update episode
DELETE /api/episodes/:id       # Delete episode
```

### Shows
```
GET    /api/shows              # List user's shows
POST   /api/shows              # Create new show
GET    /api/shows/:id          # Get show details
PATCH  /api/shows/:id          # Update show
DELETE /api/shows/:id          # Delete show
```

### RSS
```
GET /feed/:showSlug            # Public RSS feed
GET /api/rss/:showId/validate  # Validate RSS feed
```

### Credits
```
GET  /api/credits              # Get user's credit balance
POST /api/credits/purchase     # Create Stripe checkout session
POST /api/webhooks/stripe      # Handle Stripe payment webhooks
```

---

## 🎨 UI/UX Design Notes

### Landing Page
- Hero: "Turn Your Blog Into a Podcast in 60 Seconds"
- Demo: Paste URL → See preview → Hear sample
- Social proof: "1000+ blogs converted"
- Pricing comparison

### Dashboard
- Clean, minimal design (similar to Spotify for Creators)
- Quick action: "Convert New Post" prominent
- Episode list with status badges
- Audio waveform previews

### Color Palette (Dark Theme)
```css
--background: #0a0a0b;
--card: #141415;
--primary: #22c55e;       /* Green accent */
--primary-hover: #16a34a;
--muted: #71717a;
--border: #27272a;
```

---

## 🔐 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# OpenAI (backup TTS)
OPENAI_API_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 💰 Pricing Model: Pass-Through (2x Cost)

### ElevenLabs Pricing (our cost)
| Plan | Characters/Month | Cost | Per Character |
|------|------------------|------|---------------|
| Starter | 30,000 | $5 | $0.000167 |
| Creator | 100,000 | $22 | $0.00022 |
| Pro | 500,000 | $99 | $0.000198 |
| Scale | 2,000,000 | $330 | $0.000165 |

### Our Pricing (2x pass-through)
| Usage | Our Cost | User Pays | Our Margin |
|-------|----------|-----------|------------|
| 10,000 chars (~2,000 words) | ~$0.18 | ~$0.36 | $0.18 |
| 50,000 chars (~10,000 words) | ~$0.90 | ~$1.80 | $0.90 |
| 100,000 chars (~20,000 words) | ~$1.80 | ~$3.60 | $1.80 |

### Implementation
- **Credit-based system**: Users buy credits upfront
- **Credit packages**:
  - $5 → 25,000 characters (~5 blog posts)
  - $20 → 110,000 characters (~22 blog posts) *10% bonus*
  - $50 → 300,000 characters (~60 blog posts) *20% bonus*
- **Pay-as-you-go**: Charge per character after credits depleted
- **Transparent**: Show character count before generation

### Why This Works
- ✅ Simple to explain: "We charge 2x our costs"
- ✅ No subscription fatigue
- ✅ Users only pay for what they use
- ✅ Scales with usage naturally
- ✅ 50% margin covers infrastructure + growth

---

## 📅 Development Timeline

### Week 1
- [ ] Project setup (Next.js, Tailwind, Supabase)
- [ ] Authentication flow
- [ ] Basic scraper for Medium/Substack
- [ ] ElevenLabs integration

### Week 2
- [ ] Dashboard UI
- [ ] Episode management
- [ ] Audio player component
- [ ] File storage (R2)

### Week 3
- [ ] Show/podcast creation
- [ ] RSS feed generation
- [ ] Voice selection UI
- [ ] Episode editing

### Week 4
- [ ] Polish & bug fixes
- [ ] Landing page
- [ ] Spotify submission guide
- [ ] Beta launch 🚀

---

## 🚀 Launch Checklist

- [ ] RSS feed validates with [Podbase](https://podba.se/validate/)
- [ ] Spotify for Podcasters submission
- [ ] Apple Podcasts submission
- [ ] Analytics integration
- [ ] Error monitoring (Sentry)
- [ ] Terms of Service / Privacy Policy
- [ ] Blog post announcing launch

---

## 🤔 Open Questions

1. **Voice cloning?** - Should users be able to clone their own voice?
2. **Multi-language?** - Support for non-English blogs?
3. **Collaboration?** - Multiple users per podcast?
4. **Mobile app?** - Native app or PWA sufficient?

---

## 📚 Resources & References

- [ElevenLabs API Docs](https://docs.elevenlabs.io/)
- [Spotify RSS Requirements](https://podcasters.spotify.com/support/articles/rss-feed-requirements)
- [Apple Podcast RSS Spec](https://podcasters.apple.com/support/823-podcast-requirements)
- [RSS 2.0 Specification](https://www.rssboard.org/rss-specification)

---

*Last updated: January 31, 2026*
e