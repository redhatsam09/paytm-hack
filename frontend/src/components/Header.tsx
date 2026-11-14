'use client';

import React from 'react';
import {
  Mic,
  MessageSquare,
  LayoutGrid,
  Volume2,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Radio,
  Settings,
  ChevronRight,
} from 'lucide-react';

export type ViewMode = 'soundbox' | 'spoof_guard' | 'whatsapp' | 'studio';

interface HeaderProps {
  backendConnected: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onResetDemo: () => void;
  audioLanguage: 'hi' | 'en';
  setAudioLanguage: (lang: 'hi' | 'en') => void;
  onTestChime: () => void;
  onRunScenario: (scenario: 1 | 2 | 3) => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  backendConnected,
  viewMode,
  setViewMode,
  onResetDemo,
  audioLanguage,
  setAudioLanguage,
  onTestChime,
  onRunScenario,
  onOpenSettings,
}) => {
  return (
    <header className="bg-white border-b border-[#E6EAF5] sticky top-0 z-40">
      {/* 1. Stripe-style Dark Announcement Banner */}
      <div className="bg-[#0A1530] text-white text-xs px-4 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <span className="bg-[#533AFD] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[3px]">
            Live POC
          </span>
          <span className="text-white/90">
            Paytm Build for India AI Hackathon — Track 1: Merchant Growth AI
          </span>
          <span className="hidden md:inline text-white/40">•</span>
          <span className="hidden md:inline text-[#A8D7FF]">
            Autonomous Voice-to-QR, Partial Udhari & Restock Agent
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-white/90">
            <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-[#0E9F6E] animate-pulse' : 'bg-[#FF7A1A]'}`} />
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
      <div className="max-w-[1720px] mx-auto px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand: Vani Soundbox */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[6px] bg-[#533AFD] text-white flex items-center justify-center shadow-xs">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0A1B3D] tracking-tight">
                Vani Soundbox
              </h1>
              <span className="bg-[#E6EAF5] text-[#0A1B3D] text-[11px] font-bold px-2 py-0.5 rounded-[4px]">
                Hardware Simulator
              </span>
            </div>
            <p className="text-xs text-[#6B7A99] font-medium">
              Sri Lakshmi Stores • Automated Dual-Screen Counter Agent
            </p>
          </div>
        </div>

        {/* View Mode Switcher: Disciplined Stripe Tabs */}
        <div className="flex items-center bg-[#F8FAFC] border border-[#E6EAF5] rounded-[4px] p-1">
          <button
            onClick={() => setViewMode('soundbox')}
            className={`h-[36px] px-3.5 rounded-[3px] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'soundbox'
                ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
                : 'text-[#6B7A99] hover:text-[#0A1B3D]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Counter Soundbox</span>
          </button>

          <button
            onClick={() => setViewMode('spoof_guard')}
            className={`h-[36px] px-3.5 rounded-[3px] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'spoof_guard'
                ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
                : 'text-[#6B7A99] hover:text-[#0A1B3D]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Spoof & Mismatch Guard</span>
          </button>

          <button
            onClick={() => setViewMode('whatsapp')}
            className={`h-[36px] px-3.5 rounded-[3px] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'whatsapp'
                ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
                : 'text-[#6B7A99] hover:text-[#0A1B3D]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Ledger & Restock</span>
          </button>

          <button
            onClick={() => setViewMode('studio')}
            className={`h-[36px] px-3.5 rounded-[3px] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'studio'
                ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
                : 'text-[#6B7A99] hover:text-[#0A1B3D]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Dual-Screen Studio</span>
          </button>
        </div>

        {/* Language, Chime & Reset */}
        <div className="flex items-center gap-2.5">
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
              हिन्दी / Hinglish
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

          {/* Test Soundbox Broadcast */}
          <button
            onClick={onTestChime}
            title="Test Soundbox Voice Broadcast"
            className="h-[38px] px-3.5 bg-white text-[#0A1B3D] border border-[#E6EAF5] hover:border-[#533AFD] rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#533AFD]" />
            <span className="hidden sm:inline">Chime</span>
          </button>

          {/* Reset Demo */}
          <button
            onClick={onResetDemo}
            title="Reset counter to baseline state"
            className="h-[38px] px-3.5 bg-white text-[#0A1B3D] border border-[#E6EAF5] hover:border-[#0A1B3D] rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#6B7A99]" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* 3. 1-Click Interactive Guided Demo Bar */}
      <div className="bg-[#FAFBFD] border-t border-[#E6EAF5] px-4 lg:px-8 py-2.5">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0A1B3D]">
            <Sparkles className="w-4 h-4 text-[#533AFD]" />
            <span>Interactive Hackathon Scenarios:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onRunScenario(1)}
              className="h-[34px] px-4 bg-white hover:bg-[#533AFD]/5 text-[#533AFD] border border-[#533AFD]/30 rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
            >
              <span className="w-2 h-2 rounded-full bg-[#0E9F6E]" />
              <span>Flow 1: ₹650 Bill Split (₹400 UPI + ₹250 Udhari)</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => onRunScenario(2)}
              className="h-[34px] px-4 bg-white hover:bg-red-50 text-[#E02424] border border-[#E02424]/30 rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
            >
              <span className="w-2 h-2 rounded-full bg-[#E02424]" />
              <span>Flow 2: ₹40 Short Payment Spoof (Deficit Siren)</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => onRunScenario(3)}
              className="h-[34px] px-4 bg-white hover:bg-emerald-50 text-[#0E9F6E] border border-[#0E9F6E]/30 rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
            >
              <span className="w-2 h-2 rounded-full bg-[#FF7A1A]" />
              <span>Flow 3: Snap-to-Restock (+10.7% Price Creep OCR)</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
