"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, ExternalLink, Calendar, Clock, User, Download, CreditCard } from "lucide-react";
import Link from "next/link";
import { BUY_MP3_LABEL } from "@/lib/constants";

interface FloatingShape {
  id: number;
  type: "rect-h" | "rect-v" | "square" | "triangle";
  color: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
  duration: number;
  delay: number;
  animation: "spin" | "tilt" | "wobble";
}

const colors = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

function generateShapes(count: number): FloatingShape[] {
  const shapes: FloatingShape[] = [];
  const types: FloatingShape["type"][] = ["rect-h", "rect-v", "square", "triangle"];
  const animations: FloatingShape["animation"][] = ["spin", "tilt", "wobble"];
  
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    let width: number, height: number;
    
    switch (type) {
      case "square":
        const squareSize = 40 + Math.random() * 100;
        width = squareSize;
        height = squareSize;
        break;
      case "rect-h": // horizontal rectangle
        width = 80 + Math.random() * 150;
        height = 15 + Math.random() * 40;
        break;
      case "rect-v": // vertical rectangle
        width = 15 + Math.random() * 40;
        height = 80 + Math.random() * 150;
        break;
      case "triangle":
        width = 50 + Math.random() * 80;
        height = 50 + Math.random() * 80;
        break;
      default:
        width = 50;
        height = 50;
    }
    
    shapes.push({
      id: i,
      type,
      color: colors[Math.floor(Math.random() * colors.length)],
      width,
      height,
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotation: -60 + Math.random() * 120,
      duration: 15 + Math.random() * 25,
      delay: Math.random() * -15,
      animation: animations[Math.floor(Math.random() * animations.length)],
    });
  }
  return shapes;
}

interface Episode {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  duration: number;
  published_at: string;
  show_title?: string;
  show_author?: string;
  display_image?: string;
  spotify_url?: string;
  apple_url?: string;
}

export default function GeneratedBlogsPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showPropagationModal, setShowPropagationModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; url: string }>({ title: "", url: "" });
  const [audio] = useState<HTMLAudioElement | null>(typeof window !== 'undefined' ? new Audio() : null);
  const [shapes, setShapes] = useState<FloatingShape[]>([]);

  useEffect(() => {
    setShapes(generateShapes(12));
  }, []);

  useEffect(() => {
    async function fetchEpisodes() {
      try {
        const response = await fetch('/api/episodes');
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch');
        }

        const data = result.data;
        setEpisodes(data);

        // Check for payment success redirect
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('payment_success') === 'true' && searchParams.get('type') === 'download') {
          const episodeId = searchParams.get('episodeId');
          const episode = data.find((e: Episode) => e.id === episodeId);
          if (episode) {
            // Trigger actual download
            const a = document.createElement('a');
            a.href = episode.audio_url;
            a.download = `podcast-${episode.id}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      } catch (err) {
        console.error("Error fetching episodes:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, []);

  const handleBuyDownload = async (episode: Episode) => {
    setPayingId(episode.id);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: 5,
          title: episode.title,
          type: 'download',
          episodeId: episode.id
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
      setPayingId(null);
    }
  };

  const togglePlay = (episode: Episode) => {
    if (!audio) return;

    if (playingId === episode.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.src = episode.audio_url;
      audio.play();
      setPlayingId(episode.id);
      audio.onended = () => setPlayingId(null);
    }
  };

  const handlePlatformClick = (e: React.MouseEvent, platform: string, url: string) => {
    e.preventDefault();
    setModalConfig({ title: platform, url });
    setShowPropagationModal(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSourceUrl = (description: string) => {
    const match = description.match(/Original blog: (https?:\/\/[^\s\n]+)/);
    return match ? match[1] : null;
  };

  return (
    <main className="min-h-screen bg-white relative overflow-hidden">
      {/* Floating Shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {shapes.map((shape) => (
          <div
            key={shape.id}
            className={`absolute ${
              shape.animation === "spin" 
                ? "animate-float-spin" 
                : shape.animation === "tilt" 
                  ? "animate-float-tilt" 
                  : "animate-float-wobble"
            }`}
            style={{
              left: `${shape.x}%`,
              top: `${shape.y}%`,
              width: shape.type === "triangle" ? 0 : shape.width,
              height: shape.type === "triangle" ? 0 : shape.height,
              backgroundColor: shape.type === "triangle" ? "transparent" : shape.color,
              borderLeft: shape.type === "triangle" ? `${shape.width / 2}px solid transparent` : undefined,
              borderRight: shape.type === "triangle" ? `${shape.width / 2}px solid transparent` : undefined,
              borderBottom: shape.type === "triangle" ? `${shape.height}px solid ${shape.color}` : undefined,
              opacity: 0.85,
              animationDuration: `${shape.duration}s`,
              animationDelay: `${shape.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="py-6 px-8 border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg hover:opacity-70 transition-opacity">
            anoncast
          </Link>
          <nav>
            <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
          {/* Show Image */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden shadow-xl border-4 border-white flex-shrink-0">
            <img 
              src="https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/Anoncast.jpg" 
              alt="Anoncast Show Art" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Generated Episodes</h1>
            <p className="text-lg text-gray-600">Explore all the blogs and essays that have been converted to podcasts.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-4" />
            <p className="text-gray-500">Loading catalog...</p>
          </div>
        ) : episodes.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-500">No episodes have been generated yet.</p>
            <Link href="/">
              <Button variant="link" className="mt-2 text-blue-500">Create the first one →</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {episodes.map((episode) => (
              <div 
                key={episode.id} 
                className="group bg-white border border-gray-100 rounded-xl p-4 flex gap-6 hover:shadow-md transition-all items-center"
              >
                {/* Compact Image/Play Section */}
                <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 shadow-sm">
                  {episode.display_image ? (
                    <img 
                      src={episode.display_image} 
                      alt={episode.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 p-2">
                      <span className="text-white font-bold text-[10px] text-center line-clamp-2">
                        {episode.title}
                      </span>
                    </div>
                  )}
                  <button 
                    onClick={() => togglePlay(episode)}
                    className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center transform transition-transform group-hover:scale-110">
                      {playingId === episode.id ? (
                        <Pause className="w-4 h-4 text-gray-900" />
                      ) : (
                        <Play className="w-4 h-4 text-gray-900 ml-0.5" />
                      )}
                    </div>
                  </button>
                </div>
                
                {/* Content Section */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    <span>Generated On {formatDate(episode.published_at)}</span>
                    <span>•</span>
                    <span>{formatDuration(episode.duration)}</span>
                  </div>
                  
                  <h2 className="text-lg font-bold text-gray-900 mb-1 truncate group-hover:text-blue-600 transition-colors">
                    {episode.title}
                  </h2>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="w-2 h-2 text-gray-500" />
                    </div>
                    <span className="text-xs text-gray-500 truncate">anoncast.net</span>
                    {getSourceUrl(episode.description) && (
                      <>
                        <span className="text-gray-300 text-xs">•</span>
                        <a 
                          href={getSourceUrl(episode.description)!} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                        >
                          View original blog <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <a 
                        href={episode.spotify_url || `https://open.spotify.com/search/${encodeURIComponent(episode.title)}/episodes`} 
                        onClick={(e) => handlePlatformClick(e, "Spotify", episode.spotify_url || `https://open.spotify.com/search/${encodeURIComponent(episode.title)}/episodes`)}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-[#1DB954] hover:opacity-80 transition-opacity flex items-center gap-1"
                      >
                        Spotify
                      </a>
                      <span className="text-gray-300 text-[10px]">•</span>
                      <a 
                        href={episode.apple_url || `https://podcasts.apple.com/us/podcast/anoncast/id1874480499`} 
                        onClick={(e) => handlePlatformClick(e, "Apple Podcasts", episode.apple_url || `https://podcasts.apple.com/us/podcast/anoncast/id1874480499`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-[#872ec4] hover:opacity-80 transition-opacity flex items-center gap-1"
                      >
                        Apple
                      </a>
                      <span className="text-gray-300 text-[10px]">•</span>
                      <Link 
                        href={`/api/feed/00000000-0000-0000-0000-000000000000`} 
                        target="_blank"
                        className="text-[10px] font-bold text-[#f26522] hover:opacity-80 transition-opacity flex items-center gap-1"
                      >
                        RSS
                      </Link>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={payingId === episode.id}
                      className="text-[10px] h-7 px-3 border border-gray-100 rounded-full hover:bg-gray-50 text-gray-500 font-bold"
                      onClick={() => handleBuyDownload(episode)}
                    >
                      {payingId === episode.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Download className="w-3 h-3 mr-1" />
                      )}
                      {BUY_MP3_LABEL}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mini Player */}
      {playingId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
          <Card className="shadow-2xl border-gray-200 bg-white/95 backdrop-blur-md">
            <CardContent className="p-3 flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-gray-900 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {episodes.find(e => e.id === playingId)?.display_image ? (
                  <img src={episodes.find(e => e.id === playingId)?.display_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Play className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {episodes.find(e => e.id === playingId)?.title}
                </p>
                <p className="text-[10px] text-gray-500">Playing now</p>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8"
                onClick={() => playingId && togglePlay(episodes.find(e => e.id === playingId)!)}
              >
                <Pause className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-8 bg-white/80 backdrop-blur-sm mt-12">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-sm text-gray-500">
            © 2026 anoncast
          </span>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Terms</Link>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Privacy</a>
            <a href="mailto:nbaronia@gmail.com" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
