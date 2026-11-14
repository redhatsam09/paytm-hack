'use client';

import React from 'react';
import { Radio, ArrowUp } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-[#E6EAF5] py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#6B7A99]">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[3px] bg-[#533AFD] text-white flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-[#0A1B3D]">Vani Soundbox</span>
            <span className="mx-2">•</span>
            <span>Autonomous Voice-to-QR & Credit Recovery</span>
          </div>
        </div>

        {/* Hackathon Credits */}
        <div className="text-center sm:text-right">
          <div>Built for Build for India AI Hackathon — Chennai 2026</div>
          <div className="text-[11px] text-[#6B7A99] mt-0.5">
            Track 1: Merchant Growth AI • Architectural Spec & Execution Engine by Sayandeep Dutta
          </div>
        </div>

        {/* Back to top */}
        <a
          href="#"
          className="flex items-center gap-1.5 text-xs font-bold text-[#0A1B3D] hover:text-[#533AFD] transition-colors"
        >
          <span>Back to Top</span>
          <ArrowUp className="w-3.5 h-3.5" />
        </a>
      </div>
    </footer>
  );
};
