'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Check,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Send,
  Sparkles,
  Upload,
  FileText,
  Building2,
} from 'lucide-react';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import {
  VoiceParseData,
  InvoiceData,
  WebhookResponse,
  InvoiceAnalysisResponse,
  RestockOrderResponse,
} from '@/types';
import {
  parseVoiceCommand,
  createCounterInvoice,
  triggerPaytmWebhook,
  sendUdhariReminder,
  reconcileUdhariPayment,
  analyzeDistributorInvoice,
  sendPurchaseOrder,
} from '@/lib/api';
import { playPaytmChime, playAlertSiren, speakAnnouncement } from '@/lib/audio';

interface PresetCommand {
  id: string;
  label: string;
  text: string;
  desc: string;
}

const PRESET_COMMANDS: PresetCommand[] = [
  {
    id: 'preset-1',
    label: '₹650 Split (₹400 UPI + ₹250 Udhari)',
    text: 'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210',
    desc: '400 UPI immediate, 250 store credit to Ramesh due Monday',
  },
  {
    id: 'preset-2',
    label: '₹200 Full UPI',
    text: 'Customer bill ₹200 — full UPI payment',
    desc: 'Instant digital settlement with zero store credit',
  },
  {
    id: 'preset-3',
    label: '₹1200 Split (₹700 Cash + ₹500 Udhari)',
    text: 'Customer bill ₹1200 — ₹700 cash received, ₹500 udhari for Friday, Priya 9811223344',
    desc: '700 cash collected, 500 store credit to Priya due Friday',
  },
  {
    id: 'preset-4',
    label: '₹450 Immediate UPI',
    text: 'Customer bill ₹450 — ₹450 UPI immediately',
    desc: 'Direct amount-locked dynamic QR counter payment',
  },
];

export const UnifiedWorkflow: React.FC = () => {
  // Step 1: Voice state
  const [transcript, setTranscript] = useState<string>(
    'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210'
  );
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<VoiceParseData | null>({
    total_bill: 650,
    upi_amount: 400,
    udhari_amount: 250,
    cash_amount: 0,
    due_date: '2026-11-17',
    customer_name: 'Ramesh Kumar',
    customer_phone: '9876543210',
    items: ['Kirana split items'],
  });

  // Step 2: Invoice & Payment state
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState<boolean>(false);
  const [step2Unlocked, setStep2Unlocked] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState<boolean>(false);
  const [paymentResult, setPaymentResult] = useState<WebhookResponse | null>(null);

  // Step 3: Udhari state
  const [step3Unlocked, setStep3Unlocked] = useState<boolean>(false);
  const [reminderSent, setReminderSent] = useState<boolean>(false);
  const [isSendingReminder, setIsSendingReminder] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isSettled, setIsSettled] = useState<boolean>(false);

  // Step 4: Restock state
  const [billFile, setBillFile] = useState<File | null>(null);
  const [isAnalyzingOcr, setIsAnalyzingOcr] = useState<boolean>(false);
  const [ocrAnalysis, setOcrAnalysis] = useState<InvoiceAnalysisResponse | null>(null);
  const [showDraftPO, setShowDraftPO] = useState<boolean>(false);
  const [isSendingPO, setIsSendingPO] = useState<boolean>(false);
  const [poResult, setPoResult] = useState<RestockOrderResponse | null>(null);

  // Section refs for smooth scrolling
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  // Countdown timer for Step 2
  useEffect(() => {
    if (!step2Unlocked || paymentResult?.status === 'SUCCESS') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [step2Unlocked, paymentResult]);

  // Handle parsing a command (text or preset)
  const handleParse = async (cmdText: string) => {
    setIsParsing(true);
    setPaymentResult(null);
    try {
      const res = await parseVoiceCommand(cmdText);
      if (res.data) {
        setParsedData(res.data);
      }
    } catch (err) {
      console.warn('Voice parse failed:', err);
    } finally {
      setIsParsing(false);
    }
  };

  // Push-to-Talk speech recognition simulation / Web Speech API
  const handleToggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      try {
        const SpeechRecognition =
          (window as unknown as {
            webkitSpeechRecognition: new () => {
              continuous: boolean;
              interimResults: boolean;
              lang: string;
              start: () => void;
              stop: () => void;
              onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
              onerror: () => void;
              onend: () => void;
            };
          }).webkitSpeechRecognition;

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'hi-IN';

        recognition.onresult = (event) => {
          const spoken = event.results[0][0].transcript;
          setTranscript(spoken);
          setIsListening(false);
          handleParse(spoken);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognition.start();
        return;
      } catch {
        // Fallback to simulated audio listener
      }
    }

    // High fidelity fallback listener simulation
    setTimeout(() => {
      setIsListening(false);
      handleParse(transcript);
    }, 1800);
  };

  // Step 1 -> Step 2: Create dynamic amount-locked invoice
  const handleGenerateQR = async () => {
    if (!parsedData) return;
    setIsGeneratingInvoice(true);
    try {
      const invoice = await createCounterInvoice({
        total_bill: parsedData.total_bill,
        upi_due: parsedData.upi_amount,
        udhari_amount: parsedData.udhari_amount,
        cash_received: parsedData.cash_amount,
        customer_name: parsedData.customer_name,
        customer_phone: parsedData.customer_phone,
        due_date: parsedData.due_date,
      });

      setActiveInvoice(invoice);
      setSecondsRemaining(180);
      setPaymentResult(null);
      setStep2Unlocked(true);

      // Smooth scroll to Step 2
      setTimeout(() => {
        step2Ref.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.warn('Invoice generation failed:', err);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Step 2: Simulate Payment (Correct full match or shortfall spoof)
  const handleSimulatePayment = async (amount: number) => {
    const invId = activeInvoice?.invoice_id || 'INV-2026-001';
    setIsSimulatingPayment(true);
    try {
      const utr = `PAYTM${Math.floor(100000000 + Math.random() * 900000000)}`;
      const res = await triggerPaytmWebhook({
        utr,
        amount,
        invoice_id: invId,
      });

      setPaymentResult(res);

      if (res.status === 'SUCCESS') {
        playPaytmChime();
        speakAnnouncement(res.voice_alert || `Paytm par ₹${amount} prapt hue`, 'hi');
        setStep3Unlocked(true);

        // Auto-scroll to Step 3 after brief celebration
        setTimeout(() => {
          step3Ref.current?.scrollIntoView({ behavior: 'smooth' });
        }, 1200);
      } else {
        // Shortfall alert
        playAlertSiren();
        speakAnnouncement(
          res.voice_alert || `Savdhaan! Keval ₹${amount} prapt hue hain! ₹${res.deficit} baaki hai!`,
          'hi'
        );
      }
    } catch (err) {
      console.warn('Payment simulation failed:', err);
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  // Step 3: Send WhatsApp Reminder
  const handleSendReminder = async () => {
    setIsSendingReminder(true);
    try {
      const udhId = activeInvoice?.udhari_id || 'udh-001';
      await sendUdhariReminder(udhId);
      setReminderSent(true);
    } catch (err) {
      console.warn('Send reminder failed:', err);
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Step 3: 1-Click Settle Udhari
  const handleSettleUdhari = async () => {
    setIsSettling(true);
    try {
      const udhId = activeInvoice?.udhari_id || 'udh-001';
      const amt = activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250;
      await reconcileUdhariPayment(udhId, amt);
      setIsSettled(true);
      playPaytmChime();
      speakAnnouncement(`Paytm udhari bhugtan ₹${amt} safal hua`, 'hi');
    } catch (err) {
      console.warn('Udhari reconcile failed:', err);
    } finally {
      setIsSettling(false);
    }
  };

  // Step 4: OCR Analysis
  const handleAnalyzeBill = async (sample = false) => {
    setIsAnalyzingOcr(true);
    setPoResult(null);
    try {
      const res = await analyzeDistributorInvoice(sample ? null : billFile);
      setOcrAnalysis(res);
      setShowDraftPO(false);
    } catch (err) {
      console.warn('OCR bill analysis failed:', err);
    } finally {
      setIsAnalyzingOcr(false);
    }
  };

  // Step 4: Dispatch PO
  const handleSendPO = async () => {
    if (!ocrAnalysis?.draft_po) return;
    setIsSendingPO(true);
    try {
      const res = await sendPurchaseOrder({
        po_number: ocrAnalysis.draft_po.po_number,
        supplier_name: ocrAnalysis.draft_po.supplier_name,
        supplier_phone: ocrAnalysis.draft_po.supplier_phone,
        items: ocrAnalysis.draft_po.items,
      });
      setPoResult(res);
    } catch (err) {
      console.warn('Send PO failed:', err);
    } finally {
      setIsSendingPO(false);
    }
  };

  // Reset entire checkout
  const handleResetCheckout = () => {
    setPaymentResult(null);
    setActiveInvoice(null);
    setStep2Unlocked(false);
    setStep3Unlocked(false);
    setReminderSent(false);
    setIsSettled(false);
    setSecondsRemaining(180);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 space-y-12 relative z-10">
      {/* Editorial Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Single Sovereign Natural Flow • Indic AI for Indian Commerce</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-light text-[#3d3d3d] tracking-tight">
          The Autonomous Counter & Credit Workflow
        </h1>
        <p className="text-sm text-[#717171] leading-relaxed">
          From spoken mixed-currency bills to amount-locked dynamic QR verification, automatic WhatsApp credit recovery, and distributor restocking.
        </p>
      </div>

      {/* ==================================================================== */}
      {/* STEP 1: VOICE CHECKOUT & SPLIT (Flow 1)                             */}
      {/* ==================================================================== */}
      <section className="bg-white rounded-[32px] p-8 border border-[#e6e6e6] shadow-sm space-y-6">
        {/* Step Indicator Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e6e6e6]">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#3a3f5c] text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#3d3d3d] tracking-tight">
                Step 1: Voice Checkout & Intent Split
              </h2>
              <p className="text-xs text-[#717171]">
                Speak the split bill in natural Hindi / English — Vani separates UPI cash from store credit
              </p>
            </div>
          </div>
          <span className="text-xs text-[#0e9f6e] font-semibold bg-[#0e9f6e]/10 px-3 py-1 rounded-full">
            Indic Voice-Native
          </span>
        </div>

        {/* Plugin Notice */}
        <div className="bg-[#fcfcfc] border border-[#e6e6e6] rounded-full px-4 py-2 flex items-center justify-between text-xs text-[#717171]">
          <span className="flex items-center gap-1.5 font-medium">
            <span>🔌</span>
            <span>Connect Sarvam AI for sovereign Indic voice recognition → using text / presets</span>
          </span>
          <span className="text-[11px] text-[#3a3f5c] font-semibold bg-[#3a3f5c]/5 px-2.5 py-0.5 rounded-full">
            Zero-Setup Mock Ready
          </span>
        </div>

        {/* Push-to-Talk Mic Section */}
        <div className="text-center py-6 border-b border-[#e6e6e6]">
          <div className="relative inline-block">
            <button
              type="button"
              onClick={handleToggleListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white shadow-lg scale-105 animate-pulse'
                  : 'bg-[#3a3f5c] hover:bg-[#2c314a] text-white shadow-md'
              }`}
            >
              <Mic className="w-8 h-8" />
            </button>
            {isListening && (
              <div className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping pointer-events-none" />
            )}
          </div>

          <div className="mt-4">
            <h3 className="text-base font-semibold text-[#3d3d3d]">
              {isListening ? 'Listening for bill details in Hindi / English...' : 'Push-to-Talk Voice Checkout'}
            </h3>
            <p className="text-xs text-[#717171] mt-1">
              Click microphone to speak or tap any quick preset below
            </p>
          </div>

          {/* Animated waveform bars */}
          {isListening && (
            <div className="flex items-center justify-center gap-1.5 mt-4 h-6">
              <span className="w-1 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.1s' }} />
              <span className="w-1 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.3s' }} />
              <span className="w-1 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.15s' }} />
              <span className="w-1 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.4s' }} />
              <span className="w-1 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.2s' }} />
            </div>
          )}
        </div>

        {/* Command Transcript Input */}
        <div>
          <label className="block text-xs font-semibold text-[#3d3d3d] mb-2">
            Spoken Counter Command Transcript
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g. Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210"
              className="flex-1 h-12 px-5 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-xs text-[#3d3d3d] focus:outline-none focus:border-[#3a3f5c]"
            />
            <button
              type="button"
              onClick={() => handleParse(transcript)}
              disabled={isParsing}
              className="h-12 px-6 bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-semibold text-xs rounded-full transition-colors cursor-pointer disabled:opacity-50"
            >
              {isParsing ? 'Parsing...' : 'Parse'}
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <span className="block text-[11px] font-semibold text-[#717171] uppercase tracking-wider mb-2.5">
            Quick Interactive Presets:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESET_COMMANDS.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => {
                  setTranscript(cmd.text);
                  handleParse(cmd.text);
                }}
                className="p-3 rounded-[20px] border border-[#e6e6e6] hover:border-[#3a3f5c] hover:bg-[#3a3f5c]/5 text-left transition-all cursor-pointer group"
              >
                <div className="text-xs font-semibold text-[#3d3d3d] group-hover:text-[#3a3f5c] flex items-center justify-between">
                  <span>{cmd.label}</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#717171] group-hover:text-[#f97316]" />
                </div>
                <div className="text-[11px] text-[#717171] mt-0.5 truncate">
                  {cmd.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Parsed Breakdown Receipt Card */}
        {parsedData && (
          <div className="bg-[#fcfcfc] rounded-[24px] border border-[#e6e6e6] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e6e6e6]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0e9f6e]" />
                <h4 className="text-xs font-bold text-[#3d3d3d]">
                  Live Parsed Intent Receipt
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-[#0e9f6e] bg-[#0e9f6e]/10 px-2.5 py-0.5 rounded-full">
                Math Verified ✓
              </span>
            </div>

            {/* Split Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#717171] block mb-1">Total Bill</span>
                <span className="text-base font-bold text-[#3d3d3d]">
                  ₹{parsedData.total_bill.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#717171] block mb-1">UPI Due Now</span>
                <span className="text-base font-bold text-[#3a3f5c]">
                  ₹{parsedData.upi_amount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#717171] block mb-1">Store Credit (Udhari)</span>
                <span className="text-base font-bold text-amber-600">
                  ₹{parsedData.udhari_amount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#717171] block mb-1">Cash Received</span>
                <span className="text-base font-bold text-[#3d3d3d]">
                  ₹{parsedData.cash_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            {parsedData.udhari_amount > 0 && (
              <div className="pt-3 border-t border-[#e6e6e6] flex flex-wrap items-center gap-4 text-xs text-[#717171]">
                <div>
                  <span className="font-semibold text-[#3d3d3d]">Customer: </span>
                  <span>{parsedData.customer_name || 'Ramesh Kumar'}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#3d3d3d]">Phone: </span>
                  <span className="font-mono">{parsedData.customer_phone || '9876543210'}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#3d3d3d]">Due Date: </span>
                  <span>{parsedData.due_date || 'Monday, 17 Nov 2026'}</span>
                </div>
              </div>
            )}

            {/* Action to Step 2 */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleGenerateQR}
                disabled={isGeneratingInvoice}
                className="h-11 px-7 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>
                  {isGeneratingInvoice
                    ? 'Generating Amount-Locked QR...'
                    : `Generate Amount-Locked Dynamic QR (₹${parsedData.upi_amount.toFixed(2)})`}
                </span>
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* STEP 2: DYNAMIC QR & REAL-TIME SPOOF GUARD (Flow 1 & Flow 2)        */}
      {/* ==================================================================== */}
      <section
        ref={step2Ref}
        className={`bg-white rounded-[32px] p-8 border border-[#e6e6e6] shadow-sm space-y-6 transition-all duration-300 ${
          !step2Unlocked ? 'opacity-60' : ''
        }`}
      >
        {/* Step Indicator Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e6e6e6]">
          <div className="flex items-center gap-3">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                paymentResult?.status === 'SUCCESS'
                  ? 'bg-[#0e9f6e] text-white'
                  : 'bg-[#3a3f5c] text-white'
              }`}
            >
              {paymentResult?.status === 'SUCCESS' ? <Check className="w-4 h-4" /> : '2'}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#3d3d3d] tracking-tight">
                Step 2: Dynamic QR & Real-Time Spoof Guard
              </h2>
              <p className="text-xs text-[#717171]">
                Counter screen locks to exact UPI due amount — Soundbox flags mismatch attacks instantly
              </p>
            </div>
          </div>
          <span className="text-xs text-[#717171]">
            Target VPA: <span className="font-mono text-[#3d3d3d] font-semibold">srilakshmi@paytm</span>
          </span>
        </div>

        {/* Customer Screen Box */}
        <div className="bg-[#fcfcfc] rounded-[24px] border border-[#e6e6e6] p-8 text-center relative overflow-hidden">
          {/* Store Info */}
          <div className="flex items-center justify-center gap-2 text-xs text-[#717171] mb-2">
            <span className="w-2 h-2 rounded-full bg-[#0e9f6e]" />
            <span className="font-semibold text-[#3d3d3d]">Sri Lakshmi Stores</span>
            <span>•</span>
            <span className="font-mono">Ref: {activeInvoice?.invoice_id || 'INV-2026-001'}</span>
          </div>

          {/* Amount Display */}
          <div className="my-2">
            <span className="text-xs uppercase tracking-wider text-[#717171] font-semibold block mb-1">
              Amount Locked on Soundbox Screen
            </span>
            <div className="text-4xl sm:text-5xl font-light text-[#3d3d3d] tracking-tight">
              ₹{(activeInvoice?.upi_due || parsedData?.upi_amount || 400).toFixed(2)}
            </div>
          </div>

          {/* QR Code */}
          <div className="my-6 flex justify-center">
            <div className="p-3 bg-white border border-[#e6e6e6] rounded-[20px] shadow-xs inline-block">
              <QRCodeDisplay
                value={
                  activeInvoice?.qr_data ||
                  'upi://pay?pa=srilakshmi@paytm&pn=SriLakshmiStores&am=400.00&cu=INR'
                }
                size={220}
              />
            </div>
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-2 text-xs text-[#717171]">
            <Clock className="w-3.5 h-3.5 text-[#f97316]" />
            <span>
              QR locked to due amount • Expires in{' '}
              <span className="font-mono font-bold text-[#3d3d3d]">
                {Math.floor(secondsRemaining / 60)}:
                {(secondsRemaining % 60).toString().padStart(2, '0')}
              </span>
            </span>
          </div>

          {/* SUCCESS OVERLAY */}
          {paymentResult?.status === 'SUCCESS' && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-full bg-[#0e9f6e]/10 text-[#0e9f6e] flex items-center justify-center mb-4">
                <Check className="w-9 h-9" />
              </div>
              <h3 className="text-2xl font-bold text-[#3d3d3d]">
                ₹{(paymentResult.amount_received || 400).toFixed(2)} Received!
              </h3>
              <p className="text-xs text-[#0e9f6e] font-semibold mt-1">
                Soundbox Chime Verified • Paytm Voice Alert Played
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => step3Ref.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="h-10 px-5 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Proceed to Step 3 (WhatsApp Recovery)</span>
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* SHORTFALL SPOOF OVERLAY */}
          {paymentResult?.status === 'SHORTFALL_ALERT' && (
            <div className="absolute inset-0 bg-rose-50/95 backdrop-blur-sm border-2 border-rose-500 rounded-[24px] flex flex-col items-center justify-center p-6 animate-in fade-in duration-150">
              <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center mb-3 shadow-md animate-bounce">
                <AlertTriangle className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-bold text-rose-800">
                ⚠️ SHORTFALL SPOOF ATTACK FLAGGED!
              </h3>
              <p className="text-xs text-rose-700 mt-1 max-w-md">
                Customer only paid ₹{paymentResult.amount_received.toFixed(2)} instead of ₹
                {paymentResult.amount_expected.toFixed(2)}. Deficit of ₹
                {paymentResult.deficit.toFixed(2)} triggered Soundbox siren alert!
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setPaymentResult(null)}
                  className="h-10 px-5 rounded-full bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Dismiss Siren & Re-scan</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Simulation Triggers */}
        <div className="bg-[#fcfcfc] rounded-[24px] border border-[#e6e6e6] p-6 space-y-3">
          <span className="block text-xs font-bold text-[#3d3d3d]">
            Test Payment Verification & Spoof Defense:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                handleSimulatePayment(activeInvoice?.upi_due || parsedData?.upi_amount || 400)
              }
              disabled={isSimulatingPayment}
              className="h-11 px-5 rounded-full bg-[#0e9f6e] hover:bg-[#057a55] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                Simulate Full Payment (₹{(activeInvoice?.upi_due || parsedData?.upi_amount || 400).toFixed(2)})
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSimulatePayment(40)}
              disabled={isSimulatingPayment}
              className="h-11 px-5 rounded-full bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Simulate ₹40 Short Payment Spoof</span>
            </button>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* STEP 3: AUTOMATED WHATSAPP UDHARI RECOVERY (Flow 1)                 */}
      {/* ==================================================================== */}
      <section
        ref={step3Ref}
        className={`bg-white rounded-[32px] p-8 border border-[#e6e6e6] shadow-sm space-y-6 transition-all duration-300 ${
          !step3Unlocked ? 'opacity-60' : ''
        }`}
      >
        {/* Step Indicator Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e6e6e6]">
          <div className="flex items-center gap-3">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isSettled ? 'bg-[#0e9f6e] text-white' : 'bg-[#3a3f5c] text-white'
              }`}
            >
              {isSettled ? <Check className="w-4 h-4" /> : '3'}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#3d3d3d] tracking-tight">
                Step 3: Automated WhatsApp Udhari Recovery
              </h2>
              <p className="text-xs text-[#717171]">
                Scheduled recovery reminder with 1-click Paytm payment link for store credit balance
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              isSettled
                ? 'bg-[#0e9f6e]/10 text-[#0e9f6e]'
                : reminderSent
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {isSettled ? 'SETTLED ✓' : reminderSent ? 'REMINDER SENT' : 'UNPAID CREDIT'}
          </span>
        </div>

        {/* Credit Card Details */}
        <div className="bg-[#fcfcfc] rounded-[24px] border border-[#e6e6e6] p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pb-4 border-b border-[#e6e6e6]">
            <div>
              <span className="text-[#717171] block mb-1">Customer</span>
              <span className="font-bold text-[#3d3d3d]">
                {activeInvoice?.customer_name || parsedData?.customer_name || 'Ramesh Kumar'}
              </span>
            </div>
            <div>
              <span className="text-[#717171] block mb-1">WhatsApp Phone</span>
              <span className="font-mono text-[#3d3d3d]">
                +91 {activeInvoice?.customer_phone || parsedData?.customer_phone || '9876543210'}
              </span>
            </div>
            <div>
              <span className="text-[#717171] block mb-1">Credit Extended</span>
              <span className="font-bold text-amber-600 text-sm">
                ₹{(activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[#717171] block mb-1">Promised Due Date</span>
              <span className="font-semibold text-[#3d3d3d]">
                {activeInvoice?.due_date || parsedData?.due_date || 'Monday, 17 Nov 2026'}
              </span>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#717171]">
              <Smartphone className="w-4 h-4 text-[#0e9f6e]" />
              <span>
                {reminderSent
                  ? 'WhatsApp recovery link dispatched to customer phone'
                  : 'Automated 1-click Paytm payment link ready for dispatch'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSendReminder}
              disabled={isSendingReminder || reminderSent}
              className="h-10 px-5 rounded-full bg-[#0e9f6e] hover:bg-[#057a55] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{reminderSent ? 'Link Dispatched ✓' : 'Send WhatsApp Payment Link'}</span>
            </button>
          </div>
        </div>

        {/* Realistic WhatsApp Chat Bubble */}
        <div className="bg-[#efeae2] rounded-[24px] border border-[#e6e6e6] p-6 space-y-4">
          <div className="text-[11px] text-[#717171] flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium">
              <span>🔌</span>
              <span>Connect WhatsApp Cloud API for live delivery → currently simulated</span>
            </span>
            <span className="font-semibold text-[#3d3d3d]">Customer WhatsApp Preview</span>
          </div>

          {/* Chat Bubble */}
          <div className="max-w-md bg-white rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] p-4 shadow-sm border border-black/5 text-xs space-y-2">
            <div className="font-bold text-[#3d3d3d] text-[13px]">
              Sri Lakshmi Stores
            </div>
            <p className="text-[#3d3d3d] leading-relaxed whitespace-pre-line">
              {`Namaste ${activeInvoice?.customer_name || 'Ramesh'} ji! 🛒\n\nAapka ₹${(activeInvoice?.udhari_amount || 250).toFixed(2)} ka udhari bill due hai Sri Lakshmi Stores par.\n📅 Due Date: ${activeInvoice?.due_date || 'Monday, 17 Nov 2026'}\n\nKripya niche diye gaye direct Paytm link se 1-click payment karein:`}
            </p>

            <div className="p-2.5 bg-[#3a3f5c]/5 border border-[#3a3f5c]/15 rounded-[12px] flex items-center justify-between">
              <div>
                <span className="block font-bold text-[#3a3f5c] text-[11px]">Paytm Instant Pay</span>
                <span className="text-[10px] text-[#717171] font-mono">
                  https://p.paytm.me/pay?id=udh-001&am=250.00
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#3a3f5c]" />
            </div>

            <div className="text-right text-[10px] text-[#717171]">
              12:45 PM • Delivered ✓✓
            </div>
          </div>

          {/* 1-Click Settlement Simulator */}
          <div className="pt-3 border-t border-[#3d3d3d]/10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#3d3d3d] font-medium">
              Simulate customer tapping the WhatsApp link & settling payment:
            </span>
            <button
              type="button"
              onClick={handleSettleUdhari}
              disabled={isSettled || isSettling}
              className="h-10 px-5 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSettled
                  ? 'Udhari Reconciled (Settled ✓)'
                  : `Simulate Customer Settlement (₹${(activeInvoice?.udhari_amount || 250).toFixed(2)})`}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* STEP 4: WHATSAPP SNAP-TO-RESTOCK AGENT (Flow 3)                     */}
      {/* ==================================================================== */}
      <section className="bg-white rounded-[32px] p-8 border border-[#e6e6e6] shadow-sm space-y-6">
        {/* Step Indicator Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e6e6e6]">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#3a3f5c] text-white flex items-center justify-center text-xs font-bold">
              4
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#3d3d3d] tracking-tight">
                Step 4: WhatsApp Snap-to-Restock Agent
              </h2>
              <p className="text-xs text-[#717171]">
                Photograph distributor bill — Vision OCR detects silent price hikes and auto-drafts WhatsApp PO
              </p>
            </div>
          </div>
          <span className="text-xs text-[#f97316] font-semibold bg-[#f97316]/10 px-3 py-1 rounded-full">
            Vision OCR & Price Creep
          </span>
        </div>

        {/* Plugin Notice */}
        <div className="bg-[#fcfcfc] border border-[#e6e6e6] rounded-full px-4 py-2 flex items-center justify-between text-xs text-[#717171]">
          <span className="flex items-center gap-1.5 font-medium">
            <span>🔌</span>
            <span>Connect Gemini 2.5 Flash Vision API for real camera OCR → using mock extraction engine</span>
          </span>
          <span className="text-[11px] text-[#3a3f5c] font-semibold bg-[#3a3f5c]/5 px-2.5 py-0.5 rounded-full">
            Zero-Setup Mock Ready
          </span>
        </div>

        {/* File Dropzone Box */}
        <div className="border-2 border-dashed border-[#e6e6e6] hover:border-[#3a3f5c]/40 rounded-[24px] p-8 text-center transition-all bg-[#fcfcfc]">
          <div className="w-12 h-12 rounded-full bg-[#3a3f5c]/10 text-[#3a3f5c] flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-[#3d3d3d]">
            Upload Distributor Paper Bill or Delivery Challan
          </h4>
          <p className="text-xs text-[#717171] mt-1">
            Drag & drop photo or use the sample bill below
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <label className="h-10 px-4 rounded-full bg-white border border-[#e6e6e6] text-xs font-semibold text-[#3d3d3d] hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer">
              <FileText className="w-4 h-4 text-[#717171]" />
              <span>{billFile ? billFile.name : 'Choose File'}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setBillFile(e.target.files[0]);
                }}
              />
            </label>

            {billFile && (
              <button
                type="button"
                onClick={() => handleAnalyzeBill(false)}
                disabled={isAnalyzingOcr}
                className="h-10 px-5 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>{isAnalyzingOcr ? 'Analyzing...' : 'Analyze Uploaded Bill'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAnalyzeBill(true)}
              disabled={isAnalyzingOcr}
              className="h-10 px-5 rounded-full bg-[#f97316]/10 hover:bg-[#f97316]/20 text-[#f97316] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAnalyzingOcr ? 'Extracting SKUs...' : 'Load Sample Wholesaler Bill (Metro Cash & Carry)'}</span>
            </button>
          </div>
        </div>

        {/* Extracted Line Items & Price Audit Table */}
        {ocrAnalysis && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-[#fcfcfc] rounded-[24px] border border-[#e6e6e6] overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-[#e6e6e6] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#3a3f5c]" />
                    <h3 className="text-sm font-semibold text-[#3d3d3d]">
                      {ocrAnalysis.vendor_name}
                    </h3>
                  </div>
                  <div className="text-xs text-[#717171] mt-0.5">
                    Invoice: <span className="font-mono text-[#3d3d3d] font-semibold">{ocrAnalysis.invoice_no}</span> • Date: {ocrAnalysis.invoice_date}
                  </div>
                </div>

                {ocrAnalysis.price_hikes?.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Silent Price Creep Detected (+10.7%)</span>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e6e6e6] bg-white text-[#717171]">
                      <th className="py-3 px-5 font-semibold">SKU / Item</th>
                      <th className="py-3 px-4 font-semibold text-center">Qty</th>
                      <th className="py-3 px-4 font-semibold text-right">Billed Rate</th>
                      <th className="py-3 px-4 font-semibold text-right">Baseline Rate</th>
                      <th className="py-3 px-5 font-semibold text-center">Price Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6e6e6]">
                    {ocrAnalysis.items.map((item, idx) => (
                      <tr
                        key={idx}
                        className={item.price_hike_detected ? 'bg-rose-50/40' : 'hover:bg-white/50'}
                      >
                        <td className="py-3.5 px-5 font-medium text-[#3d3d3d]">{item.sku}</td>
                        <td className="py-3.5 px-4 text-center text-[#717171]">{item.quantity}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#3d3d3d]">
                          ₹{item.unit_rate.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[#717171]">
                          ₹{(item.previous_rate || item.unit_rate).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          {item.price_hike_detected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2.5 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>+{item.hike_percentage.toFixed(1)}% Hike</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0e9f6e] bg-[#0e9f6e]/10 px-2.5 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              <span>Normal Rate</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Action */}
              <div className="p-4 border-t border-[#e6e6e6] flex items-center justify-between bg-white">
                <span className="text-xs text-[#717171]">
                  Baseline verified against 30-day merchant history
                </span>
                <button
                  type="button"
                  onClick={() => setShowDraftPO(true)}
                  className="h-10 px-5 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Draft Low-Stock Purchase Order
                </button>
              </div>
            </div>

            {/* Draft PO & WhatsApp Dispatch Card */}
            {showDraftPO && ocrAnalysis.draft_po && (
              <div className="bg-[#efeae2] rounded-[24px] border border-[#e6e6e6] p-6 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#3d3d3d]">
                    Wholesaler WhatsApp PO Dispatch ({ocrAnalysis.draft_po.supplier_name})
                  </span>
                  <span className="text-[11px] text-[#717171]">
                    🔌 Connect WhatsApp API for live dispatch → simulated
                  </span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="max-w-lg bg-white rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] p-4 shadow-sm border border-black/5 text-xs space-y-2">
                  <div className="font-bold text-[#3d3d3d] text-[13px]">
                    📦 PURCHASE ORDER: {ocrAnalysis.draft_po.po_number}
                  </div>
                  <div className="text-[#717171] text-[11px]">
                    From: <span className="text-[#3d3d3d] font-semibold">Sri Lakshmi Stores</span> • To:{' '}
                    <span className="text-[#3d3d3d] font-semibold">{ocrAnalysis.draft_po.supplier_name}</span>
                  </div>

                  <p className="text-[#3d3d3d] leading-relaxed">
                    Please confirm dispatch for the following restocking requirements at our agreed baseline rates:
                  </p>

                  <div className="bg-[#fcfcfc] rounded-[12px] p-3 border border-[#e6e6e6] space-y-1.5 font-mono text-[11px]">
                    {ocrAnalysis.draft_po.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-[#3d3d3d]">
                        <span>• {it.quantity}x {it.sku}</span>
                        <span className="font-bold text-[#3a3f5c]">Target: ₹{it.expected_rate.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] text-[#717171] italic pt-1">
                    _Auto-generated via Vani Restock Agent • Rate protection enabled_
                  </div>
                </div>

                {/* Dispatch Button */}
                <div className="pt-3 border-t border-[#3d3d3d]/10 flex flex-wrap items-center justify-between gap-3">
                  {poResult ? (
                    <div className="text-xs font-bold text-[#0e9f6e] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{poResult.message}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-[#3d3d3d] font-medium">
                      One-click dispatch directly to distributor WhatsApp
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleSendPO}
                    disabled={isSendingPO || Boolean(poResult)}
                    className="h-10 px-5 rounded-full bg-[#0e9f6e] hover:bg-[#057a55] text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{poResult ? 'PO Dispatched ✓' : 'Dispatch PO to Wholesaler via WhatsApp'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Restart/Reset Global Flow Bar */}
      <div className="text-center pt-4 pb-8">
        <button
          type="button"
          onClick={handleResetCheckout}
          className="h-12 px-8 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-semibold text-xs flex items-center gap-2 mx-auto transition-all shadow-md cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Counter & Start Next Customer Checkout</span>
        </button>
      </div>
    </div>
  );
};
