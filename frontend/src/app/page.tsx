'use client';

import React, { useState, useEffect } from 'react';
import { TopNavbar } from '@/components/TopNavbar';
import { CheckoutTerminal } from '@/components/CheckoutTerminal';
import { checkBackendHealth } from '@/lib/api';

export default function Home() {
  const [backendConnected, setBackendConnected] = useState<boolean>(true);

  useEffect(() => {
    // Initial health check
    const checkStatus = async () => {
      const isUp = await checkBackendHealth();
      setBackendConnected(isUp);
    };
    checkStatus();

    // Heartbeat polling
    const interval = setInterval(async () => {
      const isUp = await checkBackendHealth();
      setBackendConnected(isUp);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col font-sans relative selection:bg-[#0071e3] selection:text-white">
      {/* Clean Apple Light navbar */}
      <TopNavbar backendConnected={backendConnected} />

      {/* Smooth Realistic Usecase Workflow Terminal */}
      <main className="flex-1 relative z-10 flex flex-col justify-center py-6 sm:py-10">
        <CheckoutTerminal />
      </main>
    </div>
  );
}
