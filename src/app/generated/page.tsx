"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, ExternalLink, Calendar, Clock, User } from "lucide-react";
import Link from "next/link";

interface Episode {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  duration: number;
  published_at: string;
  show_title?: string;
  show_author?: string;
  show_image?: string;
}

export default function GeneratedBlogsPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audio] = useState<HTMLAudioElement | null>(typeof window !== 'undefined' ? new Audio() : null);

  useEffect(() => {
    async function fetchEpisodes() {
      try {
        const response = await fetch('/api/episodes');
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch');
        }

        setEpisodes(result.data);
      } catch (err) {
        console.error("Error fetching episodes:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, []);

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

  return (
    <main className="min-h-screen bg-gray-50/50">
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
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Generated Episodes</h1>
          <p className="text-gray-600">Explore all the blogs and essays that have been converted to podcasts.</p>
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
          <div className="space-y-12 max-w-2xl mx-auto">
            {episodes.map((episode) => (
              <div key={episode.id} className="group border-b border-gray-100 pb-12 last:border-0">
                <div className="relative rounded-2xl overflow-hidden bg-gray-100 shadow-sm mb-6">
                  {episode.show_image ? (
                    <img 
                      src={episode.show_image} 
                      alt={episode.title}
                      className="w-full h-auto block"
                    />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 p-12">
                      <h3 className="text-white font-bold text-2xl text-center">
                        {episode.title}
                      </h3>
                    </div>
                  )}
                  <button 
                    onClick={() => togglePlay(episode)}
                    className="absolute inset-0 flex items-center justify-center bg-black/5 group-hover:bg-black/20 transition-colors"
                  >
                    <div className="w-20 h-20 rounded-full bg-white/90 backdrop-blur shadow-2xl flex items-center justify-center transform transition-transform group-hover:scale-110">
                      {playingId === episode.id ? (
                        <Pause className="w-8 h-8 text-gray-900" />
                      ) : (
                        <Play className="w-8 h-8 text-gray-900 ml-1" />
                      )}
                    </div>
                  </button>
                </div>
                
                <div className="px-2">
                  <div className="flex items-center gap-3 text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
                    <span>{formatDate(episode.published_at)}</span>
                    <span>•</span>
                    <span>{formatDuration(episode.duration)}</span>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                    {episode.title}
                  </h2>
                  
                  <p className="text-gray-600 text-sm mb-6 line-clamp-3 leading-relaxed">
                    {episode.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-3 h-3 text-gray-500" />
                      </div>
                      <span>{episode.show_author || 'Anoncast'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-9 px-4 border-gray-200 rounded-full"
                        asChild
                      >
                        <a href={episode.audio_url} download={`podcast-${episode.id}.mp3`}>
                          Download
                        </a>
                      </Button>
                      <Link href={`/api/feed/00000000-0000-0000-0000-000000000000`} target="_blank">
                        <Button variant="ghost" size="sm" className="text-xs h-9 px-4 text-blue-500 hover:bg-blue-50 rounded-full font-semibold">
                          RSS Feed
                        </Button>
                      </Link>
                    </div>
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
                {episodes.find(e => e.id === playingId)?.show_image ? (
                  <img src={episodes.find(e => e.id === playingId)?.show_image} alt="" className="w-full h-full object-cover" />
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
    </main>
  );
}
