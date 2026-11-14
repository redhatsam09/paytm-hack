'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Smartphone,
  AlertCircle,
  Lock,
  Radio,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { InvoiceData, WebhookResponse } from '@/types';
import { QRCodeDisplay } from './QRCodeDisplay';

interface CustomerDisplayPanelProps {
  activeInvoice: InvoiceData | null;
  lastWebhook: WebhookResponse | null;
  onSimulatePayment: (amount: number, isSpoof?: boolean) => Promise<void>;
  onResetInvoice: () => void;
  isSimulating: boolean;
  isStandalone?: boolean;
}

export const CustomerDisplayPanel: React.FC<CustomerDisplayPanelProps> = ({
  activeInvoice,
  lastWebhook,
  onSimulatePayment,
  onResetInvoice,
  isSimulating,
  isStandalone = false,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(180);

  // 180s countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Trigger confetti on full payment success
  useEffect(() => {
    if (lastWebhook?.status === 'SUCCESS') {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#533AFD', '#B9B9F9', '#0E9F6E', '#FFFFFF'],
        });
      } catch {
        // Fallback
      }
    }
  }, [lastWebhook]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isSuccess = lastWebhook?.status === 'SUCCESS';
  const isShortfall = lastWebhook?.status === 'SHORTFALL_ALERT';
  const upiDue = activeInvoice?.upi_due || 400;

  return (
    <div className={`flex flex-col gap-6 ${isStandalone ? 'max-w-2xl mx-auto' : ''}`}>
      {/* Panel Top Title */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E6EAF5]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[4px] bg-[#533AFD]/10 text-[#533AFD] flex items-center justify-center">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0A1B3D] tracking-tight">
              Customer Soundbox Display
            </h2>
            <p className="text-xs text-[#6B7A99] font-medium">
              Sunlight-Readable Dynamic QR Screen with Webhook Spoof Guard
            </p>
          </div>
        </div>
        <span className="bg-[#FAFBFD] text-[#0A1B3D] text-xs font-bold px-3 py-1 rounded-[4px] border border-[#E6EAF5]">
          Customer Facing
        </span>
      </div>

      {/* Hardware Kiosk Housing: Minimalist Matte Kiosk */}
      <div className="bg-[#0A1530] p-4 sm:p-6 rounded-[8px] border border-[#0A1B3D] shadow-xl relative overflow-hidden">
        {/* Kiosk Bezel Header */}
        <div className="bg-[#0A1B3D] text-white px-5 py-3 rounded-t-[4px] flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#B9B9F9]" />
            <span className="font-bold text-sm tracking-tight text-white">Vani Soundbox</span>
            <span className="text-[10px] text-[#A8D7FF] font-semibold bg-white/10 px-2 py-0.5 rounded-[2px]">
              UPI Accepted
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#B9B9F9] font-medium">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Any UPI App</span>
          </div>
        </div>

        {/* Dynamic Display Screen Container */}
        <div className="bg-white p-6 sm:p-8 rounded-b-[4px] min-h-[440px] flex flex-col justify-between relative overflow-hidden">
          {/* STATE 1: SHORT PAYMENT / SPOOF RED ALERT SCREEN */}
          {isShortfall ? (
            <div className="absolute inset-0 bg-[#E02424] text-white p-8 flex flex-col items-center justify-center text-center z-20 animate-in fade-in duration-200">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4 animate-bounce">
                <ShieldAlert className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                SHORT PAYMENT DETECTED!
              </h3>
              <p className="text-sm text-white/90 mt-2 max-w-sm leading-relaxed">
                Customer attempted payment on dynamic QR but paid only{' '}
                <span className="font-bold underline text-yellow-300">₹{lastWebhook?.amount_received}</span> instead of{' '}
                <span className="font-bold underline text-yellow-300">₹{lastWebhook?.amount_expected}</span>.
              </p>

              <div className="bg-black/30 w-full max-w-sm rounded-[4px] p-4 my-5 border border-white/20">
                <div className="flex justify-between text-sm py-1.5 border-b border-white/10">
                  <span className="text-white/80">Expected Bill:</span>
                  <span className="font-bold">₹{lastWebhook?.amount_expected}</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-white/10">
                  <span className="text-white/80">Received via UPI:</span>
                  <span className="font-bold text-amber-300">₹{lastWebhook?.amount_received}</span>
                </div>
                <div className="flex justify-between text-base py-2 font-black">
                  <span>Balance Due:</span>
                  <span className="text-yellow-300 text-lg">₹{lastWebhook?.deficit}</span>
                </div>
              </div>

              <span className="text-xs font-bold bg-white text-[#E02424] px-4 py-1.5 rounded-[4px] uppercase tracking-wider shadow-sm">
                Soundbox Siren Alert Triggered
              </span>
            </div>
          ) : null}

          {/* STATE 2: PAYMENT SUCCESS GREEN SCREEN */}
          {isSuccess ? (
            <div className="absolute inset-0 bg-[#0E9F6E] text-white p-8 flex flex-col items-center justify-center text-center z-20 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-4 shadow-lg">
                <CheckCircle2 className="w-12 h-12 text-[#0E9F6E]" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight">
                ₹{lastWebhook?.amount_received} Paid!
              </h3>
              <p className="text-base font-bold text-white/95 mt-1.5">
                Payment Verified by Gateway Webhook
              </p>

              <div className="bg-white/20 rounded-[4px] p-4 my-5 w-full max-w-sm text-sm border border-white/30 text-left">
                <div className="flex justify-between py-1">
                  <span className="text-white/80">UTR Ref:</span>
                  <span className="font-mono font-bold">PAYTM982736154</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-white/80">Merchant:</span>
                  <span className="font-semibold">Sri Lakshmi Stores</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-white/80">Status:</span>
                  <span className="font-black text-emerald-100">SETTLED ✓</span>
                </div>
              </div>

              <p className="text-xs text-white/90">
                Voice announcement broadcasted on Soundbox. Please collect receipt.
              </p>
            </div>
          ) : null}

          {/* STATE 3: DEFAULT AMOUNT-LOCKED QR SCREEN */}
          <div className="flex flex-col items-center text-center">
            {/* Amount Header with huge readable numbers */}
            <div className="mb-4">
              <span className="text-xs font-bold text-[#6B7A99] uppercase tracking-wider block">
                Total Payment Due
              </span>
              <div className="text-4xl sm:text-5xl font-light text-[#0A1B3D] tracking-tight my-1">
                ₹ {upiDue.toFixed(2)}
              </div>
              <span className="inline-flex items-center gap-1.5 bg-[#533AFD]/10 text-[#533AFD] text-xs font-bold px-3 py-1 rounded-[4px] mt-1">
                <Lock className="w-3.5 h-3.5 text-[#533AFD]" />
                <span>Amount-Locked • Buyer cannot edit</span>
              </span>
            </div>

            {/* Dynamic Crisp QR Code */}
            <div className="my-2 p-2 bg-[#FAFBFD] rounded-[4px] border border-[#E6EAF5]">
              <QRCodeDisplay
                value={
                  activeInvoice?.qr_data ||
                  `upi://pay?pa=srilakshmi@paytm&pn=SriLakshmiStores&am=${upiDue.toFixed(2)}&cu=INR&tr=${activeInvoice?.invoice_id || 'INV-2026-001'}`
                }
                size={isStandalone ? 240 : 190}
              />
            </div>

            {/* Countdown Timer with clean pill */}
            <div className="flex items-center gap-2 bg-[#FAFBFD] px-4 py-1.5 rounded-[4px] border border-[#E6EAF5] mt-3">
              <Clock className="w-4 h-4 text-[#533AFD]" />
              <span className="text-xs font-semibold text-[#0A1B3D]">
                Expires in: <span className="font-mono font-bold text-[#533AFD] text-sm">{formatTimer(timeLeft)}</span>
              </span>
            </div>

            <p className="text-xs text-[#6B7A99] font-medium mt-3">
              Scan with Paytm, Google Pay, PhonePe, Cred or any UPI app.
            </p>
          </div>

          {/* Kiosk Footer: Invoice ID & Security tag */}
          <div className="pt-4 border-t border-[#E6EAF5] flex items-center justify-between text-xs text-[#6B7A99] font-semibold">
            <span>Invoice: {activeInvoice?.invoice_id || 'INV-2026-001'}</span>
            <span className="flex items-center gap-1.5 text-[#0E9F6E] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#0E9F6E]" />
              Anti-Spoof Guard Active
            </span>
          </div>
        </div>
      </div>

      {/* Customer Action Simulator Drawer */}
      <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#533AFD]" />
            <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
              Customer Payment Simulator
            </h3>
          </div>
          <span className="text-xs text-[#6B7A99] font-medium">
            Test Gateway Webhooks
          </span>
        </div>

        <p className="text-xs text-[#6B7A99] leading-relaxed">
          Click any button below to trigger live UPI webhook payloads and observe real-time dual-screen sync:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Button 1: Pay Full Amount */}
          <button
            onClick={() => onSimulatePayment(upiDue)}
            disabled={isSimulating}
            className="h-[46px] px-4 bg-[#0E9F6E] hover:bg-emerald-700 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Pay Exact ₹{upiDue} (Full Success)</span>
          </button>

          {/* Button 2: Pay Shortfall / Deficit */}
          <button
            onClick={() => onSimulatePayment(40)}
            disabled={isSimulating}
            className="h-[46px] px-4 bg-[#E02424] hover:bg-red-700 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Pay Only ₹40 (Shortfall Alert)</span>
          </button>

          {/* Button 3: Spoof / Fake UTR */}
          <button
            onClick={() => onSimulatePayment(upiDue, true)}
            disabled={isSimulating}
            className="h-[46px] px-4 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Fake Spoof UTR</span>
          </button>

          {/* Button 4: Reset / Next Transaction */}
          <button
            onClick={onResetInvoice}
            disabled={isSimulating}
            className="h-[46px] px-4 bg-white hover:bg-gray-50 border border-[#E6EAF5] disabled:opacity-50 text-[#0A1B3D] rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#6B7A99]" />
            <span>Reset / Next Bill</span>
          </button>
        </div>
      </div>
    </div>
  );
};
