'use client';

import React from 'react';
import { Radio, Volume2, Settings } from 'lucide-react';
import { playPaytmChime } from '@/lib/audio';

export type ActiveTab = 'checkout' | 'restock' | 'ledger';

interface TopNavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  backendConnected: boolean;
  onOpenSettings: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  onTabChange,
  backendConnected,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E6EAF5]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[4px] bg-[#533AFD] flex items-center justify-center text-white shadow-xs">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-[#0A1B3D] tracking-tight">Vani</span>
              <span className="text-[11px] font-medium text-[#6B7A99] hidden sm:inline">
                Autonomous Counter & Credit Agent
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-[#F8FAFC] p-1 rounded-[6px] border border-[#E6EAF5]">
          <button
            onClick={() => onTabChange('checkout')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
              activeTab === 'checkout'
                ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
                : 'text-[#6B7A99] hover:text-[#0A1B3D]'
            }`}
          >
            Checkout Flow
          </button>
          <button
            onClick={() => onTabChange('restock')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
              activeTab === 'restock'
                ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
                : 'text-[#6B7A99] hover:text-[#0A1B3D]'
            }`}
          >
            Restock & Invoice Audit
          </button>
          <button
            onClick={() => onTabChange('ledger')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
                : 'text-[#6B7A99] hover:text-[#0A1B3D]'
            }`}
          >
            Udhari Ledger
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Status Badge */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-medium border ${
              backendConnected
                ? 'bg-[#0E9F6E]/5 text-[#0E9F6E] border-[#0E9F6E]/20'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected ? 'bg-[#0E9F6E] animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{backendConnected ? 'Mock Engine (Zero Setup)' : 'Offline'}</span>
          </div>

          {/* Soundbox Chime Test */}
          <button
            onClick={() => playPaytmChime()}
            title="Test Soundbox Chime"
            className="h-8 px-2.5 rounded-[4px] border border-[#E6EAF5] hover:bg-gray-50 text-[#0A1B3D] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#533AFD]" />
            <span className="hidden sm:inline">Chime</span>
          </button>

          {/* API Settings Gear */}
          <button
            onClick={onOpenSettings}
            title="Configure API Keys"
            className="h-8 px-2.5 rounded-[4px] border border-[#E6EAF5] hover:bg-gray-50 text-[#0A1B3D] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-[#6B7A99]" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
