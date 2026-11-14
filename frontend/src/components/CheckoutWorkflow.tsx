'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  ArrowRight,
  ArrowLeft,
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
} from 'lucide-react';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { VoiceParseData, InvoiceData, WebhookResponse } from '@/types';
import {
  parseVoiceCommand,
  createCounterInvoice,
  triggerPaytmWebhook,
  sendUdhariReminder,
  reconcileUdhariPayment,
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
    text: '₹650 bill - ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210',
    desc: '400 UPI immediate, 250 store credit to Ramesh due Monday',
  },
  {
    id: 'preset-2',
    label: '₹200 Full UPI',
    text: '₹200 bill - full UPI payment',
    desc: 'Standard instant digital checkout with zero credit',
  },
  {
    id: 'preset-3',
    label: '₹1200 Split (₹700 Cash + ₹500 Udhari)',
    text: '₹1200 total bill - ₹700 cash received, ₹500 udhari for Friday, Priya 9811223344',
    desc: '700 cash collected, 500 store credit to Priya due Friday',
  },
  {
    id: 'preset-4',
    label: '₹450 Immediate UPI',
    text: '₹450 bill - ₹450 UPI immediately',
    desc: 'Direct amount-locked dynamic QR checkout',
  },
];

export const CheckoutWorkflow: React.FC = () => {
  // Step navigation: 1 = Voice Checkout, 2 = Customer Payment, 3 = Credit Recovery
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Voice state
  const [transcript, setTranscript] = useState<string>(
    '₹650 bill - ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210'
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
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState<boolean>(false);
  const [paymentResult, setPaymentResult] = useState<WebhookResponse | null>(null);

  // Step 3: Udhari state
  const [reminderSent, setReminderSent] = useState<boolean>(false);
  const [isSendingReminder, setIsSendingReminder] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isSettled, setIsSettled] = useState<boolean>(false);

  // Countdown timer for Step 2
  useEffect(() => {
    if (currentStep !== 2 || paymentResult?.status === 'SUCCESS') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, paymentResult]);

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
    // If Web Speech API is supported
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      try {
        const SpeechRecognition =
          (window as unknown as { webkitSpeechRecognition: new () => {
            continuous: boolean;
            interimResults: boolean;
            lang: string;
            start: () => void;
            stop: () => void;
            onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
            onerror: () => void;
            onend: () => void;
          } }).webkitSpeechRecognition;

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

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
        return;
      } catch {
        // Fallback to simulated audio listener
      }
    }

    // Realistic fallback listener simulation
    setTimeout(() => {
      setIsListening(false);
      handleParse(transcript);
    }, 1800);
  };

  // Step 1 -> Step 2: Create dynamic invoice
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
      setCurrentStep(2);
    } catch (err) {
      console.warn('Invoice generation failed:', err);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Step 2: Simulate Payment (Correct or Shortfall)
  const handleSimulatePayment = async (amount: number) => {
    if (!activeInvoice) return;
    setIsSimulatingPayment(true);
    try {
      const utr = `PAYTM${Math.floor(100000000 + Math.random() * 900000000)}`;
      const res = await triggerPaytmWebhook({
        utr,
        amount,
        invoice_id: activeInvoice.invoice_id,
      });

      setPaymentResult(res);

      if (res.status === 'SUCCESS') {
        // Play payment chime
        playPaytmChime();
        speakAnnouncement(res.voice_alert || `Paytm par ₹${amount} prapt hue`, 'hi');

        // Auto-advance to Step 3 after 1.8 seconds
        setTimeout(() => {
          setCurrentStep(3);
        }, 1800);
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

  // Step 3: Settle Udhari
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

  // Reset entire checkout
  const handleResetCheckout = () => {
    setCurrentStep(1);
    setPaymentResult(null);
    setActiveInvoice(null);
    setReminderSent(false);
    setIsSettled(false);
    setSecondsRemaining(180);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Step Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          {/* Track line */}
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-[#E6EAF5] -z-10" />

          {/* Step 1 Pill */}
          <button
            onClick={() => setCurrentStep(1)}
            className="flex items-center gap-2.5 bg-white pr-3 cursor-pointer group"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                currentStep === 1
                  ? 'bg-[#533AFD] text-white shadow-xs'
                  : currentStep > 1
                  ? 'bg-[#0E9F6E] text-white'
                  : 'bg-white border border-[#E6EAF5] text-[#6B7A99]'
              }`}
            >
              {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-[#0A1B3D]">Step 1</span>
              <span className="block text-[11px] text-[#6B7A99]">Voice Command</span>
            </div>
          </button>

          {/* Step 2 Pill */}
          <button
            onClick={() => {
              if (activeInvoice || parsedData) setCurrentStep(2);
            }}
            disabled={!activeInvoice && currentStep === 1}
            className={`flex items-center gap-2.5 bg-white px-3 transition-opacity ${
              !activeInvoice && currentStep === 1
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                currentStep === 2
                  ? 'bg-[#533AFD] text-white shadow-xs'
                  : currentStep > 2
                  ? 'bg-[#0E9F6E] text-white'
                  : 'bg-white border border-[#E6EAF5] text-[#6B7A99]'
              }`}
            >
              {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-[#0A1B3D]">Step 2</span>
              <span className="block text-[11px] text-[#6B7A99]">Payment QR Screen</span>
            </div>
          </button>

          {/* Step 3 Pill */}
          <button
            onClick={() => {
              if (paymentResult?.status === 'SUCCESS' || currentStep === 3) setCurrentStep(3);
            }}
            disabled={currentStep < 3 && paymentResult?.status !== 'SUCCESS'}
            className={`flex items-center gap-2.5 bg-white pl-3 transition-opacity ${
              currentStep < 3 && paymentResult?.status !== 'SUCCESS'
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                currentStep === 3
                  ? 'bg-[#533AFD] text-white shadow-xs'
                  : 'bg-white border border-[#E6EAF5] text-[#6B7A99]'
              }`}
            >
              3
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-[#0A1B3D]">Step 3</span>
              <span className="block text-[11px] text-[#6B7A99]">Udhari & WhatsApp</span>
            </div>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* STEP 1: VOICE CHECKOUT                                         */}
      {/* ============================================================== */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Card Container */}
          <div className="bg-white rounded-[6px] border border-[#E6EAF5] p-6 shadow-xs">
            {/* Integration Notice */}
            <div className="mb-6 bg-[#F8FAFC] border border-[#E6EAF5] rounded-[4px] px-3.5 py-2 flex items-center justify-between text-xs text-[#6B7A99]">
              <span className="flex items-center gap-1.5 font-medium">
                <span>🔌</span>
                <span>Connect Sarvam AI for live Hindi voice recognition → using text / presets</span>
              </span>
              <span className="text-[11px] text-[#533AFD] font-semibold bg-[#533AFD]/5 px-2 py-0.5 rounded-[4px]">
                Zero-Setup Ready
              </span>
            </div>

            {/* Centered Push-to-Talk Mic Section */}
            <div className="text-center py-6 border-b border-[#E6EAF5]">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={handleToggleListening}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isListening
                      ? 'bg-rose-500 text-white shadow-lg scale-105 animate-pulse'
                      : 'bg-[#533AFD] hover:bg-[#4329E0] text-white shadow-md'
                  }`}
                >
                  <Mic className="w-8 h-8" />
                </button>

                {/* Animated Waveform rings if listening */}
                {isListening && (
                  <div className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping pointer-events-none" />
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-base font-semibold text-[#0A1B3D]">
                  {isListening ? 'Listening for bill details in Hindi / English...' : 'Push-to-Talk Voice Checkout'}
                </h3>
                <p className="text-xs text-[#6B7A99] mt-1">
                  Click microphone or pick one of the quick command presets below
                </p>
              </div>

              {/* Animated audio bars */}
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

            {/* Editable Voice Transcript Area */}
            <div className="pt-6">
              <label className="block text-xs font-semibold text-[#0A1B3D] mb-2">
                Merchant Counter Command
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="e.g. ₹650 bill - ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210"
                  className="flex-1 h-12 px-3.5 bg-white border border-[#E6EAF5] rounded-[4px] text-sm text-[#0A1B3D] focus:outline-none focus:border-[#533AFD]"
                />
                <button
                  type="button"
                  onClick={() => handleParse(transcript)}
                  disabled={isParsing}
                  className="h-12 px-5 bg-[#533AFD] hover:bg-[#4329E0] text-white font-semibold text-xs rounded-[4px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isParsing ? 'Parsing...' : 'Parse Command'}
                </button>
              </div>
            </div>

            {/* Quick Command Preset Chips */}
            <div className="mt-5">
              <span className="block text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wider mb-2">
                Quick Presets:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => {
                      setTranscript(cmd.text);
                      handleParse(cmd.text);
                    }}
                    className="p-2.5 rounded-[4px] border border-[#E6EAF5] hover:border-[#533AFD] hover:bg-[#533AFD]/5 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-semibold text-[#0A1B3D] group-hover:text-[#533AFD] flex items-center justify-between">
                      <span>{cmd.label}</span>
                      <Sparkles className="w-3 h-3 text-[#6B7A99] group-hover:text-[#533AFD]" />
                    </div>
                    <div className="text-[11px] text-[#6B7A99] mt-0.5 truncate">
                      {cmd.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Parsed Intent Breakdown Card (Receipt Style) */}
          {parsedData && (
            <div className="bg-[#F8FAFC] rounded-[6px] border border-[#E6EAF5] p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#E6EAF5]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-[4px] bg-[#0E9F6E]/10 text-[#0E9F6E] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-[#0A1B3D]">
                    Parsed Intent Receipt
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-[#0E9F6E] bg-[#0E9F6E]/10 px-2 py-0.5 rounded-[4px]">
                  Math Verified ✓
                </span>
              </div>

              {/* Receipt Columns */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-[#E6EAF5] text-xs">
                <div>
                  <span className="text-[#6B7A99] block mb-1">Total Bill</span>
                  <span className="text-base font-bold text-[#0A1B3D]">
                    ₹{parsedData.total_bill.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7A99] block mb-1">UPI Due Now</span>
                  <span className="text-base font-bold text-[#533AFD]">
                    ₹{parsedData.upi_amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7A99] block mb-1">Store Credit (Udhari)</span>
                  <span className="text-base font-bold text-amber-600">
                    ₹{parsedData.udhari_amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7A99] block mb-1">Cash Received</span>
                  <span className="text-base font-bold text-[#0A1B3D]">
                    ₹{parsedData.cash_amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Customer Info (if credit extended) */}
              {parsedData.udhari_amount > 0 && (
                <div className="pt-3 pb-1 flex flex-wrap items-center gap-4 text-xs text-[#6B7A99]">
                  <div>
                    <span className="font-semibold text-[#0A1B3D]">Customer: </span>
                    <span>{parsedData.customer_name || 'Ramesh Kumar'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#0A1B3D]">Phone: </span>
                    <span>{parsedData.customer_phone || '9876543210'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#0A1B3D]">Promise Due Date: </span>
                    <span>{parsedData.due_date || 'Monday, 17 Nov 2026'}</span>
                  </div>
                </div>
              )}

              {/* Primary Action Button */}
              <div className="pt-5 mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateQR}
                  disabled={isGeneratingInvoice}
                  className="h-12 px-6 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white font-semibold text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {isGeneratingInvoice
                      ? 'Generating Amount-Locked QR...'
                      : `Generate Amount-Locked QR (₹${parsedData.upi_amount.toFixed(2)})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 2: CUSTOMER PAYMENT SCREEN (Amount-Locked QR)            */}
      {/* ============================================================== */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Back button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="text-xs font-semibold text-[#6B7A99] hover:text-[#0A1B3D] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Edit Voice Command / Back</span>
            </button>
            <span className="text-xs text-[#6B7A99]">
              Invoice Ref: <span className="font-mono text-[#0A1B3D] font-bold">{activeInvoice?.invoice_id || 'INV-2026-001'}</span>
            </span>
          </div>

          {/* Customer Facing Soundbox Screen (High contrast white card) */}
          <div className="bg-white rounded-[6px] border border-[#E6EAF5] p-8 shadow-sm text-center relative overflow-hidden">
            {/* Merchant Identity header */}
            <div className="flex items-center justify-center gap-2 text-xs text-[#6B7A99] mb-4">
              <span className="w-2 h-2 rounded-full bg-[#0E9F6E]" />
              <span className="font-semibold text-[#0A1B3D]">Sri Lakshmi Stores</span>
              <span>•</span>
              <span className="font-mono">srilakshmi@paytm</span>
            </div>

            {/* Massive Amount Display */}
            <div className="my-2">
              <span className="text-xs uppercase tracking-wider text-[#6B7A99] font-semibold block mb-1">
                Amount Locked for Payment
              </span>
              <div className="text-4xl sm:text-5xl font-light text-[#0A1B3D] tracking-tight">
                ₹{(activeInvoice?.upi_due || parsedData?.upi_amount || 400).toFixed(2)}
              </div>
            </div>

            {/* QR Code Container */}
            <div className="my-6 flex justify-center">
              <div className="p-3 bg-white border border-[#E6EAF5] rounded-[6px] shadow-xs inline-block">
                <QRCodeDisplay
                  value={
                    activeInvoice?.qr_data ||
                    'upi://pay?pa=srilakshmi@paytm&pn=SriLakshmiStores&am=400.00&cu=INR'
                  }
                  size={220}
                />
              </div>
            </div>

            {/* Countdown timer */}
            <div className="flex items-center justify-center gap-2 text-xs text-[#6B7A99]">
              <Clock className="w-3.5 h-3.5 text-[#533AFD]" />
              <span>
                QR Code locked • Expires in{' '}
                <span className="font-mono font-bold text-[#0A1B3D]">
                  {Math.floor(secondsRemaining / 60)}:
                  {(secondsRemaining % 60).toString().padStart(2, '0')}
                </span>
              </span>
            </div>

            {/* Success Overlay if payment received */}
            {paymentResult?.status === 'SUCCESS' && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-[#0E9F6E]/10 text-[#0E9F6E] flex items-center justify-center mb-4">
                  <Check className="w-9 h-9" />
                </div>
                <h3 className="text-2xl font-bold text-[#0A1B3D]">
                  ₹{(paymentResult.amount_received || 400).toFixed(2)} Received!
                </h3>
                <p className="text-xs text-[#0E9F6E] font-semibold mt-1">
                  Payment Verified via Paytm Webhook • Soundbox Chime Triggered
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="h-10 px-5 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Proceed to Udhari & WhatsApp Recovery</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Shortfall Alert Overlay if spoofed */}
            {paymentResult?.status === 'SHORTFALL_ALERT' && (
              <div className="absolute inset-0 bg-rose-50/95 backdrop-blur-xs border-2 border-rose-500 rounded-[6px] flex flex-col items-center justify-center p-6 animate-in fade-in duration-150">
                <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center mb-3 shadow-md animate-bounce">
                  <AlertTriangle className="w-9 h-9" />
                </div>
                <h3 className="text-xl font-bold text-rose-800">
                  ⚠️ SHORT PAYMENT SPOOF DETECTED!
                </h3>
                <p className="text-xs text-rose-700 mt-1 max-w-md">
                  Customer only paid ₹{paymentResult.amount_received.toFixed(2)} instead of ₹
                  {paymentResult.amount_expected.toFixed(2)}. Deficit of ₹
                  {paymentResult.deficit.toFixed(2)} flagged on Soundbox!
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setPaymentResult(null)}
                    className="h-10 px-5 rounded-[4px] bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Dismiss Alert & Re-scan</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Webhook Payment Simulation Controls */}
          <div className="bg-[#F8FAFC] rounded-[6px] border border-[#E6EAF5] p-5">
            <span className="block text-xs font-bold text-[#0A1B3D] mb-1">
              Simulate Customer UPI Payment:
            </span>
            <p className="text-xs text-[#6B7A99] mb-4">
              Test how the merchant counter and audio Soundbox react to real webhook callbacks:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Correct Payment Button */}
              <button
                type="button"
                onClick={() =>
                  handleSimulatePayment(activeInvoice?.upi_due || parsedData?.upi_amount || 400)
                }
                disabled={isSimulatingPayment}
                className="h-12 px-4 rounded-[4px] bg-[#0E9F6E] hover:bg-[#057A55] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  Pay ₹{(activeInvoice?.upi_due || parsedData?.upi_amount || 400).toFixed(2)} (Full Match)
                </span>
              </button>

              {/* Spoof Test Button */}
              <button
                type="button"
                onClick={() => handleSimulatePayment(40)}
                disabled={isSimulatingPayment}
                className="h-12 px-4 rounded-[4px] bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Pay ₹40.00 (Test Shortfall Spoof)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 3: UDHARI & WHATSAPP RECOVERY                            */}
      {/* ============================================================== */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7A99]">
              Step 3: Credit Record & WhatsApp Recovery Link
            </span>
            <button
              onClick={handleResetCheckout}
              className="text-xs font-semibold text-[#533AFD] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Start New Checkout</span>
            </button>
          </div>

          {/* Condition: Udhari was extended */}
          {(activeInvoice?.udhari_amount || parsedData?.udhari_amount || 0) > 0 ? (
            <div className="space-y-6">
              {/* Credit Account Card */}
              <div className="bg-white rounded-[6px] border border-[#E6EAF5] p-6 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-[#E6EAF5]">
                  <div>
                    <h3 className="text-base font-bold text-[#0A1B3D]">
                      Store Credit Account Created
                    </h3>
                    <p className="text-xs text-[#6B7A99]">
                      Recorded in merchant bahi-khata ledger for automated WhatsApp recovery
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-[4px] ${
                      isSettled
                        ? 'bg-[#0E9F6E]/10 text-[#0E9F6E]'
                        : reminderSent
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {isSettled ? 'SETTLED ✓' : reminderSent ? 'REMINDER SENT' : 'UNPAID'}
                  </span>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-[#E6EAF5] text-xs">
                  <div>
                    <span className="text-[#6B7A99] block mb-1">Customer</span>
                    <span className="font-bold text-[#0A1B3D]">
                      {activeInvoice?.customer_name || parsedData?.customer_name || 'Ramesh Kumar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7A99] block mb-1">WhatsApp Phone</span>
                    <span className="font-mono text-[#0A1B3D]">
                      +91 {activeInvoice?.customer_phone || parsedData?.customer_phone || '9876543210'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7A99] block mb-1">Amount Due</span>
                    <span className="font-bold text-amber-600 text-sm">
                      ₹{(activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7A99] block mb-1">Due Date</span>
                    <span className="font-semibold text-[#0A1B3D]">
                      {activeInvoice?.due_date || parsedData?.due_date || 'Monday, 17 Nov 2026'}
                    </span>
                  </div>
                </div>

                {/* WhatsApp Dispatch Action */}
                <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#6B7A99]">
                    <Smartphone className="w-4 h-4 text-[#0E9F6E]" />
                    <span>
                      {reminderSent
                        ? 'WhatsApp reminder link dispatched to customer phone'
                        : 'Dispatch 1-click Paytm payment link via WhatsApp'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendReminder}
                    disabled={isSendingReminder || reminderSent}
                    className="h-10 px-4 rounded-[4px] bg-[#0E9F6E] hover:bg-[#057A55] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{reminderSent ? 'Link Dispatched ✓' : 'Send WhatsApp Payment Link'}</span>
                  </button>
                </div>
              </div>

              {/* Realistic WhatsApp Chat Bubble Preview */}
              <div className="bg-[#EFEAE2] rounded-[6px] border border-[#E6EAF5] p-5 shadow-xs">
                {/* Note */}
                <div className="text-[11px] text-[#6B7A99] mb-3 flex items-center gap-1.5 font-medium">
                  <span>🔌</span>
                  <span>Connect WhatsApp Cloud API to send live messages → currently simulated</span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="max-w-md bg-white rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px] p-4 shadow-sm border border-black/5 text-xs">
                  <div className="font-bold text-[#0A1B3D] text-[13px] mb-1">
                    Sri Lakshmi Stores
                  </div>
                  <p className="text-[#0A1B3D] leading-relaxed whitespace-pre-line">
                    {`Namaste ${activeInvoice?.customer_name || 'Ramesh'} ji! 🛒\n\nAapka ₹${(activeInvoice?.udhari_amount || 250).toFixed(2)} ka udhari bill due hai Sri Lakshmi Stores par.\n📅 Due Date: ${activeInvoice?.due_date || '17 Nov 2026'}\n\nKripya niche diye gaye Paytm link se 1-click payment karein:`}
                  </p>

                  {/* Payment link box */}
                  <div className="mt-3 p-2.5 bg-[#533AFD]/5 border border-[#533AFD]/20 rounded-[4px] flex items-center justify-between">
                    <div>
                      <span className="block font-bold text-[#533AFD] text-[11px]">Paytm Instant Pay</span>
                      <span className="text-[10px] text-[#6B7A99] font-mono">
                        paytm.me/pay/udh-001
                      </span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#533AFD]" />
                  </div>

                  <div className="text-right text-[10px] text-[#6B7A99] mt-2">
                    12:45 PM • Read ✓✓
                  </div>
                </div>

                {/* Settle Simulator */}
                <div className="mt-5 pt-4 border-t border-[#0A1B3D]/10 flex items-center justify-between">
                  <span className="text-xs text-[#0A1B3D] font-medium">
                    Simulate customer clicking the WhatsApp link & paying:
                  </span>
                  <button
                    type="button"
                    onClick={handleSettleUdhari}
                    disabled={isSettled || isSettling}
                    className="h-10 px-5 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSettled
                        ? 'Payment Reconciled (Settled ✓)'
                        : `Simulate Customer Payment (₹${(activeInvoice?.udhari_amount || 250).toFixed(2)})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Condition: Pure UPI checkout (zero udhari) */
            <div className="bg-white rounded-[6px] border border-[#E6EAF5] p-8 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#0E9F6E]/10 text-[#0E9F6E] flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0A1B3D]">
                Transaction Complete ✓
              </h3>
              <p className="text-xs text-[#6B7A99] mt-1 max-w-sm mx-auto">
                Full payment was settled directly via UPI to your bank account. No store credit was extended for this checkout.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleResetCheckout}
                  className="h-10 px-6 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Start New Checkout (+)
                </button>
              </div>
            </div>
          )}

          {/* Reset button at bottom */}
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={handleResetCheckout}
              className="h-12 px-8 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white font-semibold text-sm flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start Next Customer Checkout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
