'use client';

import React from 'react';
import { Radio, Settings, Volume2 } from 'lucide-react';

interface NavbarProps {
  backendConnected: boolean;
  audioLanguage: 'hi' | 'en';
  setAudioLanguage: (lang: 'hi' | 'en') => void;
  onTestChime: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  backendConnected,
  audioLanguage,
  setAudioLanguage,
  onTestChime,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E6EAF5]">
      {/* 1. Stripe Dark Top Banner */}
      <div className="bg-[#0A1530] text-white text-xs px-4 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <span className="bg-[#533AFD] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[3px]">
            Live POC
          </span>
          <span className="text-white/90">
            Paytm Build for India AI Hackathon — Track 1: Merchant Growth AI
          </span>
          <span className="hidden md:inline text-white/30">•</span>
          <span className="hidden md:inline text-[#A8D7FF]">
            Autonomous Voice-to-QR, Partial Udhari & Restock Agent
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-white/90">
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected ? 'bg-[#0E9F6E] animate-pulse' : 'bg-[#FF7A1A]'
              }`}
            />
            <span>{backendConnected ? 'FastAPI 8000 Connected' : 'Zero-Setup Fallback Engine'}</span>
          </div>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 text-[#A8D7FF] hover:text-white transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="font-bold underline decoration-[#533AFD]">API Keys</span>
          </button>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <a href="#" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-[4px] bg-[#533AFD] text-white flex items-center justify-center shadow-xs group-hover:bg-[#4329E0] transition-colors">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[#0A1B3D] tracking-tight">Vani</span>
              <span className="text-[10px] font-bold bg-[#E6EAF5] text-[#0A1B3D] px-1.5 py-0.5 rounded-[2px]">
                Agentic Soundbox
              </span>
            </div>
            <p className="text-[11px] text-[#6B7A99] font-medium leading-none mt-0.5">
              Autonomous Counter & Credit Agent
            </p>
          </div>
        </a>

        {/* Narrative Section Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-[#6B7A99]">
          <a href="#problem" className="hover:text-[#0A1B3D] transition-colors">
            The 3 Leaks
          </a>
          <a href="#flow-voice-qr" className="hover:text-[#0A1B3D] transition-colors">
            Voice-to-QR
          </a>
          <a href="#flow-spoof-guard" className="hover:text-[#0A1B3D] transition-colors">
            Spoof Guard
          </a>
          <a href="#flow-restock" className="hover:text-[#0A1B3D] transition-colors">
            Smart Restock
          </a>
          <a href="#architecture" className="hover:text-[#0A1B3D] transition-colors">
            Architecture
          </a>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Dialect Switcher */}
          <div className="flex items-center bg-[#F8FAFC] border border-[#E6EAF5] rounded-[4px] p-0.5 text-xs font-bold">
            <button
              onClick={() => setAudioLanguage('hi')}
              className={`px-2.5 py-1 rounded-[3px] transition-all cursor-pointer ${
                audioLanguage === 'hi'
                  ? 'bg-white text-[#0A1B3D] shadow-2xs border border-[#E6EAF5]'
                  : 'text-[#6B7A99] hover:text-[#0A1B3D]'
              }`}
            >
              हिन्दी
            </button>
            <button
              onClick={() => setAudioLanguage('en')}
              className={`px-2.5 py-1 rounded-[3px] transition-all cursor-pointer ${
                audioLanguage === 'en'
                  ? 'bg-white text-[#0A1B3D] shadow-2xs border border-[#E6EAF5]'
                  : 'text-[#6B7A99] hover:text-[#0A1B3D]'
              }`}
            >
              English
            </button>
          </div>

          {/* Sound Chime test */}
          <button
            onClick={onTestChime}
            title="Test Soundbox Audio Chime"
            className="h-[40px] px-3.5 bg-white text-[#0A1B3D] border border-[#E6EAF5] hover:border-[#533AFD] rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#533AFD]" />
            <span className="hidden sm:inline">Chime</span>
          </button>

          {/* Primary CTA */}
          <a
            href="#flow-voice-qr"
            className="h-[40px] px-5 bg-[#533AFD] hover:bg-[#4329E0] text-white rounded-[4px] text-xs font-bold flex items-center justify-center transition-colors shadow-xs"
          >
            Try Live Demo ↓
          </a>
        </div>
      </div>
    </header>
  );
};
