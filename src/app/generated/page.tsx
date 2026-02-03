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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {episodes.map((episode) => (
              <Card key={episode.id} className="group hover:shadow-md transition-all border-gray-200 overflow-hidden flex flex-col">
                <div className="relative aspect-video overflow-hidden bg-gray-100">
                  {episode.show_image ? (
                    <img 
                      src={episode.show_image} 
                      alt={episode.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 p-6">
                      <h3 className="text-white font-bold text-sm text-center line-clamp-2">
                        {episode.title}
                      </h3>
                    </div>
                  )}
                  <button 
                    onClick={() => togglePlay(episode)}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                      {playingId === episode.id ? (
                        <Pause className="w-5 h-5 text-gray-900" />
                      ) : (
                        <Play className="w-5 h-5 text-gray-900 ml-1" />
                      )}
                    </div>
                  </button>
                </div>
                
                <CardContent className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">
                    {episode.title}
                  </h3>
                  
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <User className="w-3 h-3" />
                      <span className="truncate">{episode.show_author || 'Anoncast'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(episode.published_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(episode.duration)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-8 px-2 text-gray-600 hover:text-gray-900"
                      asChild
                    >
                      <a href={episode.audio_url} download={`podcast-${episode.id}.mp3`}>
                        Download
                      </a>
                    </Button>
                    <Link href={`/api/feed/00000000-0000-0000-0000-000000000000`} target="_blank">
                      <Button variant="ghost" size="sm" className="text-xs h-8 px-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50">
                        RSS <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
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
