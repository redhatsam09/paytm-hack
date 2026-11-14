'use client';

import React, { useState, useEffect } from 'react';
import { TopNavbar, ActiveTab } from '@/components/TopNavbar';
import { CheckoutWorkflow } from '@/components/CheckoutWorkflow';
import { RestockWorkflow } from '@/components/RestockWorkflow';
import { UdhariLedgerView } from '@/components/UdhariLedgerView';
import { ApiSettingsModal } from '@/components/ApiSettingsModal';
import { checkBackendHealth, subscribeToEvents } from '@/lib/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('checkout');
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Initial backend check
    const checkStatus = async () => {
      const isUp = await checkBackendHealth();
      setBackendConnected(isUp);
    };
    checkStatus();

    // Subscribe to backend SSE events
    const unsubscribeSSE = subscribeToEvents((event) => {
      console.log('Real-time event from backend:', event);
    });

    // Poll health periodically
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
    <div className="min-h-screen bg-white text-[#0A1B3D] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <TopNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        backendConnected={backendConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Product Application Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'checkout' && <CheckoutWorkflow />}
        {activeTab === 'restock' && <RestockWorkflow />}
        {activeTab === 'ledger' && <UdhariLedgerView />}
      </main>

      {/* API Key Configuration Modal / Drawer */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
