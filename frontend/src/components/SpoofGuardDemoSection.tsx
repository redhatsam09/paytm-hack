'use client';

import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { InvoiceData, WebhookResponse } from '@/types';

interface SpoofGuardDemoSectionProps {
  activeInvoice: InvoiceData | null;
  lastWebhook: WebhookResponse | null;
  onSimulatePayment: (amount: number, isSpoof?: boolean) => Promise<void>;
  isSimulating: boolean;
}

export const SpoofGuardDemoSection: React.FC<SpoofGuardDemoSectionProps> = ({
  activeInvoice,
  lastWebhook,
  onSimulatePayment,
  isSimulating,
}) => {
  const handleTestAttack = async (type: 'shortfall' | 'spoof' | 'full') => {
    if (type === 'shortfall') {
      await onSimulatePayment(40);
    } else if (type === 'spoof') {
      await onSimulatePayment(activeInvoice?.upi_due || 400, true);
    } else {
      await onSimulatePayment(activeInvoice?.upi_due || 400);
    }
  };

  const isShortfallActive = lastWebhook?.status === 'SHORTFALL_ALERT';

  return (
    <section id="flow-spoof-guard" className="py-24 border-b border-[#E6EAF5] bg-white">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E02424] mb-2 block">
            Flow 2 Interactive Experience
          </span>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-[#0A1B3D] leading-tight">
            Real-Time Spoof Guard & Shortfall Defense.
          </h2>
          <p className="text-base text-[#6B7A99] mt-3">
            Never lose money when a buyer edits payment amounts or shows a fake screenshot. Compare standard passive soundboxes with our active gateway trap.
          </p>
        </div>

        {/* Before / After Split Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mb-10">
          {/* Left: What happens today */}
          <div className="bg-[#FAFBFD] p-8 rounded-[6px] border border-[#E6EAF5] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-[#6B7A99] uppercase tracking-wider">
                  Existing Store Reality
                </span>
                <span className="text-xs font-bold text-[#E02424] bg-red-50 px-2.5 py-0.5 rounded-[2px] border border-red-200">
                  Passive Soundbox
                </span>
              </div>

              <h3 className="text-lg font-bold text-[#0A1B3D] tracking-tight mb-2">
                Static QR Sticker & Lagging Audio
              </h3>
              <p className="text-sm text-[#6B7A99] leading-relaxed mb-6">
                Customer scans the printed static sticker, manually changes amount from ₹400 to ₹40 on their phone, shows a blurred screen, and leaves.
              </p>

              <div className="space-y-3 text-xs bg-white p-4 rounded-[4px] border border-[#E6EAF5]">
                <div className="flex items-start gap-2.5 text-gray-700">
                  <XCircle className="w-4 h-4 text-[#E02424] shrink-0 mt-0.5" />
                  <span>Sticker has no awareness of bill amount (₹400 expected).</span>
                </div>
                <div className="flex items-start gap-2.5 text-gray-700">
                  <XCircle className="w-4 h-4 text-[#E02424] shrink-0 mt-0.5" />
                  <span>Passive soundbox announces &quot;₹40 prapt hue&quot; 45 seconds later.</span>
                </div>
                <div className="flex items-start gap-2.5 text-gray-700">
                  <XCircle className="w-4 h-4 text-[#E02424] shrink-0 mt-0.5" />
                  <span>Shopkeeper loses ₹360 on a ₹400 purchase.</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#E6EAF5] text-xs font-bold text-[#E02424]">
              Result: Undetected revenue leak of ₹180-₹400 per incident
            </div>
          </div>

          {/* Right: With Vani Autonomous Agent */}
          <div className="bg-white p-8 rounded-[6px] border-2 border-[#533AFD] flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-[#533AFD] uppercase tracking-wider">
                  With Vani Agent
                </span>
                <span className="text-xs font-bold text-[#0E9F6E] bg-emerald-50 px-2.5 py-0.5 rounded-[2px] border border-emerald-200">
                  Active Webhook Guard
                </span>
              </div>

              <h3 className="text-lg font-bold text-[#0A1B3D] tracking-tight mb-2">
                Amount-Locked QR & Immediate Deficit Siren
              </h3>
              <p className="text-sm text-[#6B7A99] leading-relaxed mb-6">
                Dynamic QR is locked to ₹400. If an underpayment webhook of ₹40 arrives, Vani calculates the deficit and triggers an urgent regional voice warning.
              </p>

              <div className="space-y-3 text-xs bg-[#FAFBFD] p-4 rounded-[4px] border border-[#E6EAF5]">
                <div className="flex items-start gap-2.5 text-[#0A1B3D]">
                  <CheckCircle2 className="w-4 h-4 text-[#0E9F6E] shrink-0 mt-0.5" />
                  <span>Dynamic QR payload locks ₹400 in UPI intent URL.</span>
                </div>
                <div className="flex items-start gap-2.5 text-[#0A1B3D]">
                  <CheckCircle2 className="w-4 h-4 text-[#0E9F6E] shrink-0 mt-0.5" />
                  <span>Webhook listener flags ₹360 deficit in &lt;5 milliseconds.</span>
                </div>
                <div className="flex items-start gap-2.5 text-[#0A1B3D]">
                  <CheckCircle2 className="w-4 h-4 text-[#0E9F6E] shrink-0 mt-0.5" />
                  <span className="font-bold text-[#E02424]">
                    Instant Voice Siren: &quot;Savdhaan! Keval ₹40 prapt hue hain! ₹360 baaki hai!&quot;
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#E6EAF5] text-xs font-bold text-[#0E9F6E]">
              Result: Zero counter shortfalls; fraud stopped before customer walks away
            </div>
          </div>
        </div>

        {/* Live Attack Simulator Box */}
        <div className="bg-[#FAFBFD] p-8 rounded-[6px] border border-[#E6EAF5] flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#0A1B3D] tracking-tight">
                Try It Live: Simulate Attack on Active Invoice (Expected: ₹{activeInvoice?.upi_due || 400}.00)
              </h3>
              <p className="text-xs text-[#6B7A99] mt-0.5">
                Trigger real webhook payloads to observe the instant audio siren and deficit calculation:
              </p>
            </div>

            {/* Test Trigger Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleTestAttack('shortfall')}
                disabled={isSimulating}
                className="h-[46px] px-6 bg-[#E02424] hover:bg-red-700 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Simulate ₹40 Short Payment Attack</span>
              </button>

              <button
                onClick={() => handleTestAttack('spoof')}
                disabled={isSimulating}
                className="h-[46px] px-5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Simulate Tampered UTR</span>
              </button>

              <button
                onClick={() => handleTestAttack('full')}
                disabled={isSimulating}
                className="h-[46px] px-5 bg-white text-[#0A1B3D] border border-[#E6EAF5] hover:border-[#0E9F6E] disabled:opacity-50 rounded-[4px] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#0E9F6E]" />
                <span>Simulate Valid ₹{activeInvoice?.upi_due || 400} Match</span>
              </button>
            </div>
          </div>

          {/* Alert Display when triggered */}
          {isShortfallActive && (
            <div className="bg-[#E02424] text-white p-6 rounded-[6px] border border-red-600 shadow-md animate-in fade-in flex items-start gap-4">
              <ShieldAlert className="w-8 h-8 shrink-0 text-white mt-1 animate-bounce" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-lg font-black uppercase tracking-wide">
                    🚨 MISMATCH DETECTED: SHORT PAYMENT SHORTFALL!
                  </h4>
                  <span className="bg-white text-[#E02424] font-black text-xs px-3 py-1 rounded-[3px]">
                    Deficit: ₹{lastWebhook?.deficit} Due
                  </span>
                </div>
                <p className="text-sm mt-1.5 text-white/95 leading-relaxed">
                  Received webhook: <span className="font-mono font-bold">Amount ₹{lastWebhook?.amount_received}</span> vs Expected <span className="font-mono font-bold">₹{lastWebhook?.amount_expected}</span>. Soundbox regional voice siren fired:
                </p>
                <div className="mt-3 bg-black/25 p-3 rounded-[4px] text-xs font-mono">
                  🔊 Broadcast Voice: &quot;{lastWebhook?.voice_alert}&quot;
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
