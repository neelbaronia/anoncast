"use client";

import { ConversionFlow } from "@/components/conversion-flow";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="py-6 px-8 border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="font-semibold text-lg">
            anoncast
          </div>
          <nav className="flex items-center gap-8">
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              How it works
            </a>
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
      <footer className="border-t border-gray-100 py-8 px-8">
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
    </main>
  );
}
