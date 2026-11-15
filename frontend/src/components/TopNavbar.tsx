'use client';

import React from 'react';
import { Radio } from 'lucide-react';

export const TopNavbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#e5e7eb]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#0071e3] flex items-center justify-center text-white shadow-xs">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-base text-[#1d1d1f] tracking-tight">Paytm Counter</span>
        </div>
      </div>
    </header>
  );
};
