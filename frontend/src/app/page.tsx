'use client';

import React, { useState, useEffect } from 'react';
import { TopNavbar } from '@/components/TopNavbar';
import { DualDeviceSimulator } from '@/components/DualDeviceSimulator';
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
    <div className="min-h-screen bg-[#fcfcfc] text-[#3d3d3d] flex flex-col font-sans relative selection:bg-[#3a3f5c] selection:text-white">
      {/* Subtle atmospheric halo glow */}
      <div className="halo-glow pointer-events-none" />

      {/* Clean quiet navbar */}
      <TopNavbar backendConnected={backendConnected} />

      {/* Dual-Device Stage Simulator */}
      <main className="flex-1 relative z-10 flex flex-col justify-center py-4 sm:py-6">
        <DualDeviceSimulator />
      </main>
    </div>
  );
}
