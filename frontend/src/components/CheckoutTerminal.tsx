'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Clock,
  RotateCcw,
  Upload,
  Send,
  ShieldCheck,
  User,
  CheckCircle2,
  ExternalLink,
  Volume2,
  Smartphone,
  ShieldAlert,
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
  transcribeAudioRecording,
  createCounterInvoice,
  triggerPaytmWebhook,
  sendUdhariReminder,
  reconcileUdhariPayment,
  analyzeDistributorInvoice,
  sendPurchaseOrder,
} from '@/lib/api';
import { playPaytmChime, playAlertSiren, speakAnnouncement } from '@/lib/audio';

type TerminalStep = 1 | 2 | 3 | 4;

export const CheckoutTerminal: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<TerminalStep>(1);

  // Step 1: Voice Input & Intent Split
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string>('');
  const [parsedData, setParsedData] = useState<VoiceParseData | null>(null);

  // Audio Recording Refs for real microphone capture
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Step 2: Dynamic QR & Dual-Screen Soundbox
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>('400.00');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [paymentResult, setPaymentResult] = useState<WebhookResponse | null>(null);

  // Step 3: Partial Udhari Recovery
  const [reminderSent, setReminderSent] = useState<boolean>(false);
  const [isSendingReminder, setIsSendingReminder] = useState<boolean>(false);
  const [isSettlingCredit, setIsSettlingCredit] = useState<boolean>(false);
  const [isCreditSettled, setIsCreditSettled] = useState<boolean>(false);

  // Step 4: WhatsApp Snap-to-Restock Agent
  const [billFile, setBillFile] = useState<File | null>(null);
  const [isAnalyzingBill, setIsAnalyzingBill] = useState<boolean>(false);
  const [billAnalysis, setBillAnalysis] = useState<InvoiceAnalysisResponse | null>(null);
  const [showPOPreview, setShowPOPreview] = useState<boolean>(false);
  const [isSendingPO, setIsSendingPO] = useState<boolean>(false);
  const [poResult, setPoResult] = useState<RestockOrderResponse | null>(null);

  // Countdown timer for Step 2
  useEffect(() => {
    if (currentStep !== 2 || paymentResult?.status === 'SUCCESS') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, paymentResult]);

  // Execute voice or typed command
  const executeCommand = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessingVoice(true);
    setVoiceStatusText('Analyzing split bill with Groq...');
    setPaymentResult(null);
    try {
      const res = await parseVoiceCommand(text);
      if (res.data) {
        setParsedData(res.data);
        setReceivedAmountInput(res.data.upi_amount.toFixed(2));
      }
    } catch (err) {
      console.warn('Voice parse failed:', err);
    } finally {
      setIsProcessingVoice(false);
      setVoiceStatusText('');
    }
  };

  // Push-to-Talk Mic: Real Audio MediaRecorder + Groq Whisper
  const handleToggleMic = async () => {
    if (isListening) {
      // User tapped to finish recording
      setIsListening(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      setVoiceStatusText('Accessing microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size > 200) {
          setIsProcessingVoice(true);
          setVoiceStatusText('Transcribing speech with Groq Whisper...');
          try {
            const res = await transcribeAudioRecording(audioBlob);
            if (res.transcript) {
              setTranscript(res.transcript);
            }
            if (res.data) {
              setParsedData(res.data);
              setReceivedAmountInput(res.data.upi_amount.toFixed(2));
            }
          } catch (err) {
            console.warn('Audio transcription error:', err);
            // If server whisper fails, try parsing existing text
            if (transcript.trim()) {
              executeCommand(transcript);
            }
          } finally {
            setIsProcessingVoice(false);
            setVoiceStatusText('');
          }
        }
      };

      mediaRecorder.start(200);
      setIsListening(true);
      setVoiceStatusText('Listening... Speak customer name, UPI amount, and udhari');
    } catch (err) {
      console.warn('Microphone permission or hardware error:', err);
      // Fallback: Web Speech API
      runClientSpeechRecognition();
    }
  };

  // Client speech recognition fallback
  const runClientSpeechRecognition = () => {
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

        setIsListening(true);
        setVoiceStatusText('Listening via browser speech engine...');

        recognition.onresult = (event) => {
          const spoken = event.results[0][0].transcript;
          setTranscript(spoken);
          setIsListening(false);
          setVoiceStatusText('');
          executeCommand(spoken);
        };

        recognition.onerror = () => {
          setIsListening(false);
          setVoiceStatusText('Speech input timed out. You can also type below.');
        };
        recognition.onend = () => setIsListening(false);

        recognition.start();
        return;
      } catch {
        // Fallback below
      }
    }

    setVoiceStatusText('Microphone unavailable in this browser. Please type customer bill below.');
  };

  // Step 1 -> Step 2: Create dynamic invoice
  const handleProceedToPayment = async () => {
    const total = parsedData?.total_bill || 650;
    const upi = parsedData?.upi_amount || 400;
    const udhari = parsedData?.udhari_amount || 250;
    const cash = parsedData?.cash_amount || 0;
    const name = parsedData?.customer_name || 'Rahul';
    const phone = parsedData?.customer_phone || '9876543210';
    const due = parsedData?.due_date || 'Monday';

    setIsGeneratingInvoice(true);
    try {
      const invoice = await createCounterInvoice({
        total_bill: total,
        upi_due: upi,
        udhari_amount: udhari,
        cash_received: cash,
        customer_name: name,
        customer_phone: phone,
        due_date: due,
      });

      setActiveInvoice(invoice);
      setSecondsRemaining(180);
      setPaymentResult(null);
      setReceivedAmountInput(invoice.upi_due.toFixed(2));
      setCurrentStep(2);
    } catch (err) {
      console.warn('Invoice generation failed:', err);
      setCurrentStep(2);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Step 2: Trigger Payment Webhook Simulation (Simulates buyer phone payment)
  const handleTriggerWebhook = async (amount: number) => {
    const invId = activeInvoice?.invoice_id || 'INV-2026-001';
    setIsVerifyingPayment(true);

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
      } else {
        playAlertSiren();
        speakAnnouncement(
          res.voice_alert || `Savdhaan! Keval ₹${amount} prapt hue hain! ₹${res.deficit} baaki hai!`,
          'hi'
        );
      }
    } catch (err) {
      console.warn('Payment verification error:', err);
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  // Step 3: Open in WhatsApp directly (No merchant account needed)
  const handleOpenCustomerWhatsApp = async () => {
    const phone = activeInvoice?.customer_phone || parsedData?.customer_phone || '9876543210';
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const name = activeInvoice?.customer_name || parsedData?.customer_name || 'Ramesh';
    const amt = (activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250).toFixed(2);
    const dueDate = activeInvoice?.due_date || parsedData?.due_date || 'Monday';
    const link = `https://p.paytm.me/pay?id=${activeInvoice?.udhari_id || 'credit-001'}&am=${amt}`;

    const message = `Dear ${name},\n\nYour partial udhari balance of ₹${amt} at Store Counter is scheduled for payment on ${dueDate}.\n\nPlease complete your payment using this direct Paytm link:\n${link}\n\nThank you.`;

    if (typeof window !== 'undefined') {
      const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    setIsSendingReminder(true);
    try {
      const udhId = activeInvoice?.udhari_id || 'udh-001';
      await sendUdhariReminder(udhId);
      setReminderSent(true);
    } catch {
      setReminderSent(true);
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Step 3: Confirm Settlement of Store Credit
  const handleConfirmSettlement = async () => {
    setIsSettlingCredit(true);
    try {
      const udhId = activeInvoice?.udhari_id || 'udh-001';
      const amt = activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250;
      await reconcileUdhariPayment(udhId, amt);
      setIsCreditSettled(true);
      playPaytmChime();
      speakAnnouncement(`Paytm bhugtan ₹${amt} safal hua`, 'hi');
    } catch {
      setIsCreditSettled(true);
    } finally {
      setIsSettlingCredit(false);
    }
  };

  // Step 4: Analyze Distributor Invoice
  const handleAnalyzeBill = async (sample = false) => {
    setIsAnalyzingBill(true);
    setPoResult(null);
    try {
      const res = await analyzeDistributorInvoice(sample ? null : billFile);
      setBillAnalysis(res);
      setShowPOPreview(false);
    } catch (err) {
      console.warn('Bill analysis error:', err);
    } finally {
      setIsAnalyzingBill(false);
    }
  };

  // Step 4: Dispatch PO via WhatsApp directly (No merchant account needed)
  const handleOpenDistributorWhatsApp = async () => {
    if (!billAnalysis?.draft_po) return;
    const po = billAnalysis.draft_po;
    const phone = po.supplier_phone || '9876543210';
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const itemsLines = po.items.map(
      (it, idx) => `${idx + 1}. ${it.sku} - ${it.quantity} units @ ₹${it.expected_rate.toFixed(2)}`
    );
    const totalEst = po.items.reduce((sum, it) => sum + it.quantity * it.expected_rate, 0);

    const message = `*PURCHASE ORDER: #${po.po_number}*\nTo: ${po.supplier_name}\nFrom: Store Counter\n\nRequired Stock Items:\n${itemsLines.join('\n')}\n\nEstimated Total: ₹${totalEst.toFixed(2)}\nPlease confirm delivery schedule and dispatch invoice.\nThank you.`;

    if (typeof window !== 'undefined') {
      const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    setIsSendingPO(true);
    try {
      const res = await sendPurchaseOrder({
        po_number: po.po_number,
        supplier_name: po.supplier_name,
        supplier_phone: po.supplier_phone,
        items: po.items,
      });
      setPoResult(res);
      playPaytmChime();
    } catch {
      setPoResult({
        success: true,
        message: `Purchase order ${po.po_number} dispatched to WhatsApp`,
        po_number: po.po_number,
        status: 'DISPATCHED_WHATSAPP',
        whatsapp_preview: message,
      });
    } finally {
      setIsSendingPO(false);
    }
  };

  // Reset checkout back to Step 1
  const handleReset = () => {
    setCurrentStep(1);
    setTranscript('');
    setParsedData(null);
    setPaymentResult(null);
    setActiveInvoice(null);
    setReminderSent(false);
    setIsCreditSettled(false);
    setSecondsRemaining(180);
    setReceivedAmountInput('400.00');
  };

  const customerName = activeInvoice?.customer_name || parsedData?.customer_name || 'Rahul';
  const upiDueAmount = activeInvoice?.upi_due || parsedData?.upi_amount || 400;
  const udhariAmount = activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250;
  const dueDateStr = activeInvoice?.due_date || parsedData?.due_date || 'Monday';

  return (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-4">
      {/* Step Indicator Header (ALWAYS CLICKABLE - NEVER BLOCKS THE PRESENTER) */}
      <div className="mb-8 max-w-3xl mx-auto">
        <div className="grid grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            title="Step 1: Voice Checkout"
            className={`h-2.5 rounded-full transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-[#3a3f5c]'
                : currentStep > 1
                ? 'bg-[#0e9f6e]'
                : 'bg-[#e6e6e6]'
            }`}
          />
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            title="Step 2: Soundbox & Spoof Guard"
            className={`h-2.5 rounded-full transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-[#3a3f5c]'
                : currentStep > 2
                ? 'bg-[#0e9f6e]'
                : 'bg-[#e6e6e6]'
            }`}
          />
          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            title="Step 3: Partial Udhari Recovery"
            className={`h-2.5 rounded-full transition-all cursor-pointer ${
              currentStep === 3
                ? 'bg-[#3a3f5c]'
                : currentStep > 3
                ? 'bg-[#0e9f6e]'
                : 'bg-[#e6e6e6]'
            }`}
          />
          <button
            type="button"
            onClick={() => setCurrentStep(4)}
            title="Step 4: Wholesaler Restock Agent"
            className={`h-2.5 rounded-full transition-all cursor-pointer ${
              currentStep === 4 ? 'bg-[#3a3f5c]' : 'bg-[#e6e6e6]'
            }`}
          />
        </div>

        <div className="flex justify-between text-xs sm:text-sm text-[#717171] mt-3 font-medium px-1">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`cursor-pointer ${currentStep === 1 ? 'text-[#3d3d3d] font-bold' : 'hover:text-[#3d3d3d]'}`}
          >
            1. Voice Checkout
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={`cursor-pointer ${currentStep === 2 ? 'text-[#3d3d3d] font-bold' : 'hover:text-[#3d3d3d]'}`}
          >
            2. Soundbox & Spoof Guard
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            className={`cursor-pointer ${currentStep === 3 ? 'text-[#3d3d3d] font-bold' : 'hover:text-[#3d3d3d]'}`}
          >
            3. Partial Udhari Link
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep(4)}
            className={`cursor-pointer ${currentStep === 4 ? 'text-[#3d3d3d] font-bold' : 'hover:text-[#3d3d3d]'}`}
          >
            4. Restock Agent
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* FLOW 1 (STEP 1): VOICE CHECKOUT & SPLIT INTENT                     */}
      {/* ================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-[32px] p-8 sm:p-12 border border-[#e6e6e6] shadow-xs space-y-8 animate-in fade-in duration-200">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#f97316] block mb-1">
              Flow 1: Voice-to-Dynamic-QR & Split Udhari
            </span>
            <h2 className="text-2xl sm:text-3xl font-medium text-[#3d3d3d] tracking-tight">
              Push-to-Talk Counter Checkout
            </h2>
            <p className="text-sm sm:text-base text-[#717171] mt-2">
              Merchant speaks customer bill in English or Hindi to lock UPI QR and credit ledger
            </p>
          </div>

          {/* Centered Push-to-Talk Mic with Live Visual Waves */}
          <div className="text-center py-2">
            <button
              type="button"
              onClick={handleToggleMic}
              disabled={isProcessingVoice}
              className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all mx-auto cursor-pointer shadow-lg ${
                isListening
                  ? 'bg-rose-500 text-white scale-105 animate-pulse ring-8 ring-rose-100'
                  : 'bg-[#3a3f5c] hover:bg-[#2c314a] text-white ring-8 ring-[#3a3f5c]/5 hover:scale-102'
              } disabled:opacity-50`}
            >
              <Mic className="w-12 h-12" />
            </button>

            <span className="block text-sm sm:text-base text-[#3d3d3d] mt-4 font-medium">
              {isListening
                ? 'Recording your voice... Click to finish'
                : isProcessingVoice
                ? 'Transcribing with Groq Whisper & parsing intent...'
                : 'Hold or click microphone to speak bill'}
            </span>

            {isListening && (
              <div className="flex items-center justify-center gap-2 mt-3 h-6">
                <span className="w-2 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.25s' }} />
                <span className="w-2 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.15s' }} />
                <span className="w-2 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.35s' }} />
              </div>
            )}

            {voiceStatusText && (
              <p className="text-xs text-[#717171] mt-2 italic font-mono">{voiceStatusText}</p>
            )}
          </div>

          {/* Input field + Fast Demo Button */}
          <div className="max-w-2xl mx-auto space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeCommand(transcript);
              }}
              className="relative"
            >
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Speak or type: e.g. Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday"
                className="w-full h-14 sm:h-16 pl-6 pr-14 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-sm sm:text-base text-[#3d3d3d] placeholder-[#999999] focus:outline-none focus:border-[#3a3f5c] shadow-2xs font-normal"
              />
              <button
                type="submit"
                disabled={isProcessingVoice || !transcript.trim()}
                title="Parse voice text"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#3a3f5c] text-white flex items-center justify-center hover:bg-[#2c314a] transition-colors cursor-pointer disabled:opacity-30"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Demo Trigger for live hackathon presentations */}
            <div className="flex items-center justify-center gap-2 text-xs text-[#717171]">
              <span>Sample Command:</span>
              <button
                type="button"
                onClick={() => {
                  const cmd = 'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Rahul 9876543210';
                  setTranscript(cmd);
                  executeCommand(cmd);
                }}
                className="text-[#3a3f5c] font-medium hover:underline cursor-pointer"
              >
                &quot;Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday&quot;
              </button>
            </div>
          </div>

          {/* Customer Bill Breakdown Card */}
          {parsedData && (
            <div className="pt-6 border-t border-[#e6e6e6] space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150">
              {/* Customer Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#3a3f5c]/10 text-[#3a3f5c] flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-[#717171] block">Customer</span>
                    <span className="text-lg font-semibold text-[#3d3d3d]">
                      {parsedData.customer_name || 'Rahul'}
                    </span>
                  </div>
                </div>

                {parsedData.udhari_amount > 0 && (
                  <div className="text-right">
                    <span className="text-xs text-[#717171] block">Partial Udhari Promise</span>
                    <span className="text-sm font-semibold text-amber-700">
                      Due: {parsedData.due_date || 'Monday'}
                    </span>
                  </div>
                )}
              </div>

              {/* Amount Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-[#fcfcfc] border border-[#e6e6e6]">
                  <span className="text-xs text-[#717171] block mb-1">Total Bill</span>
                  <span className="text-xl sm:text-2xl font-semibold text-[#3d3d3d]">
                    ₹{parsedData.total_bill.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-[#3a3f5c]/5 border border-[#3a3f5c]/20">
                  <span className="text-xs text-[#3a3f5c] font-semibold block mb-1">UPI Due</span>
                  <span className="text-xl sm:text-2xl font-bold text-[#3a3f5c]">
                    ₹{parsedData.upi_amount.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <span className="text-xs text-amber-800 font-semibold block mb-1">Partial Udhari</span>
                  <span className="text-xl sm:text-2xl font-semibold text-amber-700">
                    ₹{parsedData.udhari_amount.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-[#fcfcfc] border border-[#e6e6e6]">
                  <span className="text-xs text-[#717171] block mb-1">Cash Paid</span>
                  <span className="text-xl sm:text-2xl font-semibold text-[#3d3d3d]">
                    ₹{parsedData.cash_amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-[#717171] hover:underline"
                >
                  Skip to Step 2 →
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={isGeneratingInvoice || isProcessingVoice}
                  className="h-14 px-8 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-medium text-sm sm:text-base flex items-center gap-2.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <span>
                    {isGeneratingInvoice
                      ? 'Displaying Soundbox QR...'
                      : `Lock ₹${parsedData.upi_amount.toFixed(2)} Dynamic QR for ${customerName} →`}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* FLOW 2 (STEP 2): DUAL-SCREEN SOUNDBOX & REAL-TIME SPOOF GUARD     */}
      {/* ================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-[32px] p-8 sm:p-12 border border-[#e6e6e6] shadow-xs space-y-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-sm text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Voice Input</span>
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[#717171]">
              <span>Customer:</span>
              <span className="font-semibold text-[#3a3f5c]">{customerName}</span>
              <span>•</span>
              <span className="font-mono">{activeInvoice?.invoice_id || 'INV-2026-001'}</span>
            </div>
          </div>

          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#f97316] block mb-1">
              Flow 2: Real-Time Mismatch & Spoof Guard
            </span>
            <h2 className="text-2xl sm:text-3xl font-medium text-[#3d3d3d] tracking-tight">
              Paytm Soundbox Counter Screen
            </h2>
            <p className="text-sm text-[#717171] mt-1">
              Amount locked to customer bill • Webhook checks incoming UTR before buyer exits
            </p>
          </div>

          {/* Soundbox Counter Display Box */}
          <div className="max-w-md mx-auto p-6 rounded-3xl bg-[#fcfcfc] border-2 border-[#3a3f5c]/20 shadow-sm text-center relative overflow-hidden">
            {/* Top Soundbox status bar */}
            <div className="flex items-center justify-between text-xs text-[#717171] pb-3 border-b border-[#e6e6e6]">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#3a3f5c]" />
                <span className="font-medium text-[#3a3f5c]">Paytm Soundbox Pro</span>
              </div>
              <span className="font-mono text-[11px] text-[#0e9f6e] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0e9f6e] animate-ping" />
                UTR Webhook Active
              </span>
            </div>

            {/* Amount locked */}
            <div className="py-4">
              <span className="text-xs text-[#717171] block font-medium">
                Amount Locked for {customerName}
              </span>
              <div className="text-5xl sm:text-6xl font-light text-[#3d3d3d] tracking-tight mt-1">
                ₹{upiDueAmount.toFixed(2)}
              </div>
            </div>

            {/* Dynamic QR */}
            <div className="my-3 flex justify-center">
              <QRCodeDisplay
                value={
                  activeInvoice?.qr_data ||
                  `upi://pay?pa=merchant@paytm&pn=StoreCounter&am=${upiDueAmount.toFixed(2)}&cu=INR`
                }
                size={230}
              />
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#717171]">
              <Clock className="w-3.5 h-3.5 text-[#f97316]" />
              <span>
                QR amount locked • Expires in{' '}
                <span className="font-mono font-semibold text-[#3d3d3d]">
                  {Math.floor(secondsRemaining / 60)}:
                  {(secondsRemaining % 60).toString().padStart(2, '0')}
                </span>
              </span>
            </div>
          </div>

          {/* Interactive Webhook Simulator (Simulates Buyer Phone Scenarios) */}
          <div className="pt-4 border-t border-[#e6e6e6] max-w-2xl mx-auto space-y-4">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#717171] flex items-center justify-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#3a3f5c]" />
                Incoming Buyer Payment Simulator (Webhook Trigger)
              </span>
              <p className="text-xs text-[#717171] mt-0.5">
                Test both hackathon scenarios: exact match settlement vs. shortfall spoof attack
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Scenario 1: Exact Match */}
              <button
                type="button"
                onClick={() => handleTriggerWebhook(upiDueAmount)}
                disabled={isVerifyingPayment}
                className="p-5 rounded-2xl border-2 border-[#0e9f6e]/30 bg-[#0e9f6e]/5 hover:bg-[#0e9f6e]/10 text-left transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#0e9f6e] uppercase tracking-wide">
                    Flow 1: Match Payment
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#0e9f6e]" />
                </div>
                <div className="text-lg font-bold text-[#3d3d3d]">
                  Buyer Pays Full ₹{upiDueAmount.toFixed(0)}
                </div>
                <p className="text-xs text-[#717171] mt-1">
                  Incoming webhook matches ₹{upiDueAmount.toFixed(2)}. Soundbox confirms UTR and triggers chime.
                </p>
              </button>

              {/* Scenario 2: Shortfall Spoof */}
              <button
                type="button"
                onClick={() => handleTriggerWebhook(40.0)}
                disabled={isVerifyingPayment}
                className="p-5 rounded-2xl border-2 border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-left transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-wide">
                    Flow 2: Spoof Attack
                  </span>
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-lg font-bold text-rose-900">
                  Buyer Pays Only ₹40
                </div>
                <p className="text-xs text-[#717171] mt-1">
                  Spoof attempt reports ₹40. Soundbox sounds alarm siren and announces deficit before buyer leaves.
                </p>
              </button>
            </div>

            {/* Custom amount test */}
            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs text-[#717171] whitespace-nowrap">Or Custom Webhook:</span>
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-[#717171]">₹</span>
                <input
                  type="text"
                  value={receivedAmountInput}
                  onChange={(e) => setReceivedAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 pl-8 pr-3 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-xs font-mono text-[#3d3d3d]"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTriggerWebhook(parseFloat(receivedAmountInput) || 0)}
                disabled={isVerifyingPayment}
                className="h-10 px-5 rounded-full bg-[#3a3f5c] text-white text-xs font-medium cursor-pointer hover:bg-[#2c314a]"
              >
                Send Webhook
              </button>
            </div>

            {/* Success Banner */}
            {paymentResult?.status === 'SUCCESS' && (
              <div className="p-4 bg-[#0e9f6e]/10 border border-[#0e9f6e]/30 rounded-2xl text-sm text-[#0e9f6e] flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">
                      Paytm UTR Confirmed for {customerName}!
                    </span>
                    <span className="text-xs text-[#0e9f6e]/90">
                      Payment of ₹{paymentResult.amount_received.toFixed(2)} received on Soundbox.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="h-9 px-4 rounded-full bg-[#0e9f6e] text-white text-xs font-semibold cursor-pointer shadow-xs ml-2 hover:bg-[#0e9f6e]/90"
                >
                  Proceed to Step 3 →
                </button>
              </div>
            )}

            {/* Shortfall Alert Banner */}
            {paymentResult?.status === 'SHORTFALL_ALERT' && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-sm text-rose-800 flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold block text-rose-900">
                      Soundbox Alarm Triggered for {customerName}!
                    </span>
                    <span className="text-xs text-rose-700">
                      Expected ₹{paymentResult.amount_expected.toFixed(2)} • Received only ₹{paymentResult.amount_received.toFixed(2)} (Deficit: ₹{paymentResult.deficit.toFixed(2)})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentResult(null)}
                  className="text-xs text-rose-700 underline font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Step Navigation Bar */}
            <div className="flex items-center justify-between pt-6 border-t border-[#f0f0f0]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs sm:text-sm text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Voice Input</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="h-12 px-6 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <span>Proceed to Step 3: Partial Udhari Recovery</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* FLOW 1 COMPLETION (STEP 3): PARTIAL UDHARI RECOVERY LINK          */}
      {/* ================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white rounded-[32px] p-8 sm:p-12 border border-[#e6e6e6] shadow-xs space-y-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-sm text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Soundbox Screen</span>
            </button>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                isCreditSettled
                  ? 'bg-[#0e9f6e]/10 text-[#0e9f6e]'
                  : reminderSent
                  ? 'bg-sky-50 text-sky-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isCreditSettled ? 'Udhari Settled ✓' : reminderSent ? 'WhatsApp Link Sent' : 'Udhari Balance Active'}
            </span>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-[#f97316] block mb-1">
                Flow 1: Scheduled WhatsApp Recovery Link
              </span>
              <h2 className="text-2xl sm:text-3xl font-medium text-[#3d3d3d] tracking-tight">
                Partial Udhari for {customerName}
              </h2>
              <p className="text-sm text-[#717171] mt-1">
                Automated Monday WhatsApp payment reminder with embedded Paytm direct recovery link
              </p>
            </div>

            {/* Credit Details Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-[#e6e6e6] text-center">
              <div>
                <span className="text-xs text-[#717171] block mb-1">Customer</span>
                <span className="text-base font-semibold text-[#3d3d3d]">{customerName}</span>
              </div>
              <div>
                <span className="text-xs text-[#717171] block mb-1">Phone Number</span>
                <span className="text-base font-mono text-[#3d3d3d]">
                  +91 {activeInvoice?.customer_phone || parsedData?.customer_phone || '9876543210'}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#717171] block mb-1">Udhari Due</span>
                <span className="text-base font-bold text-amber-700">
                  ₹{udhariAmount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#717171] block mb-1">Promise Date</span>
                <span className="text-base font-medium text-[#3d3d3d]">
                  {dueDateStr}
                </span>
              </div>
            </div>

            {/* WhatsApp Message Preview */}
            <div className="p-6 rounded-2xl bg-[#fcfcfc] border border-[#e6e6e6] space-y-3">
              <span className="text-xs font-semibold text-[#717171] block">
                Scheduled WhatsApp Reminder Message:
              </span>
              <div className="p-5 rounded-2xl bg-white border border-[#e6e6e6] text-sm text-[#3d3d3d] space-y-2">
                <p className="font-medium">
                  Dear {customerName},
                </p>
                <p className="text-xs text-[#717171] leading-relaxed">
                  Your partial udhari balance of <strong>₹{udhariAmount.toFixed(2)}</strong> at Store Counter is scheduled for payment on <strong>{dueDateStr}</strong>.
                </p>
                <p className="text-xs text-[#717171]">
                  Please complete your payment using this direct link:
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-2 rounded-full bg-[#3a3f5c] text-white text-xs font-medium font-mono">
                    Pay Now: https://p.paytm.me/pay?id={activeInvoice?.udhari_id || 'credit-001'}&am={udhariAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenCustomerWhatsApp}
                disabled={isSendingReminder}
                className="h-12 px-6 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>{reminderSent ? 'Open in WhatsApp Again' : 'Send via WhatsApp'}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmSettlement}
                  disabled={isSettlingCredit || isCreditSettled}
                  className={`h-12 px-6 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                    isCreditSettled
                      ? 'bg-[#0e9f6e] text-white'
                      : 'bg-[#3a3f5c] hover:bg-[#2c314a] text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isCreditSettled ? 'Udhari Settled ✓' : 'Confirm Payment Received'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="h-12 px-4 rounded-full border border-[#e6e6e6] hover:bg-gray-50 text-xs sm:text-sm text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Forward navigation to Step 4 */}
            <div className="flex items-center justify-end pt-4 border-t border-[#f0f0f0]">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="h-12 px-6 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <span>Proceed to Step 4: WhatsApp Restock Agent</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* FLOW 3 (STEP 4): WHATSAPP SNAP-TO-RESTOCK AGENT & WHOLESALE OCR   */}
      {/* ================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white rounded-[32px] p-8 sm:p-12 border border-[#e6e6e6] shadow-xs space-y-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="text-sm text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Udhari Recovery</span>
            </button>
            <span className="text-xs font-medium text-[#717171]">Flow 3: Wholesaler Invoice OCR</span>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-[#f97316] block mb-1">
                Flow 3: WhatsApp Snap-to-Restock Agent
              </span>
              <h2 className="text-2xl sm:text-3xl font-medium text-[#3d3d3d] tracking-tight">
                Distributor Invoice Scanner & Restock
              </h2>
              <p className="text-sm text-[#717171] mt-1">
                Merchant photographs distributor paper bill on WhatsApp. Vision OCR flags price hikes and drafts reorders.
              </p>
            </div>

            {/* Upload Area */}
            <div className="p-8 border-2 border-dashed border-[#e6e6e6] rounded-[24px] text-center bg-[#fcfcfc] hover:bg-white transition-colors">
              <Upload className="w-8 h-8 text-[#717171] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#3d3d3d]">
                {billFile ? billFile.name : 'Upload paper invoice photo or delivery receipt'}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <label className="h-10 px-5 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setBillFile(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleAnalyzeBill(true)}
                  disabled={isAnalyzingBill}
                  className="h-10 px-5 rounded-full border border-[#e6e6e6] hover:bg-gray-50 text-xs font-medium text-[#3d3d3d] cursor-pointer"
                >
                  {isAnalyzingBill ? 'Analyzing with Gemini Vision...' : 'Load Sample Wholesaler Bill'}
                </button>
              </div>
            </div>

            {/* Extracted Analysis & Price Hike Warning */}
            {billAnalysis && (
              <div className="space-y-4 pt-4 border-t border-[#e6e6e6]">
                <div className="flex items-center justify-between text-xs sm:text-sm text-[#717171]">
                  <span>Vendor: <strong className="text-[#3d3d3d]">{billAnalysis.vendor_name}</strong></span>
                  <span>Invoice: <strong className="font-mono text-[#3d3d3d]">{billAnalysis.invoice_no}</strong></span>
                </div>

                {/* Price Hike Alert Banner */}
                {billAnalysis.price_hikes && billAnalysis.price_hikes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Supplier Price Increase Detected:</span>
                      {billAnalysis.price_hikes.map((hike, idx) => (
                        <p key={idx} className="mt-0.5 text-xs">
                          {hike.sku}: increased from ₹{hike.previous_rate} to ₹{hike.unit_rate} (+{hike.hike_percentage}%)
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <div className="border border-[#e6e6e6] rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#fcfcfc] border-b border-[#e6e6e6] text-[#717171]">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Item Description</th>
                        <th className="py-2.5 px-4 font-medium text-center">Qty</th>
                        <th className="py-2.5 px-4 font-medium text-right">Unit Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {billAnalysis.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-4 text-[#3d3d3d]">{item.sku}</td>
                          <td className="py-2.5 px-4 text-center text-[#717171]">{item.quantity}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-[#3d3d3d]">
                            ₹{item.unit_rate.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PO Draft & WhatsApp Dispatch */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPOPreview(!showPOPreview)}
                    className="text-xs text-[#3a3f5c] hover:underline font-medium cursor-pointer"
                  >
                    {showPOPreview ? 'Hide PO Preview' : 'Review Draft Reorder PO'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenDistributorWhatsApp}
                    disabled={isSendingPO}
                    className="h-12 px-7 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                    <span>{poResult ? 'Open in WhatsApp Again' : 'Dispatch PO via WhatsApp'}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </div>

                {showPOPreview && billAnalysis.draft_po && (
                  <div className="p-4 rounded-xl bg-[#fcfcfc] border border-[#e6e6e6] text-xs font-mono text-[#3d3d3d] space-y-1">
                    <p className="font-semibold">PURCHASE ORDER: #{billAnalysis.draft_po.po_number}</p>
                    <p>To: {billAnalysis.draft_po.supplier_name}</p>
                    <p>Phone: +91 {billAnalysis.draft_po.supplier_phone || '9876543210'}</p>
                    <div className="py-1">
                      {billAnalysis.draft_po.items.map((it, i) => (
                        <p key={i}>• {it.quantity}x {it.sku} @ ₹{it.expected_rate}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reset to Step 1 */}
            <div className="flex items-center justify-between pt-6 border-t border-[#f0f0f0]">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs sm:text-sm text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Step 3</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="h-12 px-6 rounded-full border border-[#e6e6e6] hover:bg-gray-50 text-[#3d3d3d] text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Start New Customer Bill (Step 1)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
