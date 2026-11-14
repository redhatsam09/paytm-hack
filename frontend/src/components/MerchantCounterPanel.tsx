'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  CheckCircle2,
  Volume2,
  User,
  Phone,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  Banknote,
  Receipt,
  Radio,
} from 'lucide-react';
import { VoiceParseData, InvoiceData, WebhookResponse } from '@/types';
import { playPaytmChime, playAlertSiren, speakAnnouncement } from '@/lib/audio';

const WAVE_BARS = [12, 28, 38, 20, 32, 16, 36, 24, 42, 18, 28, 12, 34, 22, 30, 16, 26, 38, 18, 28];

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

interface MerchantCounterPanelProps {
  onParseVoice: (transcript: string) => Promise<void>;
  onCreateInvoice: (data: VoiceParseData) => Promise<void>;
  parsedData: VoiceParseData | null;
  activeInvoice: InvoiceData | null;
  lastWebhook: WebhookResponse | null;
  audioLanguage: 'hi' | 'en';
  isParsing: boolean;
  isStandalone?: boolean;
}

export const MerchantCounterPanel: React.FC<MerchantCounterPanelProps> = ({
  onParseVoice,
  onCreateInvoice,
  parsedData,
  lastWebhook,
  audioLanguage,
  isParsing,
  isStandalone = false,
}) => {
  const [transcript, setTranscript] = useState<string>(
    'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210'
  );
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // Derived announcement from state
  const lastAnnouncement = lastWebhook
    ? lastWebhook.status === 'SUCCESS'
      ? audioLanguage === 'hi'
        ? `₹${lastWebhook.amount_received} prapt hue`
        : `₹${lastWebhook.amount_received} received`
      : lastWebhook.status === 'SHORTFALL_ALERT'
      ? audioLanguage === 'hi'
        ? `Savdhaan! Keval ₹${lastWebhook.amount_received} prapt hue hain! ₹${lastWebhook.deficit} baaki hai!`
        : `Warning! Only ₹${lastWebhook.amount_received} received! ₹${lastWebhook.deficit} is pending!`
      : 'Vani Soundbox ready. Push mic to speak checkout split.'
    : 'Vani Soundbox ready. Push mic to speak checkout split.';

  // Initialize Web Speech Recognition if available
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
          let currentText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          if (currentText) {
            setTranscript(currentText);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [audioLanguage]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        onParseVoice(transcript);
      }, 1500);
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

  const handlePresetClick = (presetText: string) => {
    setTranscript(presetText);
    onParseVoice(presetText);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim()) {
      onParseVoice(transcript.trim());
    }
  };

  const handlePlayAnnouncement = async () => {
    setIsPlayingAudio(true);
    if (lastWebhook?.status === 'SHORTFALL_ALERT') {
      playAlertSiren();
    } else {
      playPaytmChime();
    }
    await new Promise((r) => setTimeout(r, 600));
    await speakAnnouncement(lastAnnouncement, audioLanguage);
    setIsPlayingAudio(false);
  };

  const isShortfall = lastWebhook?.status === 'SHORTFALL_ALERT';

  return (
    <div className={`flex flex-col gap-6 ${isStandalone ? 'max-w-4xl mx-auto' : ''}`}>
      {/* Panel Top Title: Stripe Light */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E6EAF5]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[4px] bg-[#533AFD]/10 text-[#533AFD] flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0A1B3D] tracking-tight">
              Merchant Counter Screen
            </h2>
            <p className="text-xs text-[#6B7A99] font-medium">
              Zero-Typing Speech-to-Split QR Checkout Console
            </p>
          </div>
        </div>
        <span className="bg-[#FAFBFD] text-[#0A1B3D] text-xs font-bold px-3 py-1 rounded-[4px] border border-[#E6EAF5]">
          Audio Level 100%
        </span>
      </div>

      {/* Mismatch Alert Banner */}
      {isShortfall ? (
        <div className="bg-[#E02424] text-white p-5 rounded-[6px] border border-red-600 shadow-sm animate-pulse flex items-start gap-4">
          <ShieldAlert className="w-7 h-7 shrink-0 text-white mt-0.5" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold uppercase tracking-wide">
                SHORT PAYMENT / SPOOF DETECTED!
              </h3>
              <span className="bg-white text-[#E02424] font-black text-xs px-2.5 py-1 rounded-[3px]">
                Deficit: ₹{lastWebhook?.deficit} Pending
              </span>
            </div>
            <p className="text-sm mt-1.5 text-white/95 leading-relaxed">
              Customer scanned QR but sent only{' '}
              <span className="font-bold underline">₹{lastWebhook?.amount_received}</span> instead of{' '}
              <span className="font-bold underline">₹{lastWebhook?.amount_expected}</span>. Audio alarm sounded!
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[#FAFBFD] p-4 rounded-[6px] border border-[#E6EAF5] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[#0A1B3D]">
            <CheckCircle2 className="w-4 h-4 text-[#0E9F6E]" />
            <span>Counter Ready: Push Mic to Speak Bill Split</span>
          </div>
          <span className="text-[11px] text-[#533AFD] font-bold bg-[#533AFD]/10 px-2.5 py-0.5 rounded-[4px]">
            Groq Llama-3.3 &lt; 350ms
          </span>
        </div>
      )}

      {/* Push-to-Talk Speech Engine Card */}
      <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
              Push-to-Talk Speech Input
            </h3>
            <p className="text-xs text-[#6B7A99] mt-0.5">
              Speak bill totals, UPI splits, and credit names naturally
            </p>
          </div>
          {isListening && (
            <span className="text-xs font-bold text-[#E02424] animate-pulse flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-[4px] border border-red-200">
              <span className="w-2 h-2 rounded-full bg-[#E02424]" />
              Recording Voice...
            </span>
          )}
        </div>

        {/* Big Mic Button & Tall Waveform Visualizer */}
        <div className="flex items-center gap-6 bg-[#FAFBFD] p-5 rounded-[4px] border border-[#E6EAF5]">
          <button
            onClick={toggleListening}
            className={`w-16 h-16 rounded-[4px] flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isListening
                ? 'bg-[#E02424] text-white ring-4 ring-red-100 scale-105 shadow-md'
                : 'bg-[#533AFD] hover:bg-[#4329E0] text-white shadow-xs'
            }`}
            title={isListening ? 'Click to stop listening' : 'Click and speak voice command'}
          >
            {isListening ? (
              <MicOff className="w-7 h-7 animate-pulse" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>

          {/* Animated Waveform Visualizer */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 h-12">
              {WAVE_BARS.map((height, i) => (
                <div
                  key={i}
                  style={{
                    height: isListening ? `${height}px` : '6px',
                    backgroundColor: isListening ? '#533AFD' : '#E6EAF5',
                  }}
                  className={`w-2 rounded-[1px] transition-all duration-150 ${isListening ? 'wave-bar' : ''}`}
                />
              ))}
            </div>
            <p className="text-xs text-[#6B7A99] font-medium mt-2">
              {isListening
                ? 'Listening to storekeeper speech in real-time...'
                : 'Click mic to speak, or select a preset voice command below'}
            </p>
          </div>
        </div>

        {/* Live / Editable Speech Transcript Input Bar */}
        <form onSubmit={handleManualSubmit} className="flex gap-2.5">
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="e.g. Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210"
            className="flex-1 text-xs sm:text-sm bg-white border border-[#E6EAF5] rounded-[4px] px-3.5 py-2.5 text-[#0A1B3D] font-medium focus:outline-none focus:border-[#533AFD]"
          />
          <button
            type="submit"
            disabled={isParsing || !transcript.trim()}
            className="h-[44px] px-5 bg-[#533AFD] hover:bg-[#4329E0] disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center gap-2 shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            {isParsing ? (
              <Sparkles className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Decompose</span>
          </button>
        </form>

        {/* Quick Preset Voice Command Cards */}
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-xs font-bold text-[#6B7A99] uppercase tracking-wide">
            Preset Voice Scenarios:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <button
              onClick={() =>
                handlePresetClick(
                  'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210'
                )
              }
              className="text-left text-xs bg-[#FAFBFD] hover:bg-white text-[#0A1B3D] p-3 rounded-[4px] border border-[#E6EAF5] hover:border-[#533AFD] transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
            >
              <div>
                <span className="font-bold text-xs sm:text-sm block text-[#0A1B3D]">
                  ₹650 Split Bill
                </span>
                <span className="text-xs text-[#6B7A99]">
                  ₹400 UPI + ₹250 Udhari (Ramesh)
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#533AFD] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() =>
                handlePresetClick('Customer bill ₹200 full UPI payment')
              }
              className="text-left text-xs bg-[#FAFBFD] hover:bg-white text-[#0A1B3D] p-3 rounded-[4px] border border-[#E6EAF5] hover:border-[#533AFD] transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
            >
              <div>
                <span className="font-bold text-xs sm:text-sm block text-[#0A1B3D]">
                  ₹200 Full UPI
                </span>
                <span className="text-xs text-[#6B7A99]">
                  Instant Digital Payment
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#533AFD] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() =>
                handlePresetClick(
                  'Bill ₹1200 split with ₹500 cash and ₹700 UPI, Priya 9811223344'
                )
              }
              className="text-left text-xs bg-[#FAFBFD] hover:bg-white text-[#0A1B3D] p-3 rounded-[4px] border border-[#E6EAF5] hover:border-[#533AFD] transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
            >
              <div>
                <span className="font-bold text-xs sm:text-sm block text-[#0A1B3D]">
                  ₹1200 Cash & UPI Split
                </span>
                <span className="text-xs text-[#6B7A99]">
                  ₹500 Cash + ₹700 UPI (Priya)
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#533AFD] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() =>
                handlePresetClick(
                  'Customer bill ₹850 — ₹500 UPI now, ₹350 udhari for Friday, Suresh 9876501234'
                )
              }
              className="text-left text-xs bg-[#FAFBFD] hover:bg-white text-[#0A1B3D] p-3 rounded-[4px] border border-[#E6EAF5] hover:border-[#533AFD] transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
            >
              <div>
                <span className="font-bold text-xs sm:text-sm block text-[#0A1B3D]">
                  ₹850 Credit Extension
                </span>
                <span className="text-xs text-[#6B7A99]">
                  ₹500 UPI + ₹350 Udhari for Friday (Suresh)
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#533AFD] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      </div>

      {/* Parsed Intent Decomposition Card */}
      <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#533AFD]" />
            <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
              Extracted Bill Entities
            </h3>
          </div>
          {parsedData && (
            <span className="bg-[#0E9F6E]/10 text-[#0E9F6E] text-xs font-bold px-2.5 py-0.5 rounded-[3px]">
              Intent Verified
            </span>
          )}
        </div>

        {parsedData ? (
          <div className="flex flex-col gap-5">
            {/* Split Amount Metric Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Total Bill */}
              <div className="bg-[#FAFBFD] p-4 rounded-[4px] border border-[#E6EAF5] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#6B7A99] text-xs font-semibold mb-1">
                  <span>Total Bill</span>
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="text-3xl font-light text-[#0A1B3D] tracking-tight">
                  ₹{parsedData.total_bill}
                </div>
                <span className="text-[11px] text-[#6B7A99] mt-1">Full Cart Total</span>
              </div>

              {/* UPI Due Now */}
              <div className="bg-white p-4 rounded-[4px] border-2 border-[#533AFD] flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between text-[#533AFD] text-xs font-bold mb-1">
                  <span>UPI Due Now</span>
                  <CreditCard className="w-4 h-4 text-[#533AFD]" />
                </div>
                <div className="text-3xl font-light text-[#533AFD] tracking-tight">
                  ₹{parsedData.upi_amount}
                </div>
                <span className="text-[11px] text-[#533AFD] font-bold mt-1">
                  Amount-Locked in QR
                </span>
              </div>

              {/* Udhari Credit */}
              <div className="bg-[#FAFBFD] p-4 rounded-[4px] border border-amber-300 flex flex-col justify-between">
                <div className="flex items-center justify-between text-amber-800 text-xs font-bold mb-1">
                  <span>Credit (Udhari)</span>
                  <Banknote className="w-4 h-4 text-amber-700" />
                </div>
                <div className="text-3xl font-light text-amber-800 tracking-tight">
                  ₹{parsedData.udhari_amount}
                </div>
                <span className="text-[11px] text-amber-700 font-semibold mt-1">
                  WhatsApp Link Dispatched
                </span>
              </div>
            </div>

            {/* Extracted Customer Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#FAFBFD] p-3.5 rounded-[4px] border border-[#E6EAF5]">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#533AFD]" />
                <div>
                  <span className="text-[#6B7A99] block text-[10px]">Customer Name</span>
                  <span className="font-bold text-sm text-[#0A1B3D]">{parsedData.customer_name || 'Customer'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#533AFD]" />
                <div>
                  <span className="text-[#6B7A99] block text-[10px]">Phone Number</span>
                  <span className="font-bold text-sm text-[#0A1B3D]">{parsedData.customer_phone || '9876543210'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-700" />
                <div>
                  <span className="text-[#6B7A99] block text-[10px]">Credit Due Date</span>
                  <span className="font-bold text-sm text-amber-800">{parsedData.due_date || 'Monday, 17 Nov'}</span>
                </div>
              </div>
            </div>

            {/* Lock QR Action */}
            <button
              onClick={() => onCreateInvoice(parsedData)}
              className="h-[46px] w-full bg-[#533AFD] hover:bg-[#4329E0] text-white rounded-[4px] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <span>Lock Dynamic QR to ₹{parsedData.upi_amount} on Customer Screen</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-[#6B7A99]">
            Speak a voice command or click a preset above to decompose checkout intent.
          </div>
        )}
      </div>

      {/* Soundbox Voice Broadcast Player */}
      <div className="bg-white p-5 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#533AFD]" />
            <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
              Soundbox Speaker Broadcast
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-[#6B7A99]">
            Instant Audio Feedback
          </span>
        </div>

        <div className="bg-[#FAFBFD] p-4 rounded-[4px] border border-[#E6EAF5] flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[200px]">
            <span className="text-[10px] text-[#6B7A99] font-bold block uppercase tracking-wide">
              Last Broadcast Alert:
            </span>
            <p className="text-sm font-bold text-[#0A1B3D] mt-1 italic">
              &quot;{lastAnnouncement}&quot;
            </p>
          </div>
          <button
            onClick={handlePlayAnnouncement}
            disabled={isPlayingAudio}
            className="h-[38px] px-4 bg-white hover:bg-gray-50 border border-[#E6EAF5] disabled:opacity-50 text-[#0A1B3D] rounded-[4px] text-xs font-bold flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
          >
            <Volume2 className={`w-3.5 h-3.5 text-[#533AFD] ${isPlayingAudio ? 'animate-bounce' : ''}`} />
            <span>{isPlayingAudio ? 'Playing...' : 'Play Audio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
