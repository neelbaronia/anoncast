"use client";

import React, { useState } from "react";
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
  X
} from "lucide-react";

type Step = "input" | "review" | "generate" | "publish";

interface VoiceOption {
  id: string;
  name: string;
  description: string;
  color: string;
  bgColor: string;
}

const voiceOptions: VoiceOption[] = [
  { id: "alex", name: "Alex", description: "Warm, conversational", color: "#ef4444", bgColor: "#fef2f2" },
  { id: "sarah", name: "Sarah", description: "Professional, clear", color: "#3b82f6", bgColor: "#eff6ff" },
  { id: "marcus", name: "Marcus", description: "Deep, authoritative", color: "#22c55e", bgColor: "#f0fdf4" },
  { id: "emma", name: "Emma", description: "Friendly, engaging", color: "#f59e0b", bgColor: "#fffbeb" },
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

export function ConversionFlow() {
  const [currentStep, setCurrentStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<ScrapedContent | null>(null);
  const [textSegments, setTextSegments] = useState<TextSegment[]>([]);
  const [activeVoice, setActiveVoice] = useState<string>("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!url) return;
    setIsLoading(true);
    setScrapeError(null);
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to scrape URL');
      }
      
      const scraped: ScrapedContent = result.data;
      setPreviewData(scraped);
      
      // Initialize text segments from scraped paragraphs
      setTextSegments(
        scraped.paragraphs.map((text, i) => ({ 
          id: i, 
          text, 
          voiceId: "", 
          confirmed: false 
        }))
      );
    } catch (error) {
      setScrapeError(error instanceof Error ? error.message : 'Failed to fetch content');
      setPreviewData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToReview = () => {
    setCurrentStep("review");
  };

  const handleClearPreview = () => {
    setPreviewData(null);
    setUrl("");
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    
    // Simulate generation progress
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      setGenerationProgress(i);
    }
    
    setIsGenerating(false);
    setCurrentStep("publish");
  };

  const getCurrentStepIndex = () => steps.findIndex((s) => s.id === currentStep);

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
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-8">
          {/* Step 1: Input */}
          {currentStep === "input" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Paste your blog link
                </h2>
                <p className="text-gray-600">
                  We'll extract the content and prepare it for audio conversion
                </p>
              </div>
              
              <div className="flex gap-3">
                <Input
                  type="url"
                  placeholder="https://your-blog.com/article"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (previewData) setPreviewData(null);
                  }}
                  className="flex-1 h-12 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                />
                {(!previewData || isLoading) && (
                  <Button 
                    onClick={handleFetch}
                    disabled={!url || isLoading}
                    className="h-12 px-6 bg-gray-900 hover:bg-gray-800 text-white"
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
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {scrapeError}
                </div>
              )}

              {!previewData && !scrapeError && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <span className="text-xs text-gray-400">Works with</span>
                  <div className="flex gap-3">
                    {["Medium", "Substack", "WordPress", "Ghost", "Custom"].map((platform) => (
                      <Badge 
                        key={platform} 
                        variant="secondary"
                        className="bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {previewData && (
                <>
                  <div className="border border-gray-200 rounded-lg overflow-hidden flex">
                    {previewData.featuredImage ? (
                      <img 
                        src={previewData.featuredImage} 
                        alt="Featured" 
                        className="w-32 h-auto object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-32 bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-gray-400 text-center px-2">No image</span>
                      </div>
                    )}
                    <div className="p-4 space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {previewData.title}
                        </h3>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                          {previewData.platform}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>By {previewData.author || 'Unknown'}</span>
                        <span>•</span>
                        <span>{previewData.wordCount} words</span>
                        <span>•</span>
                        <span>{previewData.estimatedReadTime}</span>
                      </div>
                      <p className="text-gray-600 leading-relaxed line-clamp-2 text-sm">
                        {previewData.paragraphs[0]?.substring(0, 200)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={handleContinueToReview}
                      className="h-12 px-6 bg-gray-900 hover:bg-gray-800 text-white"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Review */}
          {currentStep === "review" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Assign voices to your content
                </h2>
                <p className="text-gray-600">
                  Select a voice, then click on paragraphs to assign that voice
                </p>
              </div>

              <div className="flex gap-6">
                {/* Left column: Voice selection */}
                <div className="w-48 flex-shrink-0 space-y-3">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Voices</h3>
                  {voiceOptions.map((voice) => {
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
                            <span className="block text-xs text-gray-500">{voice.description}</span>
                          </div>
                          {/* Apply all toggle */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (allAssigned) {
                                // Turn off - clear all voices
                                setTextSegments(segments =>
                                  segments.map(s => ({ ...s, voiceId: "", confirmed: false }))
                                );
                              } else {
                                // Turn on - assign this voice to all
                                setTextSegments(segments =>
                                  segments.map(s => ({ ...s, voiceId: voice.id, confirmed: true }))
                                );
                                setActiveVoice(voice.id);
                              }
                            }}
                            className="relative w-10 h-5 rounded-full transition-colors"
                            style={{ 
                              backgroundColor: allAssigned ? voice.color : '#e5e7eb'
                            }}
                            title={allAssigned ? "Remove from all" : "Apply to all paragraphs"}
                          >
                            <div 
                              className={`
                                absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all
                                ${allAssigned ? 'left-5' : 'left-0.5'}
                              `}
                            />
                          </button>
                        </div>
                        <button 
                          className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          <Volume2 className="w-3 h-3" />
                          Preview
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Right column: Text content */}
                <div className="flex-1 border border-gray-200 rounded-lg p-6 max-h-[500px] overflow-y-auto">
                  <input
                    type="text"
                    defaultValue={previewData?.title || "Untitled"}
                    className="text-lg font-semibold text-gray-900 mb-4 w-full bg-transparent border-none focus:outline-none focus:ring-0"
                  />
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
                                    s.id === segment.id ? { ...s, voiceId: activeVoice, confirmed: false } : s
                                  )
                                );
                              }
                            }}
                            className={`
                              flex-1 rounded-md transition-all
                              ${activeVoice ? "cursor-pointer hover:opacity-80" : ""}
                            `}
                            style={{ 
                              backgroundColor: hasVoice ? voice.bgColor : "transparent",
                              borderLeft: hasVoice ? `3px solid ${voice.color}` : "3px solid #e5e5e5"
                            }}
                          >
                            <textarea
                              defaultValue={segment.text}
                              onBlur={(e) => {
                                // Sync state on blur to preserve browser undo
                                setTextSegments(segments =>
                                  segments.map(s =>
                                    s.id === segment.id ? { ...s, text: e.target.value } : s
                                  )
                                );
                              }}
                              onInput={(e) => {
                                // Auto-resize on input
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = "auto";
                                target.style.height = target.scrollHeight + "px";
                              }}
                              onFocus={(e) => {
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                              ref={(el) => {
                                if (el) {
                                  el.style.height = "auto";
                                  el.style.height = el.scrollHeight + "px";
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 resize-none leading-relaxed px-3 py-2 text-gray-700 overflow-hidden"
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
                    <span className="text-gray-500">Estimated runtime: </span>
                    <span className="font-medium text-gray-900">
                      {Math.ceil(textSegments.reduce((acc, s) => acc + s.text.split(" ").length, 0) / 150)} min
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Generation cost: </span>
                    <span className="font-medium text-gray-900">
                      ${(textSegments.reduce((acc, s) => acc + s.text.length, 0) * 0.0001).toFixed(2)}
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

              <div className="flex gap-3 pt-2">
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
                  className="flex-1 h-12 bg-gray-900 hover:bg-gray-800 text-white"
                >
                  Generate Audio
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Generate */}
          {currentStep === "generate" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Generate audio
                </h2>
                <p className="text-gray-600">
                  Preview your audio before publishing
                </p>
              </div>

              {!isGenerating && generationProgress === 0 ? (
                <div className="text-center py-8">
                  {!showPayment ? (
                    <>
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg inline-block">
                        <div className="text-sm text-gray-500 mb-1">Total cost</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          ${(textSegments.reduce((acc, s) => acc + s.text.length, 0) * 0.0001).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <Button 
                          onClick={() => setShowPayment(true)}
                          size="lg"
                          className="h-14 px-8 bg-gray-900 hover:bg-gray-800 text-white"
                        >
                          <CreditCard className="w-5 h-5 mr-2" />
                          Pay & Generate
                        </Button>
                      </div>
                      <p className="mt-4 text-sm text-gray-500">
                        Estimated time: ~30 seconds
                      </p>
                      <button
                        onClick={() => setCurrentStep("review")}
                        className="mt-6 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        ← Back to Review
                      </button>
                    </>
                  ) : (
                    <div className="max-w-sm mx-auto">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
                        <button 
                          onClick={() => setShowPayment(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="space-y-4 text-left">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Card Number
                          </label>
                          <Input 
                            placeholder="4242 4242 4242 4242"
                            className="h-11"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Expiry
                            </label>
                            <Input 
                              placeholder="MM / YY"
                              className="h-11"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              CVC
                            </label>
                            <Input 
                              placeholder="123"
                              className="h-11"
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                          <div className="flex justify-between text-sm mb-4">
                            <span className="text-gray-500">Total</span>
                            <span className="font-semibold text-gray-900">
                              ${(textSegments.reduce((acc, s) => acc + s.text.length, 0) * 0.0001).toFixed(2)}
                            </span>
                          </div>
                          
                          <Button 
                            onClick={async () => {
                              setPaymentProcessing(true);
                              await new Promise(r => setTimeout(r, 1500));
                              setPaymentProcessing(false);
                              setShowPayment(false);
                              handleGenerate();
                            }}
                            disabled={paymentProcessing}
                            className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white"
                          >
                            {paymentProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Lock className="w-4 h-4 mr-2" />
                                Pay ${(textSegments.reduce((acc, s) => acc + s.text.length, 0) * 0.0001).toFixed(2)}
                              </>
                            )}
                          </Button>
                          
                          <p className="mt-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                            <Lock className="w-3 h-3" />
                            Secured by Stripe
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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
                  <div className="space-y-2">
                    <Progress value={generationProgress} className="h-2" />
                    <p className="text-center text-sm text-gray-600">
                      Generating audio... {generationProgress}%
                    </p>
                  </div>
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
                    <span className="text-sm text-gray-500">0:00</span>
                    <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-900 w-0" />
                    </div>
                    <span className="text-sm text-gray-500">8:24</span>
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

          {/* Step 4: Publish */}
          {currentStep === "publish" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Ready to publish</span>
                </div>
                <p className="text-gray-600">
                  Your audio is ready. Share it with the world.
                </p>
              </div>

              {/* Audio Card */}
              <div className="border border-gray-200 rounded-xl overflow-hidden max-w-md mx-auto">
                <div className="relative">
                  {previewData?.featuredImage ? (
                    <img 
                      src={previewData.featuredImage} 
                      alt="Featured" 
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <Mic className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {/* Play button overlay */}
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center">
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-gray-900" />
                      ) : (
                        <Play className="w-6 h-6 text-gray-900 ml-1" />
                      )}
                    </div>
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{previewData?.title || "Untitled"}</h3>
                  <p className="text-sm text-gray-500">
                    {Math.ceil(textSegments.reduce((acc, s) => acc + s.text.split(" ").length, 0) / 150)} min • {previewData?.author || "Unknown"}
                  </p>
                  {/* Mini progress bar */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-gray-400">0:00</span>
                    <div className="flex-1 h-1 bg-gray-200 rounded-full">
                      <div className="h-full bg-gray-900 rounded-full w-0" />
                    </div>
                    <span className="text-xs text-gray-400">
                      {Math.ceil(textSegments.reduce((acc, s) => acc + s.text.split(" ").length, 0) / 150)}:00
                    </span>
                  </div>
                </div>
              </div>
                
              <div className="flex flex-col gap-3 max-w-sm mx-auto pt-4">
                <Button className="h-12 bg-gray-900 hover:bg-gray-800 text-white">
                  <Share2 className="w-4 h-4 mr-2" />
                  Add to RSS Feed
                </Button>
                <Button variant="outline" className="h-12 border-gray-200 text-gray-700 hover:bg-gray-50">
                    Export Audio
                  </Button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => {
                    setCurrentStep("input");
                    setUrl("");
                    setGenerationProgress(0);
                    setPreviewData(null);
                    setShowPayment(false);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Convert another article
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
