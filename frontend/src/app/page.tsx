'use client';

import React, { useState, useEffect } from 'react';
import { TopNavbar } from '@/components/TopNavbar';
import { CheckoutTerminal } from '@/components/CheckoutTerminal';
import { checkBackendHealth, subscribeToEvents } from '@/lib/api';

export default function Home() {
  const [backendConnected, setBackendConnected] = useState<boolean>(true);

  useEffect(() => {
    // Initial health check
    const checkStatus = async () => {
      const isUp = await checkBackendHealth();
      setBackendConnected(isUp);
    };
    checkStatus();

    // Subscribe to SSE
    const unsubscribeSSE = subscribeToEvents((event) => {
      console.log('Real-time event:', event);
    });

    // Heartbeat
    const interval = setInterval(async () => {
      const isUp = await checkBackendHealth();
      setBackendConnected(isUp);
    }, 6000);

    return () => {
      clearInterval(interval);
      unsubscribeSSE();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#3d3d3d] flex flex-col font-sans relative selection:bg-[#3a3f5c] selection:text-white">
      {/* Subtle atmospheric halo glow */}
      <div className="halo-glow pointer-events-none" />

      {/* Clean quiet navbar (without any API keys triggers) */}
      <TopNavbar backendConnected={backendConnected} />

      {/* Single focused step-by-step terminal */}
      <main className="flex-1 relative z-10 flex flex-col justify-center py-6 sm:py-10">
        <CheckoutTerminal />
      </main>
    </div>
  );
}
