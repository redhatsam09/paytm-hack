'use client';

import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { InvoiceData, WebhookResponse } from '@/types';
import { CustomerDisplayPanel } from './CustomerDisplayPanel';

interface SpoofGuardPlaygroundProps {
  activeInvoice: InvoiceData | null;
  lastWebhook: WebhookResponse | null;
  onSimulatePayment: (amount: number, isSpoof?: boolean) => Promise<void>;
  onResetInvoice: () => void;
  isSimulating: boolean;
}

export const SpoofGuardPlayground: React.FC<SpoofGuardPlaygroundProps> = ({
  activeInvoice,
  lastWebhook,
  onSimulatePayment,
  onResetInvoice,
  isSimulating,
}) => {
  const upiDue = activeInvoice?.upi_due || 400;
  const isShortfall = lastWebhook?.status === 'SHORTFALL_ALERT';

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto py-4">
      {/* Overview Card */}
      <div className="bg-[#FAFBFD] p-6 rounded-[6px] border border-[#E6EAF5]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-[4px] bg-[#E02424]/10 text-[#E02424] flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0A1B3D] tracking-tight">
              Real-Time Mismatch & Spoof Defense Guard
            </h2>
            <p className="text-xs text-[#6B7A99]">
              Live demonstration of how Vani traps short-payments before the customer walks away
            </p>
          </div>
        </div>

        <p className="text-sm text-[#0A1B3D] leading-relaxed mt-3">
          In typical Kirana rush hours, fraudsters show fake payment screenshots or edit the amount from ₹400 to ₹40 on static QR codes. The passive soundbox announces ₹40 after they leave. <span className="font-bold text-[#533AFD]">Vani locks the amount in dynamic QR</span> and triggers an immediate regional siren alarm if a deficit is detected.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Test Controls & Attack Scenarios (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Active Bill Expectation Card */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs">
            <span className="text-xs font-bold text-[#6B7A99] uppercase tracking-wider block mb-1">
              Active Counter Invoice Expected
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-light text-[#0A1B3D] tracking-tight">
                ₹ {upiDue.toFixed(2)}
              </span>
              <span className="text-xs text-[#0E9F6E] font-bold bg-emerald-50 px-2.5 py-1 rounded-[4px] border border-emerald-200">
                Amount-Locked by Merchant
              </span>
            </div>
            <p className="text-xs text-[#6B7A99] mt-2">
              Invoice ID: <span className="font-mono text-[#0A1B3D] font-bold">{activeInvoice?.invoice_id || 'INV-2026-001'}</span> • Customer: <span className="font-bold text-[#0A1B3D]">{activeInvoice?.customer_name || 'Ramesh'}</span>
            </p>
          </div>

          {/* Test Attack Simulations */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-4">
            <h3 className="text-sm font-bold text-[#0A1B3D] uppercase tracking-wider">
              Trigger Webhook Attack Payloads:
            </h3>

            {/* Attack 1: Short Payment */}
            <div className="p-4 rounded-[4px] border border-[#E02424]/30 bg-red-50/40 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#E02424]">
                    Attack 1: Underpayment Shortfall (₹40 Paid vs ₹400 Due)
                  </h4>
                  <p className="text-xs text-[#6B7A99] mt-1">
                    Buyer modifies payload or pays ₹40 on static QR code hoping shopkeeper doesn&apos;t check.
                  </p>
                </div>
                <span className="bg-[#E02424] text-white text-[10px] font-bold px-2 py-0.5 rounded-[2px]">
                  Common Fraud
                </span>
              </div>

              <button
                onClick={() => onSimulatePayment(40)}
                disabled={isSimulating}
                className="h-[44px] w-full bg-[#E02424] hover:bg-red-700 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Simulate Underpayment Attack (Trigger Deficit Siren)</span>
              </button>
            </div>

            {/* Attack 2: Fake Spoof UTR */}
            <div className="p-4 rounded-[4px] border border-amber-300 bg-amber-50/40 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Attack 2: Fake Spoofed UTR / Tampered Notification
                  </h4>
                  <p className="text-xs text-[#6B7A99] mt-1">
                    Buyer presents fake UPI app screenshot with generated fake UTR.
                  </p>
                </div>
                <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-[2px]">
                  Screenshot Spoof
                </span>
              </div>

              <button
                onClick={() => onSimulatePayment(upiDue, true)}
                disabled={isSimulating}
                className="h-[44px] w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Simulate Spoofed Webhook Payload</span>
              </button>
            </div>

            {/* Valid Match: Full Payment */}
            <div className="p-4 rounded-[4px] border border-emerald-300 bg-emerald-50/40 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    Legitimate: Exact Full Amount (₹{upiDue} Paid)
                  </h4>
                  <p className="text-xs text-[#6B7A99] mt-1">
                    Customer scans dynamic QR and pays exact locked amount.
                  </p>
                </div>
                <span className="bg-[#0E9F6E] text-white text-[10px] font-bold px-2 py-0.5 rounded-[2px]">
                  Verified Match
                </span>
              </div>

              <button
                onClick={() => onSimulatePayment(upiDue)}
                disabled={isSimulating}
                className="h-[44px] w-full bg-[#0E9F6E] hover:bg-emerald-700 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulate Valid Full Payment (₹{upiDue})</span>
              </button>
            </div>
          </div>

          {/* Incident Log */}
          {lastWebhook && (
            <div className="bg-white p-5 rounded-[6px] border border-[#E6EAF5] shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
                  Real-Time Gateway Verdict
                </span>
                <span className="text-[10px] font-mono text-[#6B7A99]">
                  Processed in 4ms
                </span>
              </div>

              <div className="font-mono text-xs bg-[#FAFBFD] p-3 rounded-[4px] border border-[#E6EAF5]">
                <div>Status: <span className={isShortfall ? 'text-[#E02424] font-bold' : 'text-[#0E9F6E] font-bold'}>{lastWebhook.status}</span></div>
                <div>Amount Received: <span className="font-bold">₹{lastWebhook.amount_received}</span></div>
                <div>Amount Expected: <span className="font-bold">₹{lastWebhook.amount_expected}</span></div>
                <div>Calculated Deficit: <span className={lastWebhook.deficit > 0 ? 'text-[#E02424] font-bold' : 'text-[#0E9F6E]'}>₹{lastWebhook.deficit}</span></div>
                <div className="mt-1 text-gray-700 italic">&quot;{lastWebhook.voice_alert}&quot;</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Soundbox Kiosk Display (5 cols) */}
        <div className="lg:col-span-5">
          <CustomerDisplayPanel
            activeInvoice={activeInvoice}
            lastWebhook={lastWebhook}
            onSimulatePayment={onSimulatePayment}
            onResetInvoice={onResetInvoice}
            isSimulating={isSimulating}
            isStandalone={false}
          />
        </div>
      </div>
    </div>
  );
};
