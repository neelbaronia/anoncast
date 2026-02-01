"use client";

import { ConversionFlow } from "@/components/conversion-flow";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    setShapes(generateShapes(12));
  }, []);

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
            <div className="font-semibold text-lg">
              anoncast
            </div>
            <nav className="flex items-center gap-8">
              <button className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                Sign in
              </button>
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
        <section className="px-8 pb-24">
          <ConversionFlow />
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
