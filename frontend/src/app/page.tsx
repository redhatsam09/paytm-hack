'use client';

import React from 'react';
import { TopNavbar } from '@/components/TopNavbar';
import { CheckoutTerminal } from '@/components/CheckoutTerminal';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col font-sans relative selection:bg-[#0071e3] selection:text-white">
      <TopNavbar />
      <main className="flex-1 relative z-10 flex flex-col justify-center py-6 sm:py-10">
        <CheckoutTerminal />
      </main>
    </div>
  );
}
