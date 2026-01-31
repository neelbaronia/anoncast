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
  Loader2
} from "lucide-react";

type Step = "input" | "review" | "generate" | "publish";

interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

const voiceOptions: VoiceOption[] = [
  { id: "alex", name: "Alex", description: "Warm, conversational" },
  { id: "sarah", name: "Sarah", description: "Professional, clear" },
  { id: "marcus", name: "Marcus", description: "Deep, authoritative" },
  { id: "emma", name: "Emma", description: "Friendly, engaging" },
];

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
  const [selectedVoice, setSelectedVoice] = useState<string>("alex");
  const [isPlaying, setIsPlaying] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Mock extracted content
  const mockContent = {
    title: "The Future of AI in Content Creation",
    author: "Jane Smith",
    wordCount: 1847,
    readingTime: "8 min",
    excerpt: "As artificial intelligence continues to evolve, we're witnessing a fundamental shift in how content is created, distributed, and consumed. This article explores the implications for creators and audiences alike...",
  };

  const handleFetch = async () => {
    if (!url) return;
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
    setCurrentStep("review");
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
    <div className="max-w-3xl mx-auto">
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
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 h-12 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                />
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
              </div>

              <div className="flex items-center justify-center gap-4 pt-4">
                <span className="text-xs text-gray-400">Works with</span>
                <div className="flex gap-3">
                  {["Medium", "Substack", "WordPress", "Ghost"].map((platform) => (
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
            </div>
          )}

          {/* Step 2: Review */}
          {currentStep === "review" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Review content
                </h2>
                <p className="text-gray-600">
                  Make sure we extracted everything correctly
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {mockContent.title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>By {mockContent.author}</span>
                  <span>•</span>
                  <span>{mockContent.wordCount} words</span>
                  <span>•</span>
                  <span>{mockContent.readingTime} read</span>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  {mockContent.excerpt}
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Choose a voice</h3>
                <div className="grid grid-cols-2 gap-3">
                  {voiceOptions.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`
                        p-4 rounded-lg border text-left transition-all
                        ${selectedVoice === voice.id
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 hover:border-gray-300"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{voice.name}</span>
                          <span className="block text-sm text-gray-500">{voice.description}</span>
                        </div>
                        <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                          <Volume2 className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline"
                  onClick={() => setCurrentStep("input")}
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
                  <Button 
                    onClick={handleGenerate}
                    size="lg"
                    className="h-14 px-8 bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Start Generation
                  </Button>
                  <p className="mt-4 text-sm text-gray-500">
                    Estimated time: ~30 seconds
                  </p>
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
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Ready to publish
                </h2>
                <p className="text-gray-600 mb-8">
                  Your audio is ready. Share it with the world.
                </p>
                
                <div className="flex flex-col gap-3 max-w-sm mx-auto">
                  <Button className="h-12 bg-gray-900 hover:bg-gray-800 text-white">
                    <Share2 className="w-4 h-4 mr-2" />
                    Add to RSS Feed
                  </Button>
                  <Button variant="outline" className="h-12 border-gray-200 text-gray-700 hover:bg-gray-50">
                    Download Audio
                  </Button>
                </div>

                <button
                  onClick={() => {
                    setCurrentStep("input");
                    setUrl("");
                    setGenerationProgress(0);
                  }}
                  className="mt-8 text-sm text-gray-500 hover:text-gray-900 transition-colors"
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
