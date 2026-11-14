'use client';

import React from 'react';
import { ArrowDown, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onOpenSettings: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenSettings }) => {
  return (
    <section className="pt-16 pb-20 border-b border-[#E6EAF5] bg-white">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="max-w-4xl">
          {/* Subtle Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#533AFD]/5 border border-[#533AFD]/20 rounded-[4px] text-xs font-bold text-[#533AFD] mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Voice-to-QR & Credit Recovery Agent</span>
          </div>

          {/* Headline (Editorial Stripe Light: weight 300, tight tracking) */}
          <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-light tracking-tight text-[#0A1B3D] leading-[1.1] mb-6">
            Every kirana counter leaks ₹800 a day. We built the fix.
          </h1>

          {/* 2-line clean subtitle */}
          <p className="text-lg sm:text-xl text-[#6B7A99] font-normal leading-relaxed max-w-2xl mb-8">
            Vani transforms passive audio soundboxes into an active dual-screen counter agent and automated WhatsApp ledger—eliminating manual typing, stopping static QR fraud, and recovering unrecorded store credit.
          </p>

          {/* Two Distinct CTAs */}
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#flow-voice-qr"
              className="h-[48px] px-7 bg-[#533AFD] hover:bg-[#4329E0] text-white rounded-[4px] text-sm font-bold flex items-center gap-2 transition-colors shadow-xs"
            >
              <span>Try Live Demo</span>
              <ArrowDown className="w-4 h-4" />
            </a>

            <a
              href="#problem"
              className="h-[48px] px-6 bg-white text-[#0A1B3D] border border-[#E6EAF5] hover:border-[#0A1B3D] rounded-[4px] text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <span>How It Works</span>
              <ArrowDown className="w-4 h-4 text-[#6B7A99]" />
            </a>

            <button
              onClick={onOpenSettings}
              className="h-[48px] px-5 text-xs font-bold text-[#6B7A99] hover:text-[#533AFD] transition-colors ml-1 cursor-pointer"
            >
              Configure Live API Keys →
            </button>
          </div>
        </div>

        {/* 3 Metric Stat Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-16 pt-10 border-t border-[#E6EAF5]">
          <div>
            <div className="text-3xl font-light text-[#0A1B3D] tracking-tight mb-1">
              &lt; 350<span className="text-sm font-semibold text-[#6B7A99] ml-1">ms</span>
            </div>
            <div className="text-xs font-bold text-[#0A1B3D]">Intent Extraction Latency</div>
            <p className="text-xs text-[#6B7A99] mt-0.5">
              Groq Llama-3.3-70B decomposes complex bilingual checkout splits instantly.
            </p>
          </div>

          <div>
            <div className="text-3xl font-light text-[#0A1B3D] tracking-tight mb-1">
              100<span className="text-sm font-semibold text-[#6B7A99] ml-1">%</span>
            </div>
            <div className="text-xs font-bold text-[#0A1B3D]">Real-Time Deficit Trap</div>
            <p className="text-xs text-[#6B7A99] mt-0.5">
              Webhook Spoof Guard flags ₹40 paid on ₹400 bill before customer leaves.
            </p>
          </div>

          <div>
            <div className="text-3xl font-light text-[#0A1B3D] tracking-tight mb-1">
              ₹24,000<span className="text-sm font-semibold text-[#6B7A99] ml-1">/mo</span>
            </div>
            <div className="text-xs font-bold text-[#0A1B3D]">Avg Recovered Margin</div>
            <p className="text-xs text-[#6B7A99] mt-0.5">
              Automated WhatsApp payment links and wholesale price creep OCR alerts.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
