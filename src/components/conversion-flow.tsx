"use client";

import React, { useState, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Link, 
  FileText, 
  Mic, 
  Share2,
  ArrowRight,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
  Loader2,
  Check,
  CreditCard,
  Lock,
  X,
  Square,
  Download,
  Clock
} from "lucide-react";

import { BUY_MP3_LABEL } from "@/lib/constants";

type Step = "input" | "review" | "generate" | "publish";

interface VoiceOption {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
  color: string;
  bgColor: string;
}

// Color palette for voices
const voiceColors = [
  { color: "#ef4444", bgColor: "#fef2f2" }, // red
  { color: "#3b82f6", bgColor: "#eff6ff" }, // blue
  { color: "#22c55e", bgColor: "#f0fdf4" }, // green
  { color: "#f59e0b", bgColor: "#fffbeb" }, // amber
  { color: "#8b5cf6", bgColor: "#f5f3ff" }, // violet
  { color: "#ec4899", bgColor: "#fdf2f8" }, // pink
  { color: "#06b6d4", bgColor: "#ecfeff" }, // cyan
  { color: "#f97316", bgColor: "#fff7ed" }, // orange
  { color: "#14b8a6", bgColor: "#f0fdfa" }, // teal
  { color: "#6366f1", bgColor: "#eef2ff" }, // indigo
  { color: "#84cc16", bgColor: "#f7fee7" }, // lime
  { color: "#a855f7", bgColor: "#faf5ff" }, // purple
];

interface TextSegment {
  id: number;
  text: string;
  voiceId: string;
  confirmed: boolean;
}

interface ScrapedContent {
  title: string;
  author: string;
  publishDate: string | null;
  featuredImage: string | null;
  images: string[]; // All extracted images for thumbnail selection
  content: string;
  paragraphs: string[];
  wordCount: number;
  estimatedReadTime: string;
  platform: string;
  url: string;
}

const steps = [
  { id: "input" as Step, label: "Paste Link", icon: Link },
  { id: "review" as Step, label: "Review", icon: FileText },
  { id: "generate" as Step, label: "Generate", icon: Mic },
  { id: "publish" as Step, label: "Publish", icon: Share2 },
];

const DEMO_MODE = false; // Set to true to skip Stripe/ElevenLabs and use existing audio for demo video

const SCRAPE_PROGRESS_MESSAGES = [
  'Fetching content...',
  'Loading the page...',
  'Rendering JavaScript...',
  'Extracting text...',
  'Finding images...',
  'Processing content...',
  'Almost there...',
];

const getFirstSentence = (text: string) => {
  if (!text) return "";
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text;
};

export function ConversionFlow() {
  const [currentStep, setCurrentStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync ref value to state on mount and periodically to handle browser autofill
  useEffect(() => {
    const timer = setInterval(() => {
      if (urlInputRef.current && urlInputRef.current.value !== url) {
        setUrl(urlInputRef.current.value);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [url]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationProgressDetail, setGenerationProgressDetail] = useState<{ done: number; total: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<ScrapedContent | null>(null);
  const [textSegments, setTextSegments] = useState<TextSegment[]>([]);
  const [activeVoice, setActiveVoice] = useState<string>("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const isSplittingRef = useRef(false); // Track when we're splitting to prevent onBlur interference
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');
  const [scrapeProgressIndex, setScrapeProgressIndex] = useState<number>(0);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [customVoiceLoading, setCustomVoiceLoading] = useState(false);
  const [customVoiceError, setCustomVoiceError] = useState<string | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [showId, setShowId] = useState<string | null>("00000000-0000-0000-0000-000000000000");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isBuyingDownload, setIsBuyingDownload] = useState(false);
  const [showPropagationModal, setShowPropagationModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; url: string }>({ title: "", url: "" });
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0); // Track which image is selected as thumbnail
  const [isRedundant, setIsRedundant] = useState(false); // Track if we skipped to publish because of a duplicate
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalWordCount = textSegments.reduce((acc, s) => acc + s.text.split(/\s+/).filter(w => w.length > 0).length, 0);
  const audioLengthMins = Math.ceil(totalWordCount / 150);
  const readTimeMins = Math.ceil(totalWordCount / 200);

  // Rotate through progress messages while scraping
  useEffect(() => {
    if (!isLoading || !scrapeProgress) return;
    
    const interval = setInterval(() => {
      setScrapeProgressIndex(prev => (prev + 1) % SCRAPE_PROGRESS_MESSAGES.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isLoading, scrapeProgress]);

  // Check for payment success or existing preview on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    
    // 1. Check for payment success
    if (searchParams.get('payment_success') === 'true') {
      const type = searchParams.get('type') || 'generation';
      
      if (type === 'generation') {
        window.history.replaceState({}, '', window.location.pathname);
        const savedSegments = localStorage.getItem('pending_segments');
        const savedStep = localStorage.getItem('pending_step');
        const savedPreview = localStorage.getItem('pending_preview');
        
        if (savedSegments && savedStep === 'generate') {
          const segments = JSON.parse(savedSegments);
          setTextSegments(segments);
          const savedIndex = localStorage.getItem('selected_image_index');
          if (savedIndex !== null) {
            setSelectedImageIndex(parseInt(savedIndex));
          }
          if (savedPreview) {
            setPreviewData(JSON.parse(savedPreview));
          }
          setCurrentStep('generate');
          setTimeout(() => {
            handleGenerate(segments);
          }, 500);
          return;
        }
      } else if (type === 'download') {
        // Trigger download for the current session audio
        const audioUrl = localStorage.getItem('pending_download_url');
        const title = localStorage.getItem('last_title') || 'audio';
        if (audioUrl) {
          const a = document.createElement('a');
          a.href = audioUrl;
          a.download = `podcast-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          localStorage.removeItem('pending_download_url');
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    // 2. Check for existing preview data if not in a flow
    const lastTitle = localStorage.getItem('last_title');
    const lastShowId = localStorage.getItem('last_show_id');
    const lastSegments = localStorage.getItem('pending_segments');
    
    if (lastShowId) {
      setShowId(lastShowId);
    }
    
    if (lastSegments && textSegments.length === 0) {
      setTextSegments(JSON.parse(lastSegments));
    }
    
    if (lastTitle && !previewData) {
      // Reconstruct basic preview data from fallback storage
      const savedParagraphs = localStorage.getItem('last_paragraphs');
      const paragraphs = savedParagraphs ? JSON.parse(savedParagraphs) : [];
      
      const savedImages = localStorage.getItem('last_images');
      const images = savedImages ? JSON.parse(savedImages) : [];
      const savedIndex = localStorage.getItem('selected_image_index');
      if (savedIndex !== null) {
        setSelectedImageIndex(parseInt(savedIndex));
      }
      setPreviewData({
        title: lastTitle,
        author: localStorage.getItem('last_author') || '',
        featuredImage: localStorage.getItem('last_image') || null,
        images: images,
        platform: localStorage.getItem('last_platform') || 'Custom',
        url: localStorage.getItem('last_url') || '',
        wordCount: parseInt(localStorage.getItem('last_word_count') || '0'),
        estimatedReadTime: localStorage.getItem('last_reading_time') || '',
        paragraphs: paragraphs,
        content: '',
        publishDate: null
      });

      // Also restore text segments if we have paragraphs
      if (paragraphs.length > 0) {
        setTextSegments(
          paragraphs.map((text: string, i: number) => ({ 
            id: i, 
            text: text.trim(), 
            voiceId: "", 
            confirmed: false 
          }))
        );
      }
    }
  }, []);

  // Fetch voices from ElevenLabs
  useEffect(() => {
    async function loadVoices() {
      setVoicesLoading(true);
      try {
        const response = await fetch('/api/voices');
        const data = await response.json();
        
        if (data.success && data.voices) {
          // Assign colors to voices
          const voicesWithColors: VoiceOption[] = data.voices.map((v: { id: string; name: string; description: string; previewUrl: string }, i: number) => ({
            ...v,
            color: voiceColors[i % voiceColors.length].color,
            bgColor: voiceColors[i % voiceColors.length].bgColor,
          }));
          setVoiceOptions(voicesWithColors);
        }
      } catch (error) {
        console.error('Failed to load voices:', error);
      } finally {
        setVoicesLoading(false);
      }
    }
    loadVoices();
  }, []);

  // Load custom voice by ID
  const loadCustomVoice = async () => {
    if (!customVoiceId.trim()) return;
    
    // Extract voice ID from URL if pasted
    let voiceId = customVoiceId.trim();
    // Handle URLs like: 
    // - https://elevenlabs.io/app/voice-library?voiceId=xxx
    // - https://elevenlabs.io/voice/xxx
    const queryMatch = voiceId.match(/[?&]voiceId=([a-zA-Z0-9]+)/);
    const pathMatch = voiceId.match(/voice(?:s)?\/([a-zA-Z0-9]+)/);
    if (queryMatch) {
      voiceId = queryMatch[1];
    } else if (pathMatch) {
      voiceId = pathMatch[1];
    }
    
    // Check if already added
    if (voiceOptions.some(v => v.id === voiceId)) {
      setActiveVoice(voiceId);
      setCustomVoiceId("");
      return;
    }
    
    setCustomVoiceLoading(true);
    setCustomVoiceError(null);
    
    try {
      const response = await fetch(`/api/voices/${voiceId}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Voice not found');
      }
      
      // If voice is from shared library and not in user's account, try to add it
      if (data.inLibrary === false && data.voice.publicOwnerId) {
        const addResponse = await fetch(`/api/voices/${voiceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicOwnerId: data.voice.publicOwnerId,
            name: data.voice.name,
          }),
        });
        
        const addData = await addResponse.json();
        if (!addResponse.ok || !addData.success) {
          // If permission error, still allow using the voice for preview
          // (generation might fail later, but at least they can see it)
          if (addData.error?.includes('voices_write')) {
            console.warn('Could not auto-add voice, but can still use for preview');
          } else {
            throw new Error(addData.error || 'Failed to add voice to library');
          }
        }
      }
      
      // Add the custom voice with a unique color
      const customColor = voiceColors[(voiceOptions.length) % voiceColors.length];
      const newVoice: VoiceOption = {
        id: data.voice.id,
        name: data.voice.name,
        description: data.voice.description || 'Custom voice',
        previewUrl: data.voice.previewUrl || '',
        color: customColor.color,
        bgColor: customColor.bgColor,
      };
      
      setVoiceOptions(prev => [...prev, newVoice]);
      setActiveVoice(newVoice.id);
      setCustomVoiceId("");
      setCustomVoiceError(null);
    } catch (error) {
      setCustomVoiceError(error instanceof Error ? error.message : 'Failed to load voice');
    } finally {
      setCustomVoiceLoading(false);
    }
  };

  // Handle voice preview playback
  const playVoicePreview = (voice: VoiceOption) => {
    if (!voice.previewUrl) return;
    
    if (playingVoiceId === voice.id) {
      // Stop playing
      audioRef.current?.pause();
      setPlayingVoiceId(null);
    } else {
      // Play new voice
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(voice.previewUrl);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingVoiceId(null);
      setPlayingVoiceId(voice.id);
    }
  };

  // Handle final audio playback
  useEffect(() => {
    if (currentStep === 'publish' && generatedAudioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(generatedAudioUrl);
      } else if (audioRef.current.src !== generatedAudioUrl) {
        audioRef.current.src = generatedAudioUrl;
      }
      
      const audio = audioRef.current;
      
      if (isPlaying) {
        audio.play().catch(e => console.error("Playback failed", e));
      } else {
        audio.pause();
      }
      
      const handleEnded = () => setIsPlaying(false);
      const handleTimeUpdate = () => setAudioCurrentTime(audio.currentTime);
      const handleLoadedMetadata = () => setAudioDuration(audio.duration);
      
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      return () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [isPlaying, generatedAudioUrl, currentStep]);

  // Format time for player
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleScrub = (value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setAudioCurrentTime(value);
    }
  };

  // Handle Export Audio
  const handleExportAudio = () => {
    if (!generatedAudioUrl) return;
    const title = previewData?.title || localStorage.getItem('last_title') || 'audio';
    const a = document.createElement('a');
    a.href = generatedAudioUrl;
    a.download = `podcast-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePayment = async () => {
    if (DEMO_MODE) {
      setPaymentProcessing(true);
      setTimeout(() => {
        setPaymentProcessing(false);
        setCurrentStep('generate');
        handleGenerate();
      }, 1000);
      return;
    }
    setPaymentProcessing(true);
    try {
      // Save state to localStorage so we can resume after redirect
      localStorage.setItem('pending_segments', JSON.stringify(textSegments));
      localStorage.setItem('pending_step', 'generate');
      localStorage.setItem('selected_image_index', selectedImageIndex.toString());
      if (previewData) {
        localStorage.setItem('pending_preview', JSON.stringify(previewData));
      }
      
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: audioLengthMins * 0.75,
          title: previewData?.title
        }),
      });
      
      const { url, isTestMode: apiTestMode } = await response.json();
      if (apiTestMode) {
        setIsTestMode(true);
        localStorage.setItem('is_test_mode', 'true');
      } else {
        localStorage.removeItem('is_test_mode');
      }
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to start payment process');
      setPaymentProcessing(false);
    }
  };

  const handleBuyDownload = async () => {
    if (!generatedAudioUrl) return;

    if (DEMO_MODE) {
      setIsBuyingDownload(true);
      setTimeout(() => {
        setIsBuyingDownload(false);
        const title = previewData?.title || localStorage.getItem('last_title') || 'audio';
        const a = document.createElement('a');
        a.href = generatedAudioUrl;
        a.download = `podcast-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, 1000);
      return;
    }

    setIsBuyingDownload(true);
    try {
      localStorage.setItem('pending_download_url', generatedAudioUrl);
      
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: 5,
          title: previewData?.title || localStorage.getItem('last_title'),
          type: 'download'
        }),
      });
      
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to start payment process');
      setIsBuyingDownload(false);
    }
  };

  const handlePlatformClick = (e: React.MouseEvent, platform: string, url: string) => {
    e.preventDefault();
    setModalConfig({ title: platform, url });
    setShowPropagationModal(true);
  };

  const getCurrentStepIndex = () => steps.findIndex((s) => s.id === currentStep);

  const handleMetadataChange = (field: 'title' | 'author', value: string) => {
    if (!previewData) return;
    const newData = { ...previewData, [field]: value };
    setPreviewData(newData);
    localStorage.setItem(`last_${field}`, value);
  };

  const handleFetch = async (force = false) => {
    const currentUrl = (urlInputRef.current?.value || url).trim();
    if (!currentUrl) return;
    setIsLoading(true);
    setScrapeError(null);
    setIsRedundant(false);
    setScrapeProgress('active'); // Set to active to trigger message rotation
    setScrapeProgressIndex(0);
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentUrl, force }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to scrape URL');
      }

      // Handle existing episode (Redundancy check)
      if (result.alreadyExists) {
        const ep = result.episode;
        setGeneratedAudioUrl(ep.audio_url);
        setShowId(ep.show_id || "00000000-0000-0000-0000-000000000000");
        setIsRedundant(true);
        
        setPreviewData({
          title: ep.title,
          author: 'anoncast.net',
          featuredImage: ep.image_url,
          images: ep.image_url ? [ep.image_url] : [],
          url: ep.source_url || currentUrl,
          paragraphs: [],
          content: '',
          wordCount: 0,
          estimatedReadTime: '',
          publishDate: ep.published_at,
          platform: 'Custom'
        });
        
        setScrapeProgress('');
        setCurrentStep('publish');
        setIsLoading(false);
        return;
      }
      
      const scraped: ScrapedContent = result.data;
      
      // Extract domain as default author if scraper didn't find one
      if (!scraped.author || scraped.author === 'Unknown Author') {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          scraped.author = domain;
        } catch (e) {
          // Fallback to anoncast.net if URL is invalid
          scraped.author = 'anoncast.net';
        }
      }

      setPreviewData(scraped);
      setSelectedImageIndex(0); // Reset to first image
      localStorage.setItem('selected_image_index', '0');
      setScrapeProgress(''); // Clear progress message when done
      
      // Secondary fallback storage for the final card and persistence
      localStorage.setItem('last_title', scraped.title);
      localStorage.setItem('last_author', scraped.author);
      localStorage.setItem('last_image', scraped.featuredImage || '');
      localStorage.setItem('last_images', JSON.stringify(scraped.images || []));
      localStorage.setItem('last_platform', scraped.platform);
      localStorage.setItem('last_url', scraped.url);
      localStorage.setItem('last_word_count', scraped.wordCount.toString());
      localStorage.setItem('last_reading_time', scraped.estimatedReadTime);
      localStorage.setItem('last_paragraphs', JSON.stringify(scraped.paragraphs));
      localStorage.setItem('last_first_sentence', scraped.paragraphs?.[0] ? getFirstSentence(scraped.paragraphs[0]) : '');
      localStorage.setItem('pending_segments', JSON.stringify(scraped.paragraphs.map((text, i) => ({ 
        id: i, 
        text: text.trim(), 
        voiceId: "", 
        confirmed: false 
      }))));
      
      // Initialize text segments from scraped paragraphs
      setTextSegments(
        scraped.paragraphs.map((text, i) => ({ 
          id: i, 
          text: text.trim(), 
          voiceId: "", 
          confirmed: false 
        }))
      );
    } catch (error) {
      setScrapeError(error instanceof Error ? error.message : 'Failed to fetch content');
      setPreviewData(null);
      setScrapeProgress('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToReview = () => {
    setIsPlaying(false);
    setCurrentStep("review");
  };

  const handleClearPreview = () => {
    setPreviewData(null);
    setIsRedundant(false);
    setUrl("");
    if (urlInputRef.current) {
      urlInputRef.current.value = "";
    }
    localStorage.removeItem('pending_preview');
    localStorage.removeItem('pending_segments');
    localStorage.removeItem('pending_step');
    localStorage.removeItem('last_title');
    localStorage.removeItem('last_author');
    localStorage.removeItem('last_image');
    localStorage.removeItem('last_platform');
    localStorage.removeItem('last_url');
    localStorage.removeItem('last_word_count');
    localStorage.removeItem('last_reading_time');
    localStorage.removeItem('last_first_sentence');
    localStorage.removeItem('last_paragraphs');
  };

  const handleGenerate = async (segmentsToUse = textSegments) => {
    setIsGenerating(true);
    setIsPlaying(false);
    setGenerationProgress(0);
    setGenerationProgressDetail(null);
    setGenerationError(null);
    
    try {
      let audioUrlToSet: string | null = null;
      let newShowId = null;

      if (DEMO_MODE) {
        setGenerationProgress(50);
        const episodesRes = await fetch('/api/episodes');
        const episodesData = await episodesRes.json();
        
        if (episodesData.success && episodesData.data.length > 0) {
          const latest = episodesData.data[0];
          audioUrlToSet = latest.audio_url;
          newShowId = latest.show_id;
          
          setPreviewData({
            title: latest.title,
            author: latest.show_author || 'anoncast.net',
            featuredImage: latest.display_image || latest.image_url,
            images: latest.image_url ? [latest.image_url] : [],
            url: latest.description.match(/Original blog: (https?:\/\/[^\s\n]+)/)?.[1] || '',
            paragraphs: [],
            content: '',
            wordCount: 0,
            estimatedReadTime: '',
            publishDate: latest.published_at,
            platform: 'Custom'
          });
        } else {
          throw new Error('No episodes found for demo mode');
        }
      } else {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Stream-Progress': 'true',
          },
          body: JSON.stringify({ 
            segments: segmentsToUse,
            metadata: {
              title: previewData?.title || localStorage.getItem('last_title'),
              author: previewData?.author || localStorage.getItem('last_author') || 'anoncast.net',
              image: selectedImageIndex >= 0 
                ? (previewData?.images?.[selectedImageIndex] || previewData?.featuredImage || localStorage.getItem('last_image')) 
                : 'https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/Anoncast.jpg',
              url: previewData?.url || localStorage.getItem('last_url'),
              firstSentence: previewData?.paragraphs?.[0] ? getFirstSentence(previewData.paragraphs[0]) : localStorage.getItem('last_first_sentence') || ''
            }
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate audio');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader) throw new Error('No response body');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === 'progress') {
                setGenerationProgress(msg.percent);
                setGenerationProgressDetail({ done: msg.done, total: msg.total });
              } else if (msg.type === 'complete') {
                const binary = Uint8Array.from(atob(msg.base64), c => c.charCodeAt(0));
                const blob = new Blob([binary], { type: 'audio/mpeg' });
                audioUrlToSet = URL.createObjectURL(blob);
                newShowId = msg.showId;
              } else if (msg.type === 'error') {
                throw new Error(msg.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      if (audioUrlToSet) {
        setGeneratedAudioUrl(audioUrlToSet);
      }
      
      if (newShowId) {
        setShowId(newShowId);
        localStorage.setItem('last_show_id', newShowId);
      }
      
      setGenerationProgress(100);
      setGenerationProgressDetail(null);
      
      setTimeout(() => {
        setIsGenerating(false);
        setCurrentStep("publish");
      }, 600);
    } catch (error) {
      console.error('Generation error:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate audio');
      setIsGenerating(false);
      setGenerationProgressDetail(null);
    }
  };

  return (
    <div className={`mx-auto ${currentStep === "review" ? "max-w-5xl" : "max-w-3xl"} transition-all duration-300`}>
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-12">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isComplete = getCurrentStepIndex() > index;
          const StepIcon = step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm
                    transition-all duration-300
                    ${isComplete 
                      ? "bg-gray-900 text-white" 
                      : isActive 
                        ? "bg-gray-900 text-white" 
                        : "bg-gray-100 text-gray-400"
                    }
                  `}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
                <span className={`text-sm ${isActive || isComplete ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-px ${isComplete ? "bg-gray-900" : "bg-gray-200"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === "publish" ? (
          <div className="p-0">
            {/* Step 4: Publish - Floating */}
            <div className="space-y-4">
              <div className="text-center mb-4">
                {isRedundant ? (
                  <div className="space-y-1 mb-2">
                    <div className="inline-flex items-center gap-2 text-amber-600">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-bold">This blog has already been generated!</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                      Check it out at these sites
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-2 text-green-600 mb-1">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Ready to publish</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                      Your audio is ready. Share it with the world.
                    </p>
                  </>
                )}
              </div>

              {/* Audio Card */}
              <div className="border border-gray-200 rounded-xl overflow-hidden max-w-[280px] mx-auto shadow-sm">
                <div className="relative aspect-square">
                  {previewData?.featuredImage ? (
                    <img 
                      src={previewData.featuredImage} 
                      alt="Featured" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 flex items-center justify-center text-center relative overflow-hidden">
                        {/* Decorative background elements */}
                        <div className="absolute top-0 left-0 w-full h-full opacity-20">
                          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-3xl animate-pulse" />
                          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500 rounded-full blur-3xl animate-pulse delay-700" />
                        </div>
                        <h3 className="text-white font-bold text-base leading-tight line-clamp-3 drop-shadow-lg z-10 px-4">
                          {previewData?.title || "Untitled Article"}
                        </h3>
                      </div>
                    )}
                    {/* Play button overlay */}
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                        {isPlaying ? (
                          <Pause className="w-5 h-5 text-gray-900" />
                        ) : (
                          <Play className="w-5 h-5 text-gray-900 ml-1" />
                        )}
                      </div>
                    </button>
                  </div>
                  <div className="p-3 bg-white">
                    <h3 className="font-semibold text-gray-900 text-sm mb-0.5 line-clamp-1">
                      {previewData?.title || "Untitled Article"}
                    </h3>
                    <p className="text-[10px] text-gray-500">
                      {formatTime(audioDuration)} • {previewData?.author || localStorage.getItem('last_author') || "anoncast.net"}
                    </p>
                    {/* Mini progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 min-w-[30px]">{formatTime(audioCurrentTime)}</span>
                      <input 
                        type="range"
                        min="0"
                        max={audioDuration || 0}
                        step="0.1"
                        value={audioCurrentTime}
                        onChange={(e) => handleScrub(Number(e.target.value))}
                        className="flex-1 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-gray-900"
                      />
                      <span className="text-[9px] text-gray-400 min-w-[30px] text-right">
                        {formatTime(audioDuration)}
                      </span>
                    </div>
                  </div>
              </div>

              {/* Platform Links */}
              <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                <a 
                  href="https://open.spotify.com/show/3gHnQIPcwmYlh3ixZ43pvO" 
                  onClick={(e) => handlePlatformClick(e, "Spotify", "https://open.spotify.com/show/3gHnQIPcwmYlh3ixZ43pvO")}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-10 px-4 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-xl text-[11px] font-bold transition-all shadow-sm active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.306c-.22.361-.692.472-1.053.252-2.903-1.774-6.558-2.176-10.865-1.192-.413.094-.827-.163-.921-.575-.094-.413.163-.827.575-.921 4.71-1.077 8.74-.623 12.012 1.381.361.22.472.692.252 1.055zm1.464-3.259c-.276.449-.863.593-1.313.317-3.32-2.039-8.381-2.634-12.308-1.442-.505.153-1.036-.134-1.189-.639-.153-.505.134-1.036.639-1.189 4.49-1.362 10.066-.704 13.854 1.624.449.276.593.863.317 1.329zm.126-3.414c-3.982-2.366-10.551-2.585-14.364-1.428-.611.186-1.258-.168-1.444-.779-.186-.611.168-1.258.779-1.444 4.385-1.33 11.625-1.078 16.195 1.636.55.326.732 1.033.406 1.583-.326.551-1.034.733-1.583.406h-.001z"/>
                  </svg>
                  Listen on Spotify
                </a>
                <a 
                  href="https://podcasts.apple.com/us/podcast/anoncast/id1874480499" 
                  onClick={(e) => handlePlatformClick(e, "Apple Podcasts", "https://podcasts.apple.com/us/podcast/anoncast/id1874480499")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-10 px-4 bg-[#872ec4] hover:bg-[#9b3fe3] text-white rounded-xl text-[11px] font-bold transition-all shadow-sm active:scale-95"
                >
                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center p-0.5">
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-[#872ec4]">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z"/>
                    </svg>
                  </div>
                  Apple Podcasts
                </a>
              </div>
                
              <div className="flex flex-col gap-2 max-w-md mx-auto pt-2">
                {showId && (
                  <div className="p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Your RSS Feed</span>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[9px] h-4 px-1.5">Live</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        readOnly 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/feed/${showId}`}
                        className="h-8 text-[10px] bg-white border-gray-200"
                      />
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="h-8 px-2 text-[10px]"
                        onClick={() => {
                          const url = `${window.location.origin}/api/feed/${showId}`;
                          navigator.clipboard.writeText(url);
                          // Could add a toast here
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-[9px] text-gray-400 text-center">
                      Submit this URL to Spotify for Podcasters or Apple Podcasts
                    </p>
                  </div>
                )}
                
                <Button 
                  onClick={handleBuyDownload}
                  disabled={isBuyingDownload}
                  className="h-11 bg-white/80 backdrop-blur-sm hover:bg-white text-gray-700 font-bold text-sm shadow-sm border border-gray-100"
                >
                  {isBuyingDownload ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-gray-500" />
                  ) : (
                    <Download className="w-4 h-4 mr-2 text-gray-500" />
                  )}
                  {BUY_MP3_LABEL}
                </Button>
              </div>

              <div className="text-center pt-2 space-y-3">
                {isRedundant && (
                  <Button
                    onClick={() => handleFetch(true)}
                    variant="outline"
                    className="h-11 px-8 bg-white/80 backdrop-blur-sm border-gray-200 text-gray-600 hover:bg-white font-bold text-sm w-full max-w-md mx-auto block shadow-sm"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Generate New Version
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setCurrentStep("input");
                    setUrl("");
                    if (urlInputRef.current) {
                      urlInputRef.current.value = "";
                    }
                    setGenerationProgress(0);
                    setPreviewData(null);
                    setIsRedundant(false);
                    localStorage.removeItem('pending_preview');
                    localStorage.removeItem('pending_segments');
                    localStorage.removeItem('pending_step');
                    localStorage.removeItem('last_title');
                    localStorage.removeItem('last_author');
                    localStorage.removeItem('last_image');
                    localStorage.removeItem('last_platform');
                    localStorage.removeItem('last_url');
                    localStorage.removeItem('last_word_count');
                    localStorage.removeItem('last_reading_time');
                  }}
                  className="h-11 px-8 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm w-full max-w-md mx-auto block shadow-md"
                >
                  Convert another article
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Card className="border border-gray-200 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6">
              {/* Step 1: Input */}
              {currentStep === "input" && (
                <div className="space-y-4">
                  {!previewData && (
                    <div className="text-center mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">
                        Paste your blog link
                      </h2>
                      <p className="text-gray-500 text-sm">
                        We'll extract the content and prepare it for audio conversion
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://your-blog.com/article"
                      ref={urlInputRef}
                      defaultValue={url}
                      onInput={(e) => {
                        const target = e.target as HTMLInputElement;
                        setUrl(target.value);
                        if (previewData) {
                          setPreviewData(null);
                        }
                      }}
                      className="flex-1 h-11 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                    />
                    {(!previewData || isLoading) && !scrapeProgress && (
                      <Button 
                        onClick={() => handleFetch()}
                        disabled={!url.trim() || isLoading}
                        className="h-11 px-6 bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Fetch
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {scrapeError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                      {scrapeError}
                    </div>
                  )}

                  {scrapeProgress && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {SCRAPE_PROGRESS_MESSAGES[scrapeProgressIndex]}
                    </div>
                  )}

                  {!previewData && !scrapeError && !scrapeProgress && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Works with</span>
                      <div className="flex gap-2">
                        {["Medium", "Substack", "WordPress", "Ghost", "Custom"].map((platform) => (
                          <Badge 
                            key={platform} 
                            variant="secondary"
                            className="bg-gray-100 text-gray-600 hover:bg-gray-200 text-[10px] px-2 h-5"
                          >
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview Card (Inside Input Step) */}
                  {previewData && (
                    <Card 
                      className="border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500"
                      style={{ 
                        backgroundColor: '#f0f9ff', // Clean Sky Blue pastel
                      }}
                    >
                      <div className="p-4">
                        <div className="flex gap-4">
                          {previewData.featuredImage ? (
                            <img 
                              src={previewData.featuredImage} 
                              alt="Featured" 
                              className="w-20 h-20 object-cover rounded-lg shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-100 flex items-center justify-center rounded-lg flex-shrink-0 border border-gray-200">
                              <FileText className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <div className="flex-1 min-w-[200px]">
                                <input
                                  type="text"
                                  value={previewData.title}
                                  onChange={(e) => handleMetadataChange('title', e.target.value)}
                                  className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-base font-semibold text-gray-900 p-0 placeholder:text-gray-400"
                                  placeholder="Article Title"
                                />
                              </div>
                              {previewData.platform && (
                                <Badge variant="secondary" className="bg-gray-200 text-gray-600 text-[10px] h-4">
                                  {previewData.platform}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-1">
                              <div className="flex items-center">
                                <span>By </span>
                                <input
                                  type="text"
                                  value={previewData.author}
                                  onChange={(e) => handleMetadataChange('author', e.target.value)}
                                  className="bg-transparent border-none focus:outline-none focus:ring-0 text-xs text-gray-500 p-0 ml-1 w-32 placeholder:text-gray-400"
                                  placeholder="Author Name"
                                />
                              </div>
                              <span>•</span>
                              <span>{totalWordCount} words</span>
                              <span>•</span>
                              <span>{readTimeMins} min read</span>
                            </div>
                            <a 
                              href={previewData.url || "#"} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-500 hover:underline block truncate max-w-md"
                            >
                              {previewData.url}
                            </a>
                          </div>
                          <button 
                            onClick={handleClearPreview}
                            className="text-gray-400 hover:text-gray-600 p-1 self-start"
                            title="Clear preview"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {previewData && (
                    <div className="flex justify-end pt-2">
                      <Button 
                        onClick={handleContinueToReview}
                        size="lg"
                        className="h-11 px-8 bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        Continue to Review
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Review */}
              {currentStep === "review" && (
                <div className="space-y-4">
                  {/* Persistent Preview Card at top of Review/Generate steps */}
                  {previewData && (
                    <Card 
                      className="border border-gray-200 shadow-sm overflow-hidden mb-6"
                      style={{ 
                        backgroundColor: '#f0f9ff', // Clean Sky Blue pastel
                      }}
                    >
                      <div className="p-4">
                        <div className="flex gap-4">
                          {previewData.featuredImage ? (
                            <img 
                              src={previewData.featuredImage} 
                              alt="Featured" 
                              className="w-20 h-20 object-cover rounded-lg shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-100 flex items-center justify-center rounded-lg flex-shrink-0 border border-gray-200">
                              <FileText className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <div className="flex-1 min-w-[200px]">
                                <input
                                  type="text"
                                  value={previewData.title}
                                  onChange={(e) => handleMetadataChange('title', e.target.value)}
                                  className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-base font-semibold text-gray-900 p-0 placeholder:text-gray-400"
                                  placeholder="Article Title"
                                />
                              </div>
                              {previewData.platform && (
                                <Badge variant="secondary" className="bg-gray-200 text-gray-600 text-[10px] h-4">
                                  {previewData.platform}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-1">
                              <div className="flex items-center">
                                <span>By </span>
                                <input
                                  type="text"
                                  value={previewData.author}
                                  onChange={(e) => handleMetadataChange('author', e.target.value)}
                                  className="bg-transparent border-none focus:outline-none focus:ring-0 text-xs text-gray-500 p-0 ml-1 w-32 placeholder:text-gray-400"
                                  placeholder="Author Name"
                                />
                              </div>
                              <span>•</span>
                              <span>{totalWordCount} words</span>
                              <span>•</span>
                              <span>{readTimeMins} min read</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Thumbnail Image Selector */}
                  {previewData && previewData.images && previewData.images.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Episode Thumbnail
                      </h3>
                      <div className="flex items-center gap-3 overflow-x-auto pb-2">
                        {previewData.images.map((imgUrl, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedImageIndex(idx);
                              localStorage.setItem('selected_image_index', idx.toString());
                              localStorage.setItem('last_image', imgUrl);
                              // Also update featuredImage so it shows in the preview card
                              setPreviewData(prev => prev ? { ...prev, featuredImage: imgUrl } : prev);
                            }}
                            className={`
                              relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all
                              ${selectedImageIndex === idx 
                                ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                                : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                              }
                            `}
                          >
                            <img 
                              src={imgUrl} 
                              alt={`Thumbnail option ${idx + 1}`} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Hide broken images
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            {selectedImageIndex === idx && (
                              <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                                <Check className="w-5 h-5 text-blue-600 drop-shadow" />
                              </div>
                            )}
                          </button>
                        ))}
                        {/* Option for no thumbnail / default */}
                        <button
                          onClick={() => {
                            setSelectedImageIndex(-1);
                            localStorage.setItem('selected_image_index', '-1');
                            localStorage.removeItem('last_image');
                            setPreviewData(prev => prev ? { ...prev, featuredImage: null } : prev);
                          }}
                          className={`
                            relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all
                            ${selectedImageIndex === -1
                              ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                              : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                            }
                          `}
                        >
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center relative">
                            <img 
                              src="https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/Anoncast.jpg" 
                              alt="Default Thumbnail" 
                              className="w-full h-full object-cover opacity-60"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-gray-800 bg-white/80 px-1.5 py-0.5 rounded shadow-sm border border-gray-100">Default</span>
                            </div>
                          </div>
                          {selectedImageIndex === -1 && (
                            <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                              <Check className="w-5 h-5 text-blue-600 drop-shadow" />
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">
                      Assign voices to your content
                    </h2>
                    <p className="text-gray-500 text-xs">
                      Select a voice from the left, then click paragraphs to assign
                    </p>
                  </div>

                  <div className="flex gap-8">
                    {/* Left column: Voice selection */}
                    <div className="w-64 flex-shrink-0 space-y-3">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Voices</h3>
                      {voicesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      ) : voiceOptions.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">No voices available</p>
                      ) : voiceOptions.map((voice) => {
                        const allAssigned = textSegments.length > 0 && textSegments.every(s => s.voiceId === voice.id);
                        return (
                          <div
                            key={voice.id}
                            className={`
                              w-full p-3 rounded-lg border-2 text-left transition-all cursor-pointer
                              ${activeVoice === voice.id
                                ? "border-current shadow-sm"
                                : "border-transparent hover:border-gray-200"
                              }
                            `}
                            style={{ 
                              backgroundColor: voice.bgColor,
                              borderColor: activeVoice === voice.id ? voice.color : undefined
                            }}
                            onClick={() => setActiveVoice(voice.id)}
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: voice.color }}
                              />
                              <div className="flex-1">
                                <span className="font-medium text-gray-900 text-sm">{voice.name}</span>
                                <span className="block text-[10px] text-gray-500 leading-tight mt-0.5">{getFirstSentence(voice.description)}</span>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <button 
                                className={`flex items-center gap-1 text-[10px] transition-colors ${
                                  playingVoiceId === voice.id 
                                    ? 'text-gray-900 font-medium' 
                                    : 'text-gray-500 hover:text-gray-700'
                                } ${!voice.previewUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  playVoicePreview(voice);
                                }}
                                disabled={!voice.previewUrl}
                              >
                                {playingVoiceId === voice.id ? (
                                  <Square className="w-2.5 h-2.5" />
                                ) : (
                                  <Volume2 className="w-2.5 h-2.5" />
                                )}
                                {playingVoiceId === voice.id ? 'Stop' : 'Preview'}
                              </button>
                              {/* Apply all toggle */}
                              <div 
                                className="flex items-center gap-1.5 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (allAssigned) {
                                    setTextSegments(segments =>
                                      segments.map(s => ({ ...s, voiceId: "", confirmed: false }))
                                    );
                                  } else {
                                    setTextSegments(segments =>
                                      segments.map(s => ({ ...s, voiceId: voice.id, confirmed: true }))
                                    );
                                    setActiveVoice(voice.id);
                                  }
                                }}
                              >
                                <span className="text-[10px] text-gray-500">All text</span>
                                <div
                                  className="relative w-7 h-3.5 rounded-full transition-colors"
                                  style={{ 
                                    backgroundColor: allAssigned ? voice.color : '#e5e7eb'
                                  }}
                                >
                                  <div 
                                    className={`
                                      absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-all
                                      ${allAssigned ? 'left-4' : 'left-0.5'}
                                    `}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Custom Voice ID Section */}
                      <div className="pt-3 border-t border-gray-200 mt-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          <a 
                            href="https://elevenlabs.io/app/voice-library" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Use another ElevenLabs voice
                          </a>
                        </p>
                        <p className="text-[10px] text-gray-400 mb-1">
                          Add voice to VoiceLab first, then paste ID
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="Paste voice ID from VoiceLab"
                            value={customVoiceId}
                            onChange={(e) => {
                              setCustomVoiceId(e.target.value);
                              setCustomVoiceError(null);
                            }}
                            className="h-8 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                loadCustomVoice();
                              }
                            }}
                          />
                          <Button
                            onClick={loadCustomVoice}
                            disabled={!customVoiceId.trim() || customVoiceLoading}
                            size="sm"
                            className="h-8 px-3"
                          >
                            {customVoiceLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Add'
                            )}
                          </Button>
                        </div>
                        {customVoiceError && (
                          <p className="text-xs text-red-500 mt-1">{customVoiceError}</p>
                        )}
                      </div>
                    </div>

                    {/* Right column: Text content */}
                    <div className="flex-1 border border-gray-200 rounded-lg p-6 max-h-[500px] overflow-y-auto bg-white">
                      <div className="space-y-3">
                        {textSegments.map((segment) => {
                        const voice = voiceOptions.find(v => v.id === segment.voiceId);
                        const hasVoice = !!voice;
                        return (
                          <div
                            key={segment.id}
                            className="flex items-center gap-3"
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => {
                                if (activeVoice && activeVoice !== segment.voiceId) {
                                  // Assign new voice and confirm (override existing)
                                  setTextSegments(segments =>
                                    segments.map(s =>
                                      s.id === segment.id ? { ...s, voiceId: activeVoice, confirmed: true } : s
                                    )
                                  );
                                } else if (hasVoice && segment.confirmed) {
                                  // Uncheck: clear voice and confirmation, return to neutral
                                  setTextSegments(segments =>
                                    segments.map(s =>
                                      s.id === segment.id ? { ...s, voiceId: "", confirmed: false } : s
                                    )
                                  );
                                } else if (hasVoice && !segment.confirmed) {
                                  // Confirm existing voice
                                  setTextSegments(segments =>
                                    segments.map(s =>
                                      s.id === segment.id ? { ...s, confirmed: true } : s
                                    )
                                  );
                                } else if (activeVoice) {
                                  // Assign active voice and confirm
                                  setTextSegments(segments =>
                                    segments.map(s =>
                                      s.id === segment.id ? { ...s, voiceId: activeVoice, confirmed: true } : s
                                    )
                                  );
                                }
                              }}
                              disabled={!hasVoice && !activeVoice}
                              className={`
                                w-6 h-6 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                                ${!hasVoice && !activeVoice
                                  ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-40" 
                                  : segment.confirmed 
                                    ? "border-current" 
                                    : "border-gray-300 hover:border-gray-400"
                                }
                              `}
                              style={{ 
                                borderColor: segment.confirmed && hasVoice ? voice.color : undefined,
                                backgroundColor: segment.confirmed && hasVoice ? voice.color : undefined
                              }}
                            >
                              {segment.confirmed && hasVoice && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </button>

                            {/* Text area */}
                            <div
                              onClick={() => {
                                if (activeVoice && activeVoice !== segment.voiceId) {
                                  setTextSegments(segments =>
                                    segments.map(s =>
                                      s.id === segment.id ? { ...s, voiceId: activeVoice, confirmed: true } : s
                                    )
                                  );
                                }
                              }}
                              className={`
                                flex-1 rounded-md transition-all py-2
                                ${activeVoice ? "cursor-pointer hover:opacity-80" : ""}
                              `}
                              style={{ 
                                backgroundColor: hasVoice ? voice.bgColor : "transparent",
                                borderLeft: hasVoice ? `3px solid ${voice.color}` : "3px solid #e5e5e5"
                              }}
                            >
                              <textarea
                                key={`segment-${segment.id}`}
                                defaultValue={segment.text}
                                data-segment-id={segment.id}
                                onKeyDown={(e) => {
                                  const target = e.target as HTMLTextAreaElement;
                                  const cursorPos = target.selectionStart;
                                  const cursorEnd = target.selectionEnd;
                                  const text = target.value;

                                  // === BACKSPACE at start: merge with previous paragraph ===
                                  if (e.key === 'Backspace' && cursorPos === 0 && cursorEnd === 0) {
                                    setTextSegments(segments => {
                                      const index = segments.findIndex(s => s.id === segment.id);
                                      if (index <= 0) return segments; // No previous segment to merge with
                                      
                                      e.preventDefault();
                                      isSplittingRef.current = true;
                                      
                                      const prevSegment = segments[index - 1];
                                      const currentText = text.trim();
                                      const prevText = prevSegment.text.trim();
                                      const mergedText = prevText + '\n' + currentText;
                                      const mergedId = Date.now();
                                      const cursorAfterMerge = prevText.length + 1; // Position after prev text + newline
                                      
                                      const newSegments = [...segments];
                                      // Replace previous segment with merged text (new ID to force remount)
                                      newSegments[index - 1] = {
                                        id: mergedId,
                                        text: mergedText,
                                        voiceId: prevSegment.voiceId,
                                        confirmed: prevSegment.confirmed
                                      };
                                      // Remove current segment
                                      newSegments.splice(index, 1);
                                      
                                      // Focus merged textarea and place cursor at join point
                                      setTimeout(() => {
                                        const mergedTextarea = document.querySelector(`textarea[data-segment-id="${mergedId}"]`) as HTMLTextAreaElement;
                                        if (mergedTextarea) {
                                          mergedTextarea.focus();
                                          mergedTextarea.setSelectionRange(cursorAfterMerge, cursorAfterMerge);
                                        }
                                        isSplittingRef.current = false;
                                      }, 50);
                                      
                                      return newSegments;
                                    });
                                    return;
                                  }

                                  // === ENTER twice: split into two paragraphs ===
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    // Check if there's a newline just before the cursor (double Enter)
                                    if (cursorPos > 0 && text[cursorPos - 1] === '\n') {
                                      // Find where to split - at the newline before cursor
                                      const beforeText = text.slice(0, cursorPos - 1).trim();
                                      const afterText = text.slice(cursorPos).trim();
                                      
                                      if (beforeText && afterText) {
                                        e.preventDefault();
                                        
                                        // Set flag to prevent onBlur from interfering
                                        isSplittingRef.current = true;
                                        
                                        // Both segments need NEW IDs so React fully recreates the textareas
                                        const firstSegmentId = Date.now();
                                        const secondSegmentId = Date.now() + 1;
                                        
                                        // Create two segments
                                        setTextSegments(segments => {
                                          const index = segments.findIndex(s => s.id === segment.id);
                                          const newSegments = [...segments];
                                          
                                          // Replace current segment with BEFORE text (new ID forces remount)
                                          newSegments[index] = {
                                            id: firstSegmentId,
                                            text: beforeText,
                                            voiceId: segment.voiceId,
                                            confirmed: segment.confirmed
                                          };
                                          
                                          // Insert new segment after with AFTER text
                                          newSegments.splice(index + 1, 0, {
                                            id: secondSegmentId,
                                            text: afterText,
                                            voiceId: segment.voiceId,
                                            confirmed: segment.confirmed
                                          });
                                          
                                          return newSegments;
                                        });
                                        
                                        // Focus the new textarea after React renders it
                                        setTimeout(() => {
                                          const newTextarea = document.querySelector(`textarea[data-segment-id="${secondSegmentId}"]`) as HTMLTextAreaElement;
                                          if (newTextarea) {
                                            newTextarea.focus();
                                            newTextarea.setSelectionRange(0, 0);
                                          }
                                          isSplittingRef.current = false;
                                        }, 50);
                                      }
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  // Don't update if we're in the middle of splitting
                                  if (isSplittingRef.current) {
                                    return;
                                  }
                                  
                                  // Only sync if the text actually changed
                                  const newText = e.target.value;
                                  setTextSegments(segments => {
                                    const currentSegment = segments.find(s => s.id === segment.id);
                                    if (!currentSegment || currentSegment.text === newText) {
                                      return segments; // No change needed
                                    }
                                    return segments.map(s =>
                                      s.id === segment.id ? { ...s, text: newText } : s
                                    );
                                  });
                                }}
                                onInput={(e) => {
                                  const target = e.target as HTMLTextAreaElement;
                                  target.style.height = "0";
                                  target.style.height = target.scrollHeight + "px";
                                }}
                                ref={(el) => {
                                  if (el) {
                                    el.style.height = "0";
                                    el.style.height = el.scrollHeight + "px";
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                rows={1}
                                style={{ lineHeight: '1.4' }}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 resize-none px-3 py-0 text-gray-700 text-sm overflow-hidden block"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Estimation */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">Estimated audio length: </span>
                      <span className="font-medium text-gray-900">
                        {audioLengthMins} min
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Generation cost: </span>
                      <span className="font-medium text-gray-900">
                        ${(audioLengthMins * 0.75).toFixed(2)}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">
                        ($0.75/min)
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {textSegments.filter(s => !s.voiceId).length > 0 ? (
                      <span className="text-amber-600">
                        {textSegments.filter(s => !s.voiceId).length} paragraph(s) need a voice assigned
                      </span>
                    ) : textSegments.filter(s => !s.confirmed).length > 0 ? (
                      <span className="text-amber-600">
                        {textSegments.filter(s => !s.confirmed).length} paragraph(s) not confirmed
                      </span>
                    ) : (
                      <span className="text-green-600">
                        All paragraphs confirmed ✓
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  {textSegments.filter(s => s.confirmed && s.voiceId).length === 0 && (
                    <p className="text-xs text-center text-amber-600 font-medium animate-pulse">
                      Please assign a voice to at least one paragraph to continue
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setCurrentStep("input");
                      }}
                      className="flex-1 h-12 border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </Button>
                    <Button 
                      onClick={() => setCurrentStep("generate")}
                      disabled={textSegments.filter(s => s.confirmed && s.voiceId).length === 0}
                      className="flex-1 h-12 bg-gray-900 hover:bg-gray-800 text-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Generate Audio
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Generate */}
            {currentStep === "generate" && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Generate audio
                  </h2>
                </div>

                {/* Persistent Preview Card below title */}
                {previewData && (
                  <Card 
                    className="border border-gray-200 shadow-sm overflow-hidden mb-4"
                    style={{ 
                      backgroundColor: '#f0f9ff', // Clean Sky Blue pastel
                    }}
                  >
                    <div className="p-4">
                      <div className="flex gap-4 text-left">
                        {previewData.featuredImage ? (
                          <img 
                            src={previewData.featuredImage} 
                            alt="Featured" 
                            className="w-20 h-20 object-cover rounded-lg shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-100 flex items-center justify-center rounded-lg flex-shrink-0 border border-gray-200">
                            <FileText className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <div className="flex-1 min-w-[200px]">
                              <input
                                type="text"
                                value={previewData.title}
                                onChange={(e) => handleMetadataChange('title', e.target.value)}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-base font-semibold text-gray-900 p-0 placeholder:text-gray-400"
                                placeholder="Article Title"
                              />
                            </div>
                            {previewData.platform && (
                              <Badge variant="secondary" className="bg-gray-200 text-gray-600 text-[10px] h-4">
                                {previewData.platform}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-1">
                            <div className="flex items-center">
                              <span>By </span>
                              <input
                                type="text"
                                value={previewData.author}
                                onChange={(e) => handleMetadataChange('author', e.target.value)}
                                className="bg-transparent border-none focus:outline-none focus:ring-0 text-xs text-gray-500 p-0 ml-1 w-32 placeholder:text-gray-400"
                                placeholder="Author Name"
                              />
                            </div>
                            <span>•</span>
                            <span>{totalWordCount} words</span>
                            <span>•</span>
                            <span>{readTimeMins} min read</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {!isGenerating && generationProgress === 0 ? (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center gap-6 mb-4">
                      <div className="p-3 bg-gray-50 rounded-lg text-left">
                        <div className="text-xs text-gray-500 mb-0.5">Total cost</div>
                        <div className="text-xl font-semibold text-gray-900">
                          ${(audioLengthMins * 0.75).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <Button 
                          onClick={handlePayment}
                          disabled={paymentProcessing}
                          size="lg"
                          className="h-12 px-8 bg-gray-900 hover:bg-gray-800 text-white"
                        >
                          {paymentProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <CreditCard className="w-4 h-4 mr-2" />
                          )}
                          {paymentProcessing ? "Processing..." : "Pay & Generate"}
                        </Button>
                        {(isTestMode || (typeof window !== 'undefined' && localStorage.getItem('is_test_mode') === 'true')) && (
                          <div className="mt-1.5 text-[9px] font-bold text-amber-600 tracking-wider uppercase">
                            Stripe Test Mode Active
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      Estimated time: {(() => {
                        const minSecs = Math.max(30, Math.ceil(textSegments.length / 5) * 15);
                        const maxSecs = Math.max(60, Math.ceil(textSegments.length / 5) * 25);
                        
                        if (maxSecs >= 120) {
                          const minMins = Math.floor(minSecs / 60);
                          const maxMins = Math.ceil(maxSecs / 60);
                          return `~${minMins}-${maxMins} minutes`;
                        }
                        return `~${minSecs}-${maxSecs} seconds`;
                      })()}
                    </p>
                    <p className="text-[10px] text-amber-600 font-medium">
                      Note: Please stay on this page during generation.
                    </p>
                    <button
                      onClick={() => setCurrentStep("review")}
                      className="mt-4 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      ← Back to Review
                    </button>
                  </div>
                ) : isGenerating ? (
                  <div className="space-y-6 py-8">
                    <div className="flex justify-center gap-1">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-gray-400 rounded-full waveform-bar"
                          style={{ 
                            height: `${20 + Math.random() * 30}px`,
                            animationDelay: `${i * 0.05}s`
                          }}
                        />
                      ))}
                    </div>
                      <div className="space-y-4">
                        <Progress value={generationProgress} className="h-2" />
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-center text-sm font-medium text-gray-900">
                            Generating audio...{" "}
                            {generationProgressDetail ? (
                              <>
                                {generationProgressDetail.done > 3 ? (
                                  <>
                                    {generationProgressDetail.done - 3} of {generationProgressDetail.total - 3} paragraphs ({Math.round(generationProgress)}%)
                                  </>
                                ) : (
                                  <>Preparing... ({Math.round(generationProgress)}%)</>
                                )}
                              </>
                            ) : (
                              `${Math.round(generationProgress)}%`
                            )}
                          </p>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold animate-pulse border border-amber-100 uppercase tracking-tight">
                            <Clock className="w-3 h-3" />
                            Please do not navigate away or refresh
                          </div>
                        </div>
                      </div>
                  </div>
                ) : generationError ? (
                  <div className="space-y-4 py-8 text-center">
                    <div className="text-red-500 mb-2">
                      <X className="w-10 h-10 mx-auto mb-2" />
                      <p className="font-semibold">Generation failed</p>
                    </div>
                    <p className="text-sm text-gray-600 max-w-xs mx-auto">
                      {generationError}
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setGenerationError(null);
                        setCurrentStep("review");
                      }}
                      className="mt-4"
                    >
                      Back to Review
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6 py-4">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center hover:bg-gray-800 transition-colors"
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6 text-white" />
                        ) : (
                          <Play className="w-6 h-6 text-white ml-1" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 min-w-[40px]">{formatTime(audioCurrentTime)}</span>
                      <input 
                        type="range"
                        min="0"
                        max={audioDuration || 0}
                        step="0.1"
                        value={audioCurrentTime}
                        onChange={(e) => handleScrub(Number(e.target.value))}
                        className="flex-1 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-gray-900"
                      />
                      <span className="text-sm text-gray-500 min-w-[40px] text-right">{formatTime(audioDuration)}</span>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setGenerationProgress(0);
                          setCurrentStep("review");
                        }}
                        className="flex-1 h-12 border-gray-200 text-gray-700 hover:bg-gray-50"
                      >
                        Back
                      </Button>
                      <Button 
                        onClick={() => setCurrentStep("publish")}
                        className="flex-1 h-12 bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>

    {/* Propagation Modal */}
    {showPropagationModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
        <Card className="w-full max-w-sm shadow-2xl border-gray-200 bg-white animate-in zoom-in-95 duration-300">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-blue-600">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Almost there!</h3>
              <p className="text-sm text-gray-600 mb-6">
                It can take <span className="font-bold text-gray-900">5-10 minutes</span> for new episodes to show up on {modalConfig.title}. 
                <br /><br />
                You can check the app directly in a few minutes, or continue to {modalConfig.title} now.
              </p>
              <div className="flex flex-col w-full gap-2">
                <Button 
                  onClick={() => {
                    if (modalConfig.url !== "#") {
                      window.open(modalConfig.url, "_blank");
                    }
                    setShowPropagationModal(false);
                  }}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold"
                >
                  Continue to {modalConfig.title}
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setShowPropagationModal(false)}
                  className="w-full text-gray-500 font-medium"
                >
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
  </div>
  );
}
