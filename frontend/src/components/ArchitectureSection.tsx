'use client';

import React from 'react';
import { Settings, Cpu, ShieldCheck, Terminal, Layers, Radio, Sparkles } from 'lucide-react';

interface ArchitectureSectionProps {
  onOpenSettings: () => void;
}

export const ArchitectureSection: React.FC<ArchitectureSectionProps> = ({ onOpenSettings }) => {
  return (
    <section id="architecture" className="py-24 border-b border-[#E6EAF5] bg-[#FAFBFD]">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#533AFD] mb-2 block">
            System Architecture & Extensibility
          </span>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-[#0A1B3D] leading-tight">
            Built for ultra-low latency and offline resilience.
          </h2>
          <p className="text-base text-[#6B7A99] mt-3">
            Designed to operate flawlessly in Indian network realities. Integrates high-performance LLM intent extraction with hardware-native payment webhooks.
          </p>
        </div>

        {/* Tech Stack Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Sarvam AI */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs">
            <div className="w-10 h-10 rounded-[4px] bg-[#533AFD]/10 text-[#533AFD] flex items-center justify-center mb-4">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0A1B3D] tracking-tight mb-1">
              Sarvam AI Speech Engine
            </h3>
            <p className="text-xs text-[#6B7A99] leading-relaxed">
              Trained on Indian regional accents and Hinglish dialect patterns for natural storekeeper speech recognition.
            </p>
            <span className="inline-block mt-3 text-[11px] font-bold text-[#533AFD] bg-[#533AFD]/10 px-2 py-0.5 rounded-[2px]">
              Regional Speech ASR
            </span>
          </div>

          {/* Card 2: Groq Llama-3.3 */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs">
            <div className="w-10 h-10 rounded-[4px] bg-[#0E9F6E]/10 text-[#0E9F6E] flex items-center justify-center mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0A1B3D] tracking-tight mb-1">
              Groq Llama-3.3-70B Versatile
            </h3>
            <p className="text-xs text-[#6B7A99] leading-relaxed">
              Ultra-fast tool calling and bill intent decomposition (&lt;350ms) outputting strictly structured JSON splits.
            </p>
            <span className="inline-block mt-3 text-[11px] font-bold text-[#0E9F6E] bg-emerald-50 px-2 py-0.5 rounded-[2px]">
              &lt; 350ms Latency
            </span>
          </div>

          {/* Card 3: Gemini 2.5 Flash Vision */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs">
            <div className="w-10 h-10 rounded-[4px] bg-[#FF7A1A]/10 text-[#FF7A1A] flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0A1B3D] tracking-tight mb-1">
              Gemini 2.5 Flash Vision
            </h3>
            <p className="text-xs text-[#6B7A99] leading-relaxed">
              Analyzes crumpled, photographed wholesale paper invoices, extracting tabular SKUs, quantities, and unit rates.
            </p>
            <span className="inline-block mt-3 text-[11px] font-bold text-[#FF7A1A] bg-amber-50 px-2 py-0.5 rounded-[2px]">
              Invoice OCR & Price Audit
            </span>
          </div>

          {/* Card 4: Dynamic Amount-Locked QR */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs">
            <div className="w-10 h-10 rounded-[4px] bg-[#0A1B3D]/10 text-[#0A1B3D] flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0A1B3D] tracking-tight mb-1">
              Amount-Locked UPI Payloads
            </h3>
            <p className="text-xs text-[#6B7A99] leading-relaxed">
              Standard NPCI intent URLs (<code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">am=400.00&tr=INV-1092</code>) preventing buyers from manually modifying payment sums.
            </p>
            <span className="inline-block mt-3 text-[11px] font-bold text-[#0A1B3D] bg-gray-100 px-2 py-0.5 rounded-[2px]">
              NPCI Dynamic QR
            </span>
          </div>

          {/* Card 5: WhatsApp Cloud API */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs">
            <div className="w-10 h-10 rounded-[4px] bg-[#075E54]/10 text-[#075E54] flex items-center justify-center mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0A1B3D] tracking-tight mb-1">
              WhatsApp Business Engine
            </h3>
            <p className="text-xs text-[#6B7A99] leading-relaxed">
              Dispatches automated payment links directly to customer WhatsApp chats and delivers standardized POs to distributors.
            </p>
            <span className="inline-block mt-3 text-[11px] font-bold text-[#075E54] bg-emerald-50 px-2 py-0.5 rounded-[2px]">
              Automated Recovery
            </span>
          </div>

          {/* Card 6: FastAPI & SQLite */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs">
            <div className="w-10 h-10 rounded-[4px] bg-[#533AFD]/10 text-[#533AFD] flex items-center justify-center mb-4">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0A1B3D] tracking-tight mb-1">
              FastAPI 0.115 + SQLite
            </h3>
            <p className="text-xs text-[#6B7A99] leading-relaxed">
              Asynchronous backend with SQLAlchemy 2.0 (aiosqlite) supporting Server-Sent Events (SSE) and sub-millisecond route execution.
            </p>
            <span className="inline-block mt-3 text-[11px] font-bold text-[#533AFD] bg-[#533AFD]/10 px-2 py-0.5 rounded-[2px]">
              High Performance Server
            </span>
          </div>
        </div>

        {/* API Settings Drawer Trigger Banner */}
        <div className="bg-white p-8 rounded-[6px] border border-[#E6EAF5] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0E9F6E] animate-pulse" />
              <h3 className="text-sm font-bold text-[#0A1B3D]">
                Running in Zero-Setup Mock Engine (Judge-Ready)
              </h3>
            </div>
            <p className="text-xs text-[#6B7A99] max-w-xl">
              All 3 flows are fully operational out of the box with realistic fallback data. Plug in your own API keys anytime to route requests to live external providers.
            </p>
          </div>

          <button
            onClick={onOpenSettings}
            className="h-[46px] px-6 bg-[#533AFD] hover:bg-[#4329E0] text-white rounded-[4px] text-xs font-bold flex items-center gap-2 shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>Open API Key Configuration</span>
          </button>
        </div>
      </div>
    </section>
  );
};
