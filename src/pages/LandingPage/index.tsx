import React, { useState } from 'react';
import './landing.css';

const LandingPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: 'Upload Your Video',
      description: 'Select any video or audio file from your computer. MP4, WebM, MOV, MP3, WAV, and more supported.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
    {
      title: 'AI Understands Your Content',
      description: 'Our local Gemma AI model analyzes your video, extracts audio, and builds a complete understanding of the content.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: 'Ask Anything',
      description: 'Chat naturally with your video. Ask questions, request summaries, or dive deep into specific topics.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      title: 'Completely Private',
      description: 'Everything happens in your browser. Your videos never leave your device. No cloud, no servers, no data sharing.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ];

  const features = [
    {
      title: 'Conversational Video Analysis',
      description: 'Don\'t just watch videos—have a conversation with them. Ask questions in plain English and get precise answers with timestamps.',
      icon: '💬',
    },
    {
      title: 'Your Data Stays Yours',
      description: '100% local processing in your browser. No uploads to external servers. Your videos, transcripts, and conversations never leave your machine.',
      icon: '🔒',
    },
    {
      title: 'Powered by Local AI',
      description: 'Uses Gemma, a state-of-the-art AI model that runs directly in your browser via WebGPU. Fast, accurate, and completely offline after first load.',
      icon: '🤖',
    },
    {
      title: 'Smart Transcript Search',
      description: 'Every word is indexed and searchable. Jump to exact moments by asking questions like "What did they say about pricing?"',
      icon: '🔍',
    },
    {
      title: 'Works with Any Media',
      description: 'Upload videos, podcasts, lectures, interviews, or meetings. Supports MP4, WebM, MOV, MP3, WAV, M4A, FLAC, and more.',
      icon: '📹',
    },
    {
      title: 'No Account Needed',
      description: 'Start instantly. No sign-up, no subscription, no credit card. Just open the app and start chatting with your videos.',
      icon: '⚡',
    },
  ];

  const exampleQuestions = [
    "What are the main points discussed in this video?",
    "Summarize the key takeaways from the first 10 minutes",
    "What did the speaker say about implementation details?",
    "Find the timestamp where they mention the budget",
    "Explain the concept they discussed around the 15-minute mark",
    "List all the action items mentioned in this meeting",
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 border border-purple-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">VaultClip</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#how-it-works" className="text-slate-400 hover:text-white transition-colors text-sm">
              How it Works
            </a>
            <a
              href="/app"
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25"
            >
              Try it Now
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700 mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-slate-300">100% Private • Runs in Your Browser • Free</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Have a{' '}
              <span className="gradient-text">Conversation</span>
              {' '}with Your Videos
            </h1>

            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Upload any video and start asking questions. VaultClip uses local AI to understand 
              your content and chat with you about it—completely privately, with no data ever leaving your device.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/app"
                className="group px-8 py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-semibold rounded-xl text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/30"
              >
                <span className="flex items-center gap-2">
                  Start Chatting with Your Videos
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H12" />
                  </svg>
                </span>
              </a>
            </div>

            <p className="mt-6 text-sm text-slate-500">
              No account required • No uploads to external servers • Works offline after first load
            </p>
          </div>

          {/* Demo Preview */}
          <div className="mt-16 relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-2xl overflow-hidden border border-slate-700/50 card-glow bg-slate-800/50">
              <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-4 text-sm text-slate-400">VaultClip - Chat with Your Video</span>
              </div>
              <div className="p-6 space-y-4">
                {/* Chat bubbles showing the interaction */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="bg-slate-700/50 rounded-2xl rounded-tl-none px-4 py-3 max-w-lg">
                    <p className="text-slate-200">What are the main points discussed in this video?</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl rounded-tr-none px-4 py-3 max-w-lg border border-blue-500/20">
                    <p className="text-slate-200">Based on the video, here are the key points:</p>
                    <ul className="mt-2 space-y-1 text-slate-300 text-sm list-disc list-inside">
                      <li>The project uses local AI processing for privacy (02:15)</li>
                      <li>WebGPU acceleration enables fast inference (03:42)</li>
                      <li>No data is sent to external servers (05:20)</li>
                    </ul>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="bg-slate-700/50 rounded-2xl rounded-tl-none px-4 py-3 max-w-lg">
                    <p className="text-slate-200">Jump to the part about WebGPU</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What is Clip Mind Section */}
      <section className="py-20 bg-slate-800/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">
                What is <span className="gradient-text">VaultClip</span>?
              </h2>
              <div className="space-y-4 text-lg text-slate-300">
                <p>
                  VaultClip is a <strong className="text-white">private video assistant</strong> that lives entirely in your browser.
                  It uses local AI to understand your videos and lets you have natural conversations about them.
                </p>
                <p>
                  Unlike other tools that upload your videos to the cloud, VaultClip processes everything 
                  <strong className="text-white"> locally on your machine</strong>. Your videos, transcripts, 
                  and conversations never leave your device.
                </p>
                <p>
                  Whether you're a student reviewing lecture recordings, a professional analyzing meeting footage, 
                  or a researcher going through interviews—just upload your video and start asking questions.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-slate-800 rounded-full text-sm text-slate-300 border border-slate-700">No cloud uploads</span>
                <span className="px-4 py-2 bg-slate-800 rounded-full text-sm text-slate-300 border border-slate-700">No subscription</span>
                <span className="px-4 py-2 bg-slate-800 rounded-full text-sm text-slate-300 border border-slate-700">No data collection</span>
                <span className="px-4 py-2 bg-slate-800 rounded-full text-sm text-slate-300 border border-slate-700">Works offline</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl" />
              <div className="relative bg-slate-800/60 rounded-2xl p-8 border border-slate-700/50">
                <h3 className="text-xl font-semibold text-white mb-4">Example Questions You Can Ask</h3>
                <div className="space-y-3">
                  {exampleQuestions.map((question, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-blue-400">{index + 1}</span>
                      </div>
                      <p className="text-slate-300 text-sm">{question}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              How It <span className="gradient-text">Works</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Four simple steps to start chatting with your videos. No technical knowledge required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className="relative cursor-pointer"
                onMouseEnter={() => setActiveStep(index)}
              >
                <div className={`p-6 rounded-2xl border h-full transition-all duration-300 ${
                  activeStep === index 
                    ? 'bg-slate-800/80 border-blue-500/50 card-glow' 
                    : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50'
                }`}>
                  <div className="text-blue-400 mb-4">{step.icon}</div>
                  <div className="text-5xl font-bold gradient-text mb-4">0{index + 1}</div>
                  <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Start Guide */}
          <div className="mt-16 bg-slate-800/40 rounded-2xl p-8 border border-slate-700/50">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Quick Start Guide for First-Time Users</h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">1. Open the App</h4>
                <p className="text-slate-400 text-sm">
                  Click "Try it Now" above. The app opens in your browser. No installation needed.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">2. Upload a Video</h4>
                <p className="text-slate-400 text-sm">
                  Click "Choose File" and select any video or audio file from your computer.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-pink-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">3. Start Chatting</h4>
                <p className="text-slate-400 text-sm">
                  Once processed, type your questions in the chat box and get instant answers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-800/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Why Use <span className="gradient-text">VaultClip</span>?
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Designed for anyone who wants to understand video content faster and more interactively.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 hover:bg-slate-800/60"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 rounded-3xl p-12 border border-slate-700/50">
            <div className="text-center max-w-3xl mx-auto">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Your Privacy is <span className="gradient-text">Non-Negotiable</span>
              </h2>
              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                We believe your videos are yours alone. VaultClip runs entirely in your browser using 
                local AI. There are no servers, no cloud storage, and no data sharing. 
                <strong className="text-white"> Ever.</strong>
              </p>
              <div className="grid sm:grid-cols-3 gap-6 text-left">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <h4 className="font-semibold text-white mb-2">No Uploads</h4>
                  <p className="text-sm text-slate-400">Your videos never leave your device. Everything is processed locally.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <h4 className="font-semibold text-white mb-2">No Tracking</h4>
                  <p className="text-sm text-slate-400">We don't collect any data about you or your videos. Zero analytics.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <h4 className="font-semibold text-white mb-2">Open Source</h4>
                  <p className="text-sm text-slate-400">Built with open-source models and tools. Transparent and auditable.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Chat with Your Videos?
          </h2>
          <p className="text-xl text-slate-300 mb-10">
            Start having conversations with your video content today. No account, no setup, no compromise on privacy.
          </p>
          <a
            href="/app"
            className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-bold text-xl rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/40"
          >
            Launch VaultClip
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H12" />
            </svg>
          </a>
          <p className="mt-6 text-sm text-slate-500">
            Free forever • No account required • Your data stays on your device
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-white">VaultClip</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <span>Private Video Q&A</span>
              <span>•</span>
              <span>Local AI Processing</span>
              <span>•</span>
              <span>100% Free</span>
            </div>
            <div className="text-sm text-slate-500">
              © 2026 VaultClip
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;