'use client';

import React, { useState, useEffect } from 'react';
import { TopNavbar } from '@/components/TopNavbar';
import { UnifiedWorkflow } from '@/components/UnifiedWorkflow';
import { ApiSettingsModal } from '@/components/ApiSettingsModal';
import { checkBackendHealth, subscribeToEvents } from '@/lib/api';

export default function Home() {
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Check initial backend health
    const checkStatus = async () => {
      const isUp = await checkBackendHealth();
      setBackendConnected(isUp);
    };
    checkStatus();

    // Subscribe to SSE real-time notifications
    const unsubscribeSSE = subscribeToEvents((event) => {
      console.log('Real-time event from backend:', event);
    });

    // Periodic health heartbeat
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
    <div className="min-h-screen bg-[#fcfcfc] text-[#3d3d3d] flex flex-col font-sans relative">
      {/* Soft atmospheric halo glow */}
      <div className="halo-glow" />

      {/* Top Navigation Bar */}
      <TopNavbar
        backendConnected={backendConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Single Unified Natural Workflow */}
      <main className="flex-1 relative z-10">
        <UnifiedWorkflow />
      </main>

      {/* Pluggable API Keys Drawer / Modal */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
