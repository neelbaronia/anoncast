"use client";

import { ConversionFlow } from "@/components/conversion-flow";
import { useEffect, useState } from "react";
import Link from "next/link";

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
      duration: 15 + Math.random() * 25, // faster animations
      delay: Math.random() * -15,
      animation: animations[Math.floor(Math.random() * animations.length)],
    });
  }
  return shapes;
}

export default function Home() {
  const [shapes, setShapes] = useState<FloatingShape[]>([]);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    setShapes(generateShapes(12));
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Clear all persistence data
    const keysToRemove = [
      'pending_preview',
      'pending_segments',
      'pending_step',
      'last_title',
      'last_author',
      'last_image',
      'last_platform',
      'last_url',
      'last_word_count',
      'last_reading_time',
      'last_first_sentence',
      'last_show_id'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    setResetKey(prev => prev + 1);
    window.history.pushState({}, '', '/');
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

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="py-6 px-8 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <a 
              href="/" 
              onClick={handleLogoClick}
              className="font-semibold text-lg hover:opacity-70 transition-opacity"
            >
              anoncast
            </a>
            <nav>
              <Link 
                href="/generated" 
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Generated Episodes
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="pt-16 pb-12 px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-semibold tracking-tight mb-4 text-gray-900">
              Turn Your Blog Into a Podcast
            </h1>
            <p className="text-lg text-gray-600">
              Paste a link to any blog post or essay. We'll transform it into studio-quality audio you can share with the world.
            </p>
          </div>
        </section>

        {/* Conversion Flow */}
        <section className="px-8 pb-12">
          <ConversionFlow key={resetKey} />
          
          <div className="mt-12 flex flex-col items-center">
            {/* Show Image */}
            <div className="mb-10 w-48 h-48 md:w-64 md:h-64 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white animate-in fade-in zoom-in duration-1000">
              <img 
                src="https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/Anoncast.png" 
                alt="Anoncast Show Art" 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Floating Platform Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <a 
                href="https://open.spotify.com/show/3gHnQIPcwmYlh3ixZ43pvO" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full font-semibold transition-all shadow-md hover:shadow-xl hover:scale-105 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.306c-.22.361-.692.472-1.053.252-2.903-1.774-6.558-2.176-10.865-1.192-.413.094-.827-.163-.921-.575-.094-.413.163-.827.575-.921 4.71-1.077 8.74-.623 12.012 1.381.361.22.472.692.252 1.055zm1.464-3.259c-.276.449-.863.593-1.313.317-3.32-2.039-8.381-2.634-12.308-1.442-.505.153-1.036-.134-1.189-.639-.153-.505.134-1.036.639-1.189 4.49-1.362 10.066-.704 13.854 1.624.449.276.593.863.317 1.329zm.126-3.414c-3.982-2.366-10.551-2.585-14.364-1.428-.611.186-1.258-.168-1.444-.779-.186-.611.168-1.258.779-1.444 4.385-1.33 11.625-1.078 16.195 1.636.55.326.732 1.033.406 1.583-.326.551-1.034.733-1.583.406h-.001z"/>
                </svg>
                Listen on Spotify
              </a>

              <a 
                href="#" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 rounded-full font-semibold transition-all shadow-md hover:shadow-xl hover:scale-105 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#872ec4]">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-12.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .82-.67 1.5-1.5 1.5s-1.5-.68-1.5-1.5zm3.5 1.5v7h-1v-4h-1v4h-1v-7h3zm-3.5 1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .82-.67 1.5-1.5 1.5s-1.5-.68-1.5-1.5z"/>
                  <path d="M12 13.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm0-4c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
                  <path d="M12 17c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/>
                </svg>
                Apple Podcasts
              </a>

              <a 
                href="https://www.anoncast.net/api/feed/00000000-0000-0000-0000-000000000000" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 rounded-full font-semibold transition-all shadow-md hover:shadow-xl hover:scale-105 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#f26522]">
                  <path d="M6.18,15.64A2.18,2.18,0,0,1,8.36,17.82,2.18,2.18,0,0,1,6.18,20,2.18,2.18,0,0,1,4,17.82,2.18,2.18,0,0,1,6.18,15.64Z"/>
                  <path d="M4,4.44V8.05a12.15,12.15,0,0,1,11.51,11.51h3.61A15.72,15.72,0,0,0,4,4.44Z"/>
                  <path d="M4,10.41v3.41a5.93,5.93,0,0,1,5.77,5.77h3.41A9.3,9.3,0,0,0,4,10.41Z"/>
                </svg>
                RSS Feed
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 py-8 px-8 bg-white/80 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <span className="text-sm text-gray-500">
              © 2026 anoncast
            </span>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Terms</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Privacy</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Support</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
