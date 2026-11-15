'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Clock,
  RotateCcw,
  Upload,
  Send,
  User,
  CheckCircle2,
  ExternalLink,
  FileText,
  CreditCard,
  Package,
  Volume2,
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
  checkPaytmPaymentStatus,
  analyzeDistributorInvoice,
  sendPurchaseOrder,
} from '@/lib/api';
import { playPaytmChime, playAlertSiren, speakAnnouncement } from '@/lib/audio';

type TerminalStep = 1 | 2 | 3 | 4;

const formatDueDate = (dateValue?: string) => {
  if (!dateValue) return 'Not specified';
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) return dateValue;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
};

export const CheckoutTerminal: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<TerminalStep>(1);

  // Step 1: Voice Input & Intent Split (starts clean, not predefined)
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string>('');
  const [parsedData, setParsedData] = useState<VoiceParseData | null>(null);

  // Audio Recording Refs for real microphone capture
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Step 2: Dynamic QR & Payment Verification
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [paymentResult, setPaymentResult] = useState<WebhookResponse | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string>('');
  const [flowError, setFlowError] = useState<string>('');

  // Step 3: Credit Recovery
  const [reminderSent, setReminderSent] = useState<boolean>(false);

  // Step 4: Restock & Price Audit
  const [billFile, setBillFile] = useState<File | null>(null);
  const [isAnalyzingBill, setIsAnalyzingBill] = useState<boolean>(false);
  const [billAnalysis, setBillAnalysis] = useState<InvoiceAnalysisResponse | null>(null);
  const [showPOPreview, setShowPOPreview] = useState<boolean>(false);
  const [isSendingPO, setIsSendingPO] = useState<boolean>(false);
  const [poResult, setPoResult] = useState<RestockOrderResponse | null>(null);
  const [restockError, setRestockError] = useState<string>('');
  const [supplierPhoneInput, setSupplierPhoneInput] = useState<string>('');
  const [billFilePreviewUrl, setBillFilePreviewUrl] = useState<string>('');

  useEffect(() => {
    if (!billFile || !billFile.type.startsWith('image/')) {
      setBillFilePreviewUrl('');
      return;
    }
    const previewUrl = URL.createObjectURL(billFile);
    setBillFilePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [billFile]);

  // Countdown timer for Step 2
  useEffect(() => {
    if (currentStep !== 2 || activeInvoice?.payment_mode !== 'PAYTM_DYNAMIC_QR' || paymentResult?.status === 'SUCCESS') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, activeInvoice?.payment_mode, paymentResult]);

  // Execute voice or typed command
  const executeCommand = async (text: string) => {
    if (!text.trim()) return;
    setActiveInvoice(null);
    setParsedData(null);
    setReminderSent(false);
    setPaymentResult(null);
    setPaymentStatusMessage('');
    setIsProcessingVoice(true);
    setVoiceStatusText('Vani is parsing the customer, amounts, and due date…');
    setFlowError('');
    setPaymentResult(null);
    try {
      const res = await parseVoiceCommand(text);
      setTranscript(res.transcript || text);
      if (res.data && res.data.total_bill > 0 && (res.data.upi_amount + res.data.udhari_amount + res.data.cash_amount) > 0) {
        setParsedData(res.data);
        setVoiceStatusText(`Parsed ${res.data.customer_name || 'customer'}’s ₹${res.data.total_bill.toFixed(2)} bill. Review the details, then lock the QR.`);
      } else {
        setParsedData(null);
        setVoiceStatusText(`I heard “${res.transcript || text}” but couldn't identify a complete bill split. Edit the command and try again.`);
      }
    } catch (err) {
      console.warn('Voice parse failed:', err);
      setFlowError(err instanceof Error ? err.message : 'Voice parsing failed');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Push-to-Talk Mic with Groq Whisper audio recording & SpeechRecognition
  const handleToggleMic = async () => {
    if (isListening) {
      setIsListening(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    setActiveInvoice(null);
    setParsedData(null);
    setPaymentResult(null);
    setPaymentStatusMessage('');
    setReminderSent(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size > 100) {
          setIsProcessingVoice(true);
          setVoiceStatusText('Vani is transcribing your recording…');
          try {
            const res = await transcribeAudioRecording(audioBlob);
            if (res.transcript) {
              setTranscript(res.transcript);
            }
            if (res.data && res.data.total_bill > 0 && (res.data.upi_amount + res.data.udhari_amount + res.data.cash_amount) > 0) {
              setParsedData(res.data);
              setVoiceStatusText(`Parsed ${res.data.customer_name || 'customer'}’s ₹${res.data.total_bill.toFixed(2)} bill. Review the details, then lock the QR.`);
            } else if (res.transcript) {
              setParsedData(null);
              setVoiceStatusText(`I heard “${res.transcript}” but couldn't identify a complete bill split. Edit the command and try again.`);
            }
          } catch (error) {
            setFlowError(error instanceof Error ? error.message : 'Audio transcription failed');
            setVoiceStatusText('Could not transcribe the recording. You can type what you said and retry.');
          } finally {
            setIsProcessingVoice(false);
          }
        }
      };

      mediaRecorder.start(200);
      setIsListening(true);
      setVoiceStatusText('Listening... Speak customer name, UPI amount, and credit');
    } catch {
      setIsListening(false);
      setVoiceStatusText('Microphone access is blocked. Allow microphone access or enter the bill below.');
    }
  };

  // Step 1 -> Step 2: Create dynamic invoice
  const handleProceedToQR = async () => {
    if (!parsedData || parsedData.total_bill <= 0) {
      setFlowError('Parse a bill before creating a payment QR.');
      setCurrentStep(1);
      return;
    }
    const splitTotal = parsedData.upi_amount + parsedData.udhari_amount + parsedData.cash_amount;
    if (parsedData.upi_amount <= 0 || Math.abs(splitTotal - parsedData.total_bill) > 0.01) {
      setFlowError(`The UPI, credit, and cash split must add up to ₹${parsedData.total_bill.toFixed(2)}, with a positive UPI amount.`);
      setCurrentStep(1);
      return;
    }
    if (parsedData.udhari_amount > 0 && !parsedData.customer_name?.trim()) {
      setFlowError('Add the customer name before creating a store-credit balance.');
      setCurrentStep(1);
      return;
    }
    const total = parsedData.total_bill;
    const upi = parsedData.upi_amount;
    const udhari = parsedData.udhari_amount;
    const name = parsedData.customer_name;
    const phone = parsedData.customer_phone;
    const due = parsedData.due_date;

    setIsGeneratingInvoice(true);
    try {
      const invoice = await createCounterInvoice({
        total_bill: total,
        upi_due: upi,
        udhari_amount: udhari,
        customer_name: name,
        customer_phone: phone,
        due_date: due,
      });

      setActiveInvoice(invoice);
      setSecondsRemaining(180);
      setPaymentResult(null);
      setReminderSent(false);
      setPaymentStatusMessage('');
      setFlowError('');
      setCurrentStep(2);
    } catch (err) {
      console.warn('Invoice generation error:', err);
      setFlowError(err instanceof Error ? err.message : 'Could not create this invoice');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Step 2: Verify through the configured Paytm payment gateway.
  const handleVerifyPayment = async () => {
    if (!activeInvoice) return;
    if (activeInvoice.payment_mode !== 'PAYTM_DYNAMIC_QR') {
      setPaymentStatusMessage('Payment verification is unavailable because this merchant has no Paytm Dynamic QR connection configured.');
      return;
    }
    const invId = activeInvoice.invoice_id;
    setPaymentResult(null);
    setPaymentStatusMessage('Checking Paytm status…');
    setIsVerifyingPayment(true);

    try {
      const status = await checkPaytmPaymentStatus(invId);
      if (status.status !== 'COMPLETED' && status.status !== 'SHORT_PAYMENT') {
        setPaymentStatusMessage(`Paytm reports ${status.status}. The bill remains open while Vani checks again.`);
        return;
      }
      const matched = status.status === 'COMPLETED';
      const res: WebhookResponse = {
        status: matched ? 'SUCCESS' : 'SHORTFALL_ALERT',
        alert_type: matched ? 'PAYMENT_SUCCESS' : 'SHORT_PAYMENT',
        invoice_id: invId,
        amount_received: status.amount_received,
        amount_expected: status.amount_expected,
        deficit: status.deficit || 0,
        message: matched ? 'Paytm confirmed the payment.' : 'Paytm confirmed a payment mismatch.',
        voice_alert: matched ? `Paytm par ₹${status.amount_received} prapt hue` : `Savdhaan! ₹${status.deficit} baaki hai!`,
      };

      setPaymentResult(res);

      if (res.status === 'SUCCESS') {
        playPaytmChime();
        speakAnnouncement(res.voice_alert || `₹${res.amount_received} payment matched`, 'hi');
      } else {
        playAlertSiren();
        speakAnnouncement(
          res.voice_alert || `Savdhaan! Keval ₹${res.amount_received} prapt hue hain! ₹${res.deficit} baaki hai!`,
          'hi'
        );
      }
    } catch (err) {
      console.warn('Payment verification error:', err);
      setPaymentStatusMessage(err instanceof Error ? err.message : 'Payment could not be verified');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  useEffect(() => {
    if (currentStep !== 2 || activeInvoice?.payment_mode !== 'PAYTM_DYNAMIC_QR') return;
    if (paymentResult?.status === 'SUCCESS' || paymentResult?.status === 'SHORTFALL_ALERT') return;
    const timer = window.setInterval(() => {
      if (!isVerifyingPayment) void handleVerifyPayment();
    }, 7000);
    return () => window.clearInterval(timer);
  }, [currentStep, activeInvoice?.invoice_id, activeInvoice?.payment_mode, isVerifyingPayment, paymentResult?.status]);

  // Step 3: Prepare a WhatsApp reminder without inventing a payment link.
  const handleOpenCustomerWhatsApp = async () => {
    if (!activeInvoice || activeInvoice.udhari_amount <= 0 || !activeInvoice.udhari_id) {
      setFlowError('This invoice has no store-credit balance to recover.');
      return;
    }
    const phone = activeInvoice.customer_phone || '';
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFlowError('Add the customer phone number to the bill before preparing a WhatsApp reminder.');
      return;
    }
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const name = activeInvoice.customer_name || parsedData?.customer_name || 'Customer';
    const amt = activeInvoice.udhari_amount.toFixed(2);
    const dueDate = activeInvoice.due_date ? formatDueDate(activeInvoice.due_date) : 'the agreed date';
    const message = `Dear ${name},\n\nYour store credit balance of ₹${amt} at Store Counter is scheduled for payment on ${dueDate}. Please contact the store to complete payment.\n\nThank you.`;

    if (typeof window !== 'undefined') {
      const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    setFlowError('');
    setReminderSent(true);
  };

  // Step 4: Analyze Distributor Invoice
  const handleAnalyzeBill = async () => {
    setIsAnalyzingBill(true);
    setPoResult(null);
    setRestockError('');
    setBillAnalysis(null);
    try {
      if (!billFile) throw new Error('Choose a distributor invoice photo or PDF first.');
      const res = await analyzeDistributorInvoice(billFile);
      setBillAnalysis(res);
      setSupplierPhoneInput(res.draft_po.supplier_phone || '');
      setShowPOPreview(true);
    } catch (err) {
      console.warn('Bill analysis error:', err);
      setBillAnalysis(null);
      setRestockError(err instanceof Error ? err.message : 'Invoice analysis failed');
    } finally {
      setIsAnalyzingBill(false);
    }
  };

  // Step 4: Dispatch PO via WhatsApp directly (No merchant account needed)
  const handleOpenDistributorWhatsApp = async () => {
    if (!billAnalysis?.draft_po) return;
    const po = billAnalysis.draft_po;
    const phone = supplierPhoneInput || po.supplier_phone;
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setRestockError('No supplier phone was found. Enter a valid supplier WhatsApp number to prepare the order.');
      return;
    }
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
    setRestockError('');
    try {
      const res = await sendPurchaseOrder({
        po_number: po.po_number,
        supplier_name: po.supplier_name,
        supplier_phone: phone,
        items: po.items,
      });
      setPoResult(res);
    } catch (err) {
      setRestockError(err instanceof Error ? err.message : 'Could not prepare the purchase order');
    } finally {
      setIsSendingPO(false);
    }
  };

  // Reset checkout back to Step 1
  const handleReset = () => {
    setCurrentStep(1);
    setTranscript('');
    setParsedData(null);
    setActiveInvoice(null);
    setPaymentResult(null);
    setReminderSent(false);
    setSecondsRemaining(180);
    setPaymentStatusMessage('');
    setFlowError('');
    setBillFile(null);
    setBillAnalysis(null);
    setPoResult(null);
    setRestockError('');
  };

  const customerName = activeInvoice?.customer_name || parsedData?.customer_name || 'Customer name not captured';
  const customerPhone = activeInvoice?.customer_phone || parsedData?.customer_phone || '';
  const upiDue = activeInvoice?.upi_due ?? parsedData?.upi_amount ?? 0;
  const udhariDue = activeInvoice?.udhari_amount ?? parsedData?.udhari_amount ?? 0;
  const dueDate = formatDueDate(activeInvoice?.due_date || parsedData?.due_date);

  // Handler for navigation tabs ensuring data availability
  const handleTabClick = (step: TerminalStep) => {
    if ((step === 2 || step === 3) && !activeInvoice) {
      setCurrentStep(1);
      setFlowError('Parse the bill and lock its QR before opening payment or credit recovery.');
      return;
    }
    if (step === 3 && (!activeInvoice?.udhari_id || activeInvoice.udhari_amount <= 0)) {
      setFlowError('This invoice has no store-credit balance to recover.');
      return;
    }
    setCurrentStep(step);
  };

  return (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
      {/* Physical Soundbox concept: a live device display driven by the active flow state. */}
      <section className="grid md:grid-cols-[0.9fr_1.1fr] gap-5 items-center rounded-[2rem] border border-slate-700/70 bg-gradient-to-br from-[#101923] via-[#182430] to-[#0d131a] p-5 sm:p-7 text-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.75)] overflow-hidden">
        <div className="mx-auto w-full max-w-[310px]" style={{ perspective: '900px' }}>
          <div className="relative rounded-[2rem] border border-slate-500/70 bg-gradient-to-br from-[#394650] via-[#202b34] to-[#121a21] p-4 shadow-[inset_0_2px_2px_rgba(255,255,255,0.16),0_22px_35px_rgba(0,0,0,0.52)]" style={{ transform: 'rotateY(-7deg) rotateX(2deg)' }}>
              <div className="flex items-center justify-between px-1 pb-3">
              <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00baf2] text-[10px] font-black text-white">P</span><span className="text-[10px] font-bold tracking-[0.22em] text-slate-200">PAYTM SOUND BOX</span></div>
            </div>
            <div className="rounded-xl border border-cyan-300/20 bg-[#05151b] px-4 py-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.8)]">
              <div className="mb-2 text-[9px] uppercase tracking-[0.16em] text-cyan-200/70">{paymentResult?.status === 'SHORTFALL_ALERT' ? 'Payment mismatch' : paymentResult?.status === 'SUCCESS' ? 'Payment matched' : currentStep === 4 ? 'Invoice audit' : currentStep === 3 ? 'Credit recovery' : currentStep === 2 ? 'Payment expected' : 'Counter ready'}</div>
              <div className={`font-mono text-3xl font-bold tracking-tight ${paymentResult?.status === 'SHORTFALL_ALERT' ? 'text-rose-300' : paymentResult?.status === 'SUCCESS' ? 'text-emerald-300' : 'text-cyan-100'}`}>
                {currentStep === 4 ? `${billAnalysis?.items.length || 0} LINES` : currentStep === 3 ? `₹${udhariDue.toFixed(2)}` : currentStep === 2 ? `₹${upiDue.toFixed(2)}` : parsedData ? `₹${parsedData.total_bill.toFixed(2)}` : 'READY'}
              </div>
              <div className="mt-1 truncate text-[10px] text-cyan-100/55">{currentStep === 4 ? billAnalysis?.vendor_name || 'Scan supplier delivery bill' : currentStep === 1 && !parsedData ? 'Speak or enter the customer bill' : `${customerName} · ${currentStep === 3 ? 'store credit due' : 'counter transaction'}`}</div>
            </div>
            <div className="mx-auto mt-4 grid w-4/5 grid-cols-12 gap-1" aria-label="Soundbox speaker grille">
              {Array.from({ length: 48 }, (_, index) => <span key={index} className="h-1 rounded-full bg-slate-600/80 shadow-[inset_0_1px_1px_rgba(0,0,0,0.8)]" />)}
            </div>
            <div className="mt-4 flex items-center justify-between px-1"><span className="flex items-center gap-1.5 text-[9px] text-slate-400"><Volume2 className="h-3.5 w-3.5" /> VOICE ALERTS</span><span className="h-2 w-2 rounded-full bg-[#00baf2] shadow-[0_0_9px_#00baf2]" /></div>
            <div className="absolute -right-2 top-1/2 h-9 w-2 -translate-y-1/2 rounded-r-full border border-slate-500 bg-slate-700 shadow-lg" />
          </div>
        </div>
        <div className="space-y-3 text-center md:text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Merchant counter</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Soundbox control</h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-300">Enter a merchant’s bill to create its payment record, then review credit recovery or scan a distributor invoice.</p>
        </div>
      </section>

      {/* Apple Light Workflow Step Navigator */}
      <div className="bg-white rounded-2xl p-2 border border-[#e5e7eb] shadow-xs max-w-2xl mx-auto">
        <div className="grid grid-cols-4 gap-1 text-center">
          <button
            type="button"
            onClick={() => handleTabClick(1)}
            className={`py-2 px-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-[#0071e3] text-white shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            1. Voice Checkout
          </button>
          <button
            type="button"
            onClick={() => handleTabClick(2)}
            className={`py-2 px-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-[#0071e3] text-white shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            2. Payment QR
          </button>
          <button
            type="button"
            onClick={() => handleTabClick(3)}
            className={`py-2 px-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentStep === 3
                ? 'bg-[#0071e3] text-white shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            3. Credit Recovery
          </button>
          <button
            type="button"
            onClick={() => handleTabClick(4)}
            className={`py-2 px-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentStep === 4
                ? 'bg-[#0071e3] text-white shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            4. Restock Audit
          </button>
        </div>
      </div>

      {flowError && (
        <div role="alert" className="max-w-2xl mx-auto w-full flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span>{flowError}</span>
          <button type="button" onClick={() => setFlowError('')} className="font-semibold underline">Dismiss</button>
        </div>
      )}

      {/* =================================================================== */}
      {/* STAGE 1: VOICE CHECKOUT & SPLIT INTENT (FLOW 1)                     */}
      {/* =================================================================== */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#e5e7eb] shadow-xs space-y-8 animate-in fade-in duration-150">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#0071e3] block">
              Stage 1 • Voice-to-Dynamic-QR &amp; Split Credit
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-1">
              Counter Voice Checkout
            </h2>
            <p className="text-sm text-[#86868b] mt-1">
              Speak or type customer bill to decompose immediate UPI payment and scheduled store credit
            </p>
          </div>

          {/* Centered Push-to-Talk Mic with Real Whisper Capture */}
          <div className="text-center py-2">
            <button
              type="button"
              onClick={handleToggleMic}
              disabled={isProcessingVoice}
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all mx-auto cursor-pointer shadow-md ${
                isListening
                  ? 'bg-rose-500 text-white scale-105 animate-pulse ring-8 ring-rose-100'
                  : 'bg-[#0071e3] hover:bg-[#2997ff] text-white'
              }`}
            >
              <Mic className="w-10 h-10 sm:w-11 sm:h-11" />
            </button>

            <span className="block text-sm text-[#1d1d1f] mt-4 font-medium">
              {isListening
                ? 'Recording your voice... Click again to process'
                : isProcessingVoice
                ? 'Transcribing audio with Groq Whisper...'
                : 'Tap microphone to speak customer bill'}
            </span>

            {isListening && (
              <div className="flex items-center justify-center gap-2 mt-3 h-6">
                <span className="w-1.5 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.1s' }} />
                <span className="w-1.5 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.25s' }} />
                <span className="w-1.5 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.35s' }} />
              </div>
            )}

            {voiceStatusText && (
              <p className="text-xs text-[#86868b] mt-2 font-mono italic">{voiceStatusText}</p>
            )}
          </div>

          {/* Clean Input Field */}
          <div className="max-w-xl mx-auto space-y-3">
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
                placeholder="Speak or type the customer, total, UPI amount, credit amount, and due date"
                className="w-full h-12 pl-5 pr-12 bg-[#f5f5f7] border border-[#e5e7eb] rounded-full text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] font-normal"
              />
              <button
                type="submit"
                disabled={isProcessingVoice || !transcript.trim()}
                title="Submit command"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#0071e3] text-white flex items-center justify-center hover:bg-[#2997ff] transition-colors cursor-pointer disabled:opacity-30"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

          </div>

          {/* Parsed Bill Card (appears dynamically once command is entered) */}
          {parsedData && (
            <div className="pt-6 border-t border-[#e5e7eb] space-y-6 max-w-xl mx-auto animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-[#f5f5f7]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#86868b] block">Customer</span>
                    <input
                      aria-label="Customer name"
                      value={parsedData.customer_name || ''}
                      onChange={(event) => setParsedData((current) => current ? { ...current, customer_name: event.target.value } : current)}
                      placeholder="Customer name"
                      className="mt-1 block w-48 max-w-full rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 text-sm font-semibold text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none"
                    />
                    <input
                      aria-label="Customer phone"
                      inputMode="tel"
                      value={parsedData.customer_phone || ''}
                      onChange={(event) => setParsedData((current) => current ? { ...current, customer_phone: event.target.value } : current)}
                      placeholder="WhatsApp number (optional)"
                      className="mt-1 block w-48 max-w-full rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 text-[11px] text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none"
                    />
                  </div>
                </div>

                {parsedData.udhari_amount > 0 && (
                  <div className="text-right">
                    <span className="text-[11px] text-[#86868b] block">Store Credit Promise</span>
                    <span className="text-sm font-semibold text-amber-700">Due: {dueDate}</span>
                  </div>
                )}
              </div>

              {/* Amount Breakdown */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-[#f5f5f7] rounded-2xl border border-[#e5e7eb]">
                  <span className="text-xs text-[#86868b] block mb-1">Total Bill</span>
                  <span className="text-lg font-semibold text-[#1d1d1f]">₹{parsedData.total_bill.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200">
                  <span className="text-xs text-[#0071e3] font-medium block mb-1">UPI Due</span>
                  <span className="text-lg font-bold text-[#0071e3]">₹{upiDue.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200">
                  <span className="text-xs text-amber-800 font-medium block mb-1">Store Credit</span>
                  <span className="text-lg font-bold text-amber-700">₹{udhariDue.toFixed(2)}</span>
                </div>
              </div>

              {/* Advance CTA */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleProceedToQR}
                  disabled={isGeneratingInvoice || isProcessingVoice}
                  className="h-11 px-6 rounded-full bg-[#0071e3] hover:bg-[#2997ff] text-white text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <span>Lock ₹{upiDue.toFixed(0)} Dynamic QR for {customerName}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* STAGE 2: DYNAMIC QR & REAL-TIME SPOOF GUARD (FLOW 2)               */}
      {/* =================================================================== */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#e5e7eb] shadow-xs space-y-8 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs text-[#86868b] hover:text-[#0071e3] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Bill</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-[#86868b]">
              <span>Customer: <strong className="text-[#1d1d1f]">{customerName}</strong></span>
              <span>•</span>
              <span className="font-mono">{activeInvoice?.invoice_id || 'Invoice not created'}</span>
            </div>
          </div>

          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#0071e3] block">
              Stage 2 • Dynamic QR &amp; Real-Time Spoof Guard
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-1">
              Dynamic Amount-Locked UPI QR
            </h2>
            <p className="text-sm text-[#86868b] mt-1">
              QR amount comes from this invoice • Settlement is checked against gateway evidence
            </p>
          </div>

          {/* QR & Locked Amount Display */}
          <div className="text-center max-w-sm mx-auto p-6 bg-[#f5f5f7] rounded-3xl border border-[#e5e7eb] space-y-3">
            <span className="text-xs text-[#86868b] block">Amount Locked for {customerName}</span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${activeInvoice?.payment_mode === 'PAYTM_DYNAMIC_QR' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {activeInvoice?.payment_mode === 'PAYTM_DYNAMIC_QR' ? 'Paytm Dynamic QR' : 'Paytm connection required'}
            </span>
            <div className="text-4xl sm:text-5xl font-mono font-bold text-[#1d1d1f]">
              ₹{upiDue.toFixed(2)}
            </div>

            {activeInvoice?.payment_mode === 'PAYTM_DYNAMIC_QR' ? (
              <div className="my-2 flex justify-center"><div className="p-3 bg-white rounded-2xl shadow-xs"><QRCodeDisplay value={activeInvoice.qr_data} size={210} /></div></div>
            ) : (
              <div className="my-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-xs text-amber-900">A payment QR cannot be issued or verified until this merchant’s Paytm Dynamic QR credentials are connected. No placeholder QR is shown.</div>
            )}

            {activeInvoice?.payment_mode === 'PAYTM_DYNAMIC_QR' && <div className="flex items-center justify-center gap-1.5 text-xs text-[#86868b]">
              <Clock className="w-3.5 h-3.5 text-[#ff9500]" />
              <span>
                QR expires in{' '}
                <span className="font-mono font-medium text-[#1d1d1f]">
                  {secondsRemaining === 0 ? 'Expired' : `${Math.floor(secondsRemaining / 60)}:${(secondsRemaining % 60).toString().padStart(2, '0')}`}
                </span>
              </span>
            </div>}
          </div>

          {/* Real-Time Payment Verification & Spoof Guard */}
          <div className="max-w-xl mx-auto space-y-4 pt-4 border-t border-[#e5e7eb]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#86868b] block text-center">
              {activeInvoice?.payment_mode === 'PAYTM_DYNAMIC_QR' ? 'Paytm settlement verification' : 'Payment verification unavailable'}
            </span>

            {activeInvoice?.payment_mode === 'PAYTM_DYNAMIC_QR' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center space-y-2">
                <p className="text-xs text-emerald-900">Vani checks Paytm every few seconds and accepts only a verified transaction for this invoice.</p>
                <button type="button" onClick={() => handleVerifyPayment()} disabled={isVerifyingPayment}
                  className="h-9 px-4 rounded-full bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50">
                  {isVerifyingPayment ? 'Checking Paytm…' : 'Check status now'}
                </button>
              </div>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs text-amber-900">Connect Paytm Dynamic QR to receive a genuine payment and verify its settlement here.</p>
            )}

            {paymentStatusMessage && <p role="status" className="text-center text-xs text-[#5b6472]">{paymentStatusMessage}</p>}

            {/* Success State */}
            {paymentResult?.status === 'SUCCESS' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block">Paytm verified payment for {customerName}</span>
                    <span className="text-[11px] text-emerald-700">₹{paymentResult.amount_received.toFixed(2)} matched the invoice.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabClick(udhariDue > 0 ? 3 : 4)}
                  className="h-8 px-4 rounded-full bg-[#34c759] text-white font-medium text-xs cursor-pointer shadow-xs"
                >
                  {udhariDue > 0 ? 'Continue to credit →' : 'Continue to restock →'}
                </button>
              </div>
            )}

            {/* Shortfall Warning State */}
            {paymentResult?.status === 'SHORTFALL_ALERT' && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-900 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block">Shortfall Attack Caught!</span>
                    <span className="text-[11px] text-rose-700">
                      Expected ₹{paymentResult.amount_expected.toFixed(2)} • Received only ₹{paymentResult.amount_received.toFixed(2)} (Deficit: ₹{paymentResult.deficit.toFixed(2)})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentResult(null)}
                  className="text-xs text-rose-700 underline font-medium cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Advance to Step 3 */}
            <div className="pt-4 flex justify-between items-center border-t border-[#f5f5f7]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-[#86868b] hover:underline"
              >
                ← Back to Bill
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(udhariDue > 0 ? 3 : 4)}
                className="h-11 px-6 rounded-full bg-[#0071e3] hover:bg-[#2997ff] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <span>{udhariDue > 0 ? `Continue to ${customerName}’s Credit Recovery (₹${udhariDue.toFixed(2)})` : 'Continue to Restock Audit'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STAGE 3: STORE CREDIT RECOVERY & WHATSAPP LINK                      */}
      {/* =================================================================== */}
      {currentStep === 3 && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#e5e7eb] shadow-xs space-y-8 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs text-[#86868b] hover:text-[#0071e3] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Payment</span>
            </button>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full ${reminderSent ? 'bg-sky-50 text-[#0071e3]' : 'bg-amber-50 text-amber-700'}`}
            >
              {reminderSent ? 'WhatsApp Draft Prepared' : 'Credit Balance Active'}
            </span>
          </div>

          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#0071e3] block">
              Stage 3 • Store Credit &amp; WhatsApp Recovery
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-1">
              Store Credit for {customerName}
            </h2>
            <p className="text-sm text-[#86868b] mt-1">
              Amounts and contact details are carried from the bill you just created.
            </p>
          </div>

          <div className="max-w-xl mx-auto space-y-6">
            {/* Credit Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-y border-[#e5e7eb] text-center">
              <div>
                <span className="text-[11px] text-[#86868b] block mb-1">Customer</span>
                <span className="text-sm font-semibold text-[#1d1d1f]">{customerName}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#86868b] block mb-1">Phone Number</span>
                <span className="text-sm font-mono text-[#1d1d1f]">
                  {customerPhone ? `+91 ${customerPhone}` : 'Phone not captured'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#86868b] block mb-1">Balance Due</span>
                <span className="text-sm font-bold text-amber-700">₹{udhariDue.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#86868b] block mb-1">Promised Date</span>
                <span className="text-sm font-medium text-[#1d1d1f]">{dueDate}</span>
              </div>
            </div>

            {/* WhatsApp Message Preview */}
            <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e7eb] space-y-3">
              <span className="text-xs font-semibold text-[#86868b] block">
                Message preview · review it and press Send in WhatsApp:
              </span>
              <div className="p-4 rounded-xl bg-white border border-[#e5e7eb] text-xs text-[#1d1d1f] space-y-2">
                <p className="font-semibold">Dear {customerName},</p>
                <p className="text-[11px] text-[#86868b] leading-relaxed">
                  Your store credit balance of <strong>₹{udhariDue.toFixed(2)}</strong> at Store Counter is scheduled for payment on <strong>{dueDate}</strong>.
                </p>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[#6b7280]">
              No payment link is attached. The reminder opens in WhatsApp for review; the merchant must press Send.
            </p>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenCustomerWhatsApp}
                className="h-11 px-5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{reminderSent ? 'Open WhatsApp Draft Again' : 'Prepare WhatsApp Reminder'}</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </button>
            </div>

            {/* Advance to Step 4 */}
            <div className="pt-4 flex justify-between items-center border-t border-[#f5f5f7]">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-xs text-[#86868b] hover:underline"
              >
                ← Back to Payment
              </button>
              <button
                type="button"
                onClick={() => handleTabClick(4)}
                className="h-11 px-6 rounded-full bg-[#0071e3] hover:bg-[#2997ff] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <span>Proceed to Wholesaler Restock Audit</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STAGE 4: WHOLESALER RESTOCK AGENT & PRICE AUDIT (FLOW 4)            */}
      {/* =================================================================== */}
      {currentStep === 4 && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#e5e7eb] shadow-xs space-y-8 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(activeInvoice ? (udhariDue > 0 ? 3 : 2) : 1)}
              className="text-xs text-[#86868b] hover:text-[#0071e3] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{activeInvoice ? (udhariDue > 0 ? 'Back to Store Credit' : 'Back to Payment') : 'Back to Checkout'}</span>
            </button>
            <span className="text-xs text-[#86868b]">Wholesaler Invoice OCR</span>
          </div>

          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#0071e3] block">
              Flow 4 • Restock Audit &amp; Price Hike Check
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-1">
              Distributor Invoice Scanner &amp; Restock
            </h2>
                  <p className="text-sm text-[#86868b] mt-1">
              Upload a delivery bill photo for live Gemini OCR, then review extracted lines, supplier price changes, and the reorder draft before sending it.
            </p>
          </div>

          <div className="max-w-xl mx-auto space-y-6">
            {/* Upload Area */}
            <div className="p-6 border border-dashed border-[#e5e7eb] rounded-2xl text-center bg-[#f5f5f7] space-y-3">
              <Upload className="w-7 h-7 text-[#86868b] mx-auto" />
              <p className="text-[11px] text-[#6b7280]">Select a paper invoice photo/PDF for OCR. CSV is available for a deterministic rate audit.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="h-10 px-4 rounded-full bg-[#0071e3] hover:bg-[#2997ff] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs">
                  <Upload className="h-3.5 w-3.5" /><span>Choose photo or PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf,.csv,text/csv"
                    onChange={(e) => {
                      const selectedFile = e.currentTarget.files?.[0];
                      if (selectedFile) {
                        setBillFile(selectedFile);
                        setBillAnalysis(null);
                        setPoResult(null);
                        setRestockError('');
                      }
                      e.currentTarget.value = '';
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAnalyzeBill}
                  disabled={isAnalyzingBill || !billFile}
                  className="h-9 px-4 rounded-full bg-white hover:bg-gray-50 border border-[#e5e7eb] disabled:opacity-40 text-xs font-medium text-[#1d1d1f] cursor-pointer"
                >
                  {isAnalyzingBill ? 'Sending photo to OCR…' : 'Analyze selected file'}
                </button>
              </div>
              {billFile && <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left">
                {billFilePreviewUrl ? <img src={billFilePreviewUrl} alt="Selected distributor invoice preview" className="h-16 w-14 rounded-md border border-slate-200 object-cover" /> : <div className="flex h-16 w-14 items-center justify-center rounded-md bg-slate-100 text-[9px] font-bold uppercase text-slate-500">{billFile.name.split('.').pop()}</div>}
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{billFile.name}</p><p className="text-[10px] text-slate-500">{(billFile.size / 1024).toFixed(0)} KB · selected for upload</p></div>
                <button type="button" onClick={() => { setBillFile(null); setBillAnalysis(null); setRestockError(''); }} className="text-[10px] font-semibold text-slate-500 underline">Remove</button>
              </div>}
            </div>

            {restockError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{restockError}</p>}

            {/* Analysis Results */}
            {billAnalysis && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-xs text-[#86868b]">
                  <span>Vendor: <strong className="text-[#1d1d1f]">{billAnalysis.vendor_name}</strong></span>
                  <span>Invoice: <strong className="font-mono text-[#1d1d1f]">{billAnalysis.invoice_no}</strong></span>
                </div>
                <div className="rounded-lg bg-[#f5f5f7] px-3 py-2 text-[11px] text-[#4b5563]">
                  <strong>{billAnalysis.analysis_source === 'GEMINI_VISION' ? 'Gemini OCR · uploaded document' : 'Uploaded CSV · deterministic audit'}</strong>
                  <span className="block mt-1">{billAnalysis.validation_note}</span>
                </div>

                {/* Price Hike Warning */}
                {billAnalysis.price_hikes && billAnalysis.price_hikes.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Supplier Price Increase Detected:</span>
                      {billAnalysis.price_hikes.map((hike, idx) => (
                        <p key={idx} className="mt-0.5 text-[11px]">
                          {hike.sku}: increased from ₹{hike.previous_rate} to ₹{hike.unit_rate} (+{hike.hike_percentage}%)
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-[#f5f5f7] border-b border-[#e5e7eb] text-[#86868b]">
                      <tr>
                        <th className="py-2 px-3 font-medium">Item Description</th>
                        <th className="py-2 px-3 font-medium text-center">Qty</th>
                        <th className="py-2 px-3 font-medium text-right">Unit Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f5f7]">
                      {billAnalysis.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-[#1d1d1f]">{item.sku}</td>
                          <td className="py-2 px-3 text-center text-[#86868b]">{item.quantity}</td>
                          <td className="py-2 px-3 text-right font-semibold text-[#1d1d1f]">₹{item.unit_rate.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Dispatch Button */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPOPreview(!showPOPreview)}
                    className="text-xs text-[#0071e3] hover:underline font-medium"
                  >
                    {showPOPreview ? 'Hide Draft PO' : 'Review Draft Reorder PO'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenDistributorWhatsApp}
                    disabled={isSendingPO}
                    className="h-10 px-5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{poResult ? 'Reopen PO Draft in WhatsApp' : 'Review PO Draft in WhatsApp'}</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </button>
                </div>

                {poResult && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">{poResult.message}. The draft is ready; WhatsApp still needs the merchant to press Send.</p>}

                {showPOPreview && billAnalysis.draft_po && (
                  <div className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e7eb] text-[11px] font-mono text-[#1d1d1f] space-y-1">
                    <p className="font-semibold">PURCHASE ORDER: #{billAnalysis.draft_po.po_number}</p>
                    <p>To: {billAnalysis.draft_po.supplier_name}</p>
                    <label className="block pt-2 font-sans">Supplier WhatsApp
                      <input value={supplierPhoneInput} onChange={(event) => setSupplierPhoneInput(event.target.value)} inputMode="tel" placeholder="Enter supplier number" className="mt-1 w-full rounded-lg border border-[#d1d5db] bg-white px-2 py-1 font-mono" />
                    </label>
                    {billAnalysis.draft_po.items.map((it, i) => (
                      <p key={i}>• {it.quantity}x {it.sku} @ ₹{it.expected_rate}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* End of Workflow: Reset for Next Customer */}
            <div className="pt-6 border-t border-[#f5f5f7] flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs text-[#86868b] hover:underline"
              >
                ← Back to Store Credit
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="h-11 px-6 rounded-full bg-[#1d1d1f] hover:bg-black text-white text-xs font-medium flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Next Customer Checkout (Step 1)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
