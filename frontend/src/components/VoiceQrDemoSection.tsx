'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  User,
  Calendar,
  Layers,
  Lock,
  MessageSquare,
  Radio,
  CheckCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { VoiceParseData, InvoiceData, WebhookResponse } from '@/types';
import { QRCodeDisplay } from './QRCodeDisplay';
import { playPaytmChime } from '@/lib/audio';

const WAVE_BARS = [14, 28, 36, 18, 32, 16, 38, 24, 42, 20, 28, 12, 34, 22, 30, 16];

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface VoiceQrDemoSectionProps {
  onParseVoice: (transcript: string) => Promise<void>;
  onSimulatePayment: (amount: number) => Promise<void>;
  onReconcileUdhari: (id: string, amount: number) => Promise<void>;
  parsedData: VoiceParseData | null;
  activeInvoice: InvoiceData | null;
  lastWebhook: WebhookResponse | null;
  audioLanguage: 'hi' | 'en';
  isParsing: boolean;
  isSimulating: boolean;
}

export const VoiceQrDemoSection: React.FC<VoiceQrDemoSectionProps> = ({
  onParseVoice,
  onSimulatePayment,
  onReconcileUdhari,
  parsedData,
  activeInvoice,
  lastWebhook,
  audioLanguage,
  isParsing,
  isSimulating,
}) => {
  const [transcript, setTranscript] = useState(
    'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210'
  );
  const [isListening, setIsListening] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180);
  const [udhSettled, setUdhSettled] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // 180s countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = audioLanguage === 'hi' ? 'hi-IN' : 'en-IN';

        recognition.onresult = (event) => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          if (text) setTranscript(text);
        };
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, [audioLanguage]);

  // Confetti on success
  useEffect(() => {
    if (lastWebhook?.status === 'SUCCESS') {
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#533AFD', '#B9B9F9', '#0E9F6E'],
        });
      } catch {
        // Fallback
      }
    }
  }, [lastWebhook]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        onParseVoice(transcript);
      }, 1400);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current.lang = audioLanguage === 'hi' ? 'hi-IN' : 'en-IN';
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const handlePreset = (presetText: string) => {
    setTranscript(presetText);
    onParseVoice(presetText);
  };

  const handleSettleUdhari = async () => {
    setUdhSettled(true);
    playPaytmChime();
    await onReconcileUdhari('udh-001', 250);
  };

  const upiDue = activeInvoice?.upi_due || 400;
  const isPaid = lastWebhook?.status === 'SUCCESS';

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <section id="flow-voice-qr" className="py-24 border-b border-[#E6EAF5] bg-white">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#533AFD] mb-2 block">
            Flow 1 Interactive Experience
          </span>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-[#0A1B3D] leading-tight">
            Voice-to-Dynamic-QR & Automated WhatsApp Udhari.
          </h2>
          <p className="text-base text-[#6B7A99] mt-3">
            Speak once to decompose the split bill, lock the dynamic QR on the customer display, and automatically schedule the credit link to the customer’s phone.
          </p>
        </div>

        {/* Embedded Interactive Product Demo Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Merchant Speech & Entity Decomposition (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {/* 1. Speech Input Card */}
            <div className="bg-[#FAFBFD] p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
                    Step 1: Push-to-Talk Speech Engine
                  </h3>
                  <p className="text-xs text-[#6B7A99] mt-0.5">
                    Speak split details in Hindi, English or Hinglish
                  </p>
                </div>
                {isListening && (
                  <span className="text-xs font-bold text-[#E02424] animate-pulse flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-[4px] border border-red-200">
                    <span className="w-2 h-2 rounded-full bg-[#E02424]" />
                    Listening...
                  </span>
                )}
              </div>

              {/* Big Mic Button & Audio Waveform */}
              <div className="flex items-center gap-5 bg-white p-5 rounded-[4px] border border-[#E6EAF5]">
                <button
                  onClick={toggleListening}
                  className={`w-14 h-14 rounded-[4px] flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    isListening
                      ? 'bg-[#E02424] text-white ring-4 ring-red-100 scale-105 shadow-md'
                      : 'bg-[#533AFD] hover:bg-[#4329E0] text-white shadow-xs'
                  }`}
                  title={isListening ? 'Stop listening' : 'Click to speak checkout command'}
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6 animate-pulse" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>

                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 h-10">
                    {WAVE_BARS.map((h, i) => (
                      <div
                        key={i}
                        style={{
                          height: isListening ? `${h}px` : '5px',
                          backgroundColor: isListening ? '#533AFD' : '#E6EAF5',
                        }}
                        className={`w-1.5 rounded-[1px] transition-all duration-150 ${
                          isListening ? 'wave-bar' : ''
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-[#6B7A99] font-medium mt-1">
                    {isListening
                      ? 'Listening to storekeeper speech in real-time...'
                      : 'Tap mic or pick a preset voice command below'}
                  </p>
                </div>
              </div>

              {/* Editable Command Input */}
              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="e.g. ₹650 bill — ₹400 UPI now, ₹250 udhari for Monday..."
                  className="flex-1 text-xs sm:text-sm bg-white border border-[#E6EAF5] rounded-[4px] px-3.5 py-2.5 text-[#0A1B3D] font-medium focus:outline-none focus:border-[#533AFD]"
                />
                <button
                  onClick={() => onParseVoice(transcript)}
                  disabled={isParsing || !transcript.trim()}
                  className="h-[42px] px-5 bg-[#533AFD] hover:bg-[#4329E0] disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-xs cursor-pointer"
                >
                  {isParsing ? (
                    <Sparkles className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Parse</span>
                </button>
              </div>

              {/* Preset Voice Chips */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-[11px] font-bold text-[#6B7A99] uppercase tracking-wide">
                  Try Sample Kirana Voice Prompts:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      handlePreset(
                        'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210'
                      )
                    }
                    className="text-left text-xs bg-white hover:border-[#533AFD] text-[#0A1B3D] p-3 rounded-[4px] border border-[#E6EAF5] transition-all flex flex-col gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <span className="font-bold text-[#0A1B3D]">₹650 Split Bill</span>
                    <span className="text-[11px] text-[#6B7A99]">₹400 UPI + ₹250 Udhari (Ramesh)</span>
                  </button>

                  <button
                    onClick={() =>
                      handlePreset('Customer bill ₹200 full UPI payment')
                    }
                    className="text-left text-xs bg-white hover:border-[#533AFD] text-[#0A1B3D] p-3 rounded-[4px] border border-[#E6EAF5] transition-all flex flex-col gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <span className="font-bold text-[#0A1B3D]">₹200 Full UPI</span>
                    <span className="text-[11px] text-[#6B7A99]">100% Instant Digital Checkout</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Decomposed Intent Breakdown */}
            {parsedData && (
              <div className="bg-[#FAFBFD] p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#533AFD]" />
                    <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
                      Step 2: Instant Intent Breakdown (&lt;350ms)
                    </h3>
                  </div>
                  <span className="text-xs text-[#0E9F6E] font-bold bg-emerald-50 px-2 py-0.5 rounded-[2px] border border-emerald-200">
                    Groq Llama-3.3 Verified
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-[4px] border border-[#E6EAF5]">
                    <span className="text-[10px] text-[#6B7A99] font-bold block uppercase">Total Bill</span>
                    <span className="text-2xl font-light text-[#0A1B3D]">₹{parsedData.total_bill}</span>
                  </div>

                  <div className="bg-white p-3 rounded-[4px] border-2 border-[#533AFD]">
                    <span className="text-[10px] text-[#533AFD] font-bold block uppercase">UPI Locked</span>
                    <span className="text-2xl font-light text-[#533AFD]">₹{parsedData.upi_amount}</span>
                  </div>

                  <div className="bg-white p-3 rounded-[4px] border border-amber-300">
                    <span className="text-[10px] text-amber-800 font-bold block uppercase">Credit (Udhari)</span>
                    <span className="text-2xl font-light text-amber-800">₹{parsedData.udhari_amount}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#6B7A99] bg-white p-3 rounded-[4px] border border-[#E6EAF5]">
                  <span className="flex items-center gap-1.5 font-bold text-[#0A1B3D]">
                    <User className="w-3.5 h-3.5 text-[#533AFD]" />
                    {parsedData.customer_name} ({parsedData.customer_phone})
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-800 font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    Due: {parsedData.due_date}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Soundbox Kiosk Screen + WhatsApp Link Preview (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {/* Realistic Soundbox Device Mockup */}
            <div className="bg-[#0A1530] p-6 rounded-[8px] border border-[#0A1B3D] shadow-xl relative overflow-hidden">
              {/* Kiosk Bezel Bar */}
              <div className="bg-[#0A1B3D] text-white px-5 py-2.5 rounded-t-[4px] flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#B9B9F9]" />
                  <span className="font-bold text-xs text-white">Vani Soundbox Pro</span>
                  <span className="text-[10px] bg-white/10 text-[#A8D7FF] px-2 py-0.5 rounded-[2px]">
                    Customer Screen
                  </span>
                </div>
                <div className="text-[11px] text-[#B9B9F9] font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#B9B9F9]" />
                  <span>{formatTimer(timeLeft)}</span>
                </div>
              </div>

              {/* Sunlight Readable Canvas */}
              <div className="bg-white p-7 rounded-b-[4px] flex flex-col items-center text-center relative overflow-hidden min-h-[360px] justify-between">
                {/* Instant Success Overlay */}
                {isPaid && (
                  <div className="absolute inset-0 bg-[#0E9F6E] text-white p-6 flex flex-col items-center justify-center text-center z-20 animate-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-3 shadow-md">
                      <CheckCircle2 className="w-10 h-10 text-[#0E9F6E]" />
                    </div>
                    <h4 className="text-3xl font-black tracking-tight">₹{upiDue} Paid!</h4>
                    <p className="text-sm font-bold text-white/95 mt-1">Payment Verified via Gateway</p>
                    <span className="text-[11px] font-mono text-emerald-100 bg-black/20 px-3 py-1 rounded-[3px] mt-3">
                      UTR: PAYTM982736154 • Status: SETTLED
                    </span>
                  </div>
                )}

                {/* Amount Header */}
                <div>
                  <span className="text-[11px] font-bold text-[#6B7A99] uppercase tracking-wider block">
                    Customer Due Amount
                  </span>
                  <div className="text-4xl font-light text-[#0A1B3D] tracking-tight my-1">
                    ₹ {upiDue.toFixed(2)}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#533AFD] bg-[#533AFD]/10 px-2.5 py-0.5 rounded-[3px]">
                    <Lock className="w-3 h-3" />
                    Locked Amount • Scan Any UPI App
                  </span>
                </div>

                {/* Crisp Dynamic QR */}
                <div className="my-2 p-2 bg-[#FAFBFD] rounded-[4px] border border-[#E6EAF5]">
                  <QRCodeDisplay
                    value={
                      activeInvoice?.qr_data ||
                      `upi://pay?pa=srilakshmi@paytm&pn=SriLakshmiStores&am=${upiDue.toFixed(2)}&cu=INR&tr=${activeInvoice?.invoice_id || 'INV-2026-001'}`
                    }
                    size={170}
                  />
                </div>

                <p className="text-[11px] text-[#6B7A99]">
                  Invoice: {activeInvoice?.invoice_id || 'INV-2026-001'} • 4G VoLTE Connected
                </p>
              </div>

              {/* Kiosk Action Trigger */}
              <div className="p-3 bg-[#0A1B3D] border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/70">Test Customer Action:</span>
                <button
                  onClick={() => onSimulatePayment(upiDue)}
                  disabled={isSimulating}
                  className="h-[38px] px-5 bg-[#0E9F6E] hover:bg-emerald-700 disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simulate Buyer Paying ₹{upiDue}</span>
                </button>
              </div>
            </div>

            {/* WhatsApp Automated Payment Link Preview */}
            <div className="bg-[#FAFBFD] p-5 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#075E54]" />
                  <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
                    Auto-Dispatched WhatsApp Credit Link
                  </h3>
                </div>
                <span className="text-[10px] font-bold bg-[#075E54]/10 text-[#075E54] px-2 py-0.5 rounded-[2px]">
                  Ramesh Kumar (+91 98765 43210)
                </span>
              </div>

              {/* Chat Bubble */}
              <div className="bg-[#DCF8C6] p-4 rounded-[6px] border border-emerald-100 text-xs text-[#0A1B3D] shadow-2xs">
                <p className="font-bold text-[#075E54]">Namaste Ramesh ji 🙏</p>
                <p className="mt-1">
                  Thank you for shopping at <span className="font-bold">Sri Lakshmi Stores</span>. Your bill of ₹650 had ₹400 paid via UPI and{' '}
                  <span className="font-bold text-[#0A1B3D]">₹250 udhari balance</span> due on Mon, 17 Nov.
                </p>

                <div className="bg-white/80 p-2.5 rounded-[4px] my-2.5 border border-emerald-200">
                  <div className="flex justify-between font-bold text-xs mb-1">
                    <span>Paytm Payment Link:</span>
                    <span className="text-[#533AFD]">https://p.paytm.me/pay?id=udh-001</span>
                  </div>

                  {udhSettled ? (
                    <div className="text-emerald-800 font-bold flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0E9F6E]" />
                      <span>✓ Settled: Ramesh paid ₹250 via Paytm Link!</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleSettleUdhari}
                      className="w-full mt-1.5 py-2 px-3 bg-[#533AFD] hover:bg-[#4329E0] text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>⚡ 1-Click Customer Payment Simulator (Pay ₹250)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500">
                  <span>11:27 AM</span>
                  <CheckCheck className="w-3 h-3 text-[#533AFD]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
