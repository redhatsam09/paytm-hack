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
  UdhariItem,
} from '@/types';
import {
  parseVoiceCommand,
  transcribeAudioRecording,
  createCounterInvoice,
  checkPaytmPaymentStatus,
  analyzeDistributorInvoice,
  sendPurchaseOrder,
  getUdhariList,
} from '@/lib/api';
import { playPaytmChime, playAlertSiren, speakAnnouncement } from '@/lib/audio';

type TerminalStep = 1 | 3 | 4;

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
  const [shouldScrollToBillReview, setShouldScrollToBillReview] = useState(false);

  // Audio Recording Refs for real microphone capture
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const parsedBillRef = useRef<HTMLDivElement | null>(null);

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
  const [creditEntries, setCreditEntries] = useState<UdhariItem[]>([]);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(false);
  const [creditLoadError, setCreditLoadError] = useState<string>('');

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

  useEffect(() => {
    if (currentStep !== 3 || activeInvoice?.udhari_id) return;
    setIsLoadingCredits(true);
    setCreditLoadError('');
    getUdhariList()
      .then(setCreditEntries)
      .catch((error) => setCreditLoadError(error instanceof Error ? error.message : 'Could not load store credit records.'))
      .finally(() => setIsLoadingCredits(false));
  }, [currentStep, activeInvoice?.udhari_id]);

  useEffect(() => {
    if (shouldScrollToBillReview && !activeInvoice) {
      parsedBillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setShouldScrollToBillReview(false);
    }
  }, [shouldScrollToBillReview, activeInvoice]);

  // Countdown for the inline checkout QR
  useEffect(() => {
    if (currentStep !== 1 || activeInvoice?.payment_mode !== 'PAYTM_DYNAMIC_QR' || paymentResult?.status === 'SUCCESS') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, activeInvoice?.payment_mode, paymentResult]);

  // Execute voice or typed command
  const executeCommand = async (text: string) => {
    if (!text.trim()) return;
    setTranscript(text);
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
      setTranscript(text.trim());
      if (res.data && res.data.total_bill > 0 && (res.data.upi_amount + res.data.udhari_amount + res.data.cash_amount) > 0) {
        setParsedData(res.data);
        setShouldScrollToBillReview(true);
        const hasPaymentCue = /(upi|cash|udhari|credit|khata|baaki|pending|paid|नकद|उधार|बाकी|यूपीआई)/i.test(text);
        setVoiceStatusText(hasPaymentCue
          ? `Parsed ${res.data.customer_name || 'customer'}’s ₹${res.data.total_bill.toFixed(2)} bill. Review the split, then create the invoice.`
          : `Parsed ${res.data.customer_name || 'customer'}’s ₹${res.data.total_bill.toFixed(2)} bill. No payment type was spoken, so the full amount is set to UPI; review before creating the invoice.`);
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
      if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current);
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
    setTranscript('');
    setVoiceStatusText('Requesting microphone access…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
      const supportedMimeType = preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const mediaRecorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || audioChunksRef.current[0]?.type });

        if (audioBlob.size > 100) {
          setIsProcessingVoice(true);
          setVoiceStatusText('Uploading your recording for speech recognition…');
          try {
            const res = await transcribeAudioRecording(audioBlob);
            const spokenText = res.transcript.trim();
            setTranscript(spokenText);
            if (res.data && res.data.total_bill > 0 && (res.data.upi_amount + res.data.udhari_amount + res.data.cash_amount) > 0) {
              setParsedData(res.data);
              setShouldScrollToBillReview(true);
              const hasPaymentCue = /(upi|cash|udhari|credit|khata|baaki|pending|paid|नकद|उधार|बाकी|यूपीआई)/i.test(spokenText);
              setVoiceStatusText(hasPaymentCue
                ? `Heard: “${spokenText}”. Review the extracted amounts and customer details before creating the invoice.`
                : `Heard: “${spokenText}”. No payment type was spoken, so the full amount is set to UPI; review before creating the invoice.`);
            } else {
              setParsedData(null);
              setVoiceStatusText(`Heard: “${spokenText}”. I could not identify a complete bill split. Correct the transcript and submit it to parse again.`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Audio transcription failed';
            setFlowError(message);
            setVoiceStatusText('Transcription failed. Check the error, then record again or type the bill.');
          } finally {
            setIsProcessingVoice(false);
          }
        } else {
          setVoiceStatusText('No clear audio was captured. Hold the microphone button while speaking, then release it.');
        }
      };

      mediaRecorder.start(200);
      setIsListening(true);
      setVoiceStatusText('Listening… Speak the customer, bill total, UPI, credit/cash split, and due date. Release to finish (max 20 seconds).');
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          setIsListening(false);
          setVoiceStatusText('Recording limit reached. Processing your speech…');
          mediaRecorder.stop();
        }
      }, 20_000);
    } catch (error) {
      setIsListening(false);
      const message = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone access is blocked. Allow microphone access or enter the bill below.'
        : error instanceof Error ? error.message : 'Could not start the microphone.';
      setVoiceStatusText(message);
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
    if (Math.abs(splitTotal - parsedData.total_bill) > 0.01) {
      setFlowError(`UPI, store credit, and cash must add up to ₹${parsedData.total_bill.toFixed(2)}.`);
      setCurrentStep(1);
      return;
    }
    if (parsedData.upi_amount + parsedData.cash_amount + parsedData.udhari_amount <= 0) {
      setFlowError('Enter a UPI, cash, or store-credit amount for this bill.');
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
        cash_received: parsedData.cash_amount,
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
      setCurrentStep(1);
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
    if (currentStep !== 1 || activeInvoice?.payment_mode !== 'PAYTM_DYNAMIC_QR') return;
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

  const handleOpenLedgerWhatsApp = (entry: UdhariItem) => {
    const cleanPhone = (entry.customer_phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFlowError(`Add a valid phone number to ${entry.customer_name}’s ledger record before opening WhatsApp.`);
      return;
    }
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const message = `Dear ${entry.customer_name}, your store credit balance of ₹${entry.amount_due.toFixed(2)} is due on ${formatDueDate(entry.due_date)}. Please contact the store to arrange payment.`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setFlowError('');
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
  const reviewedSplit = parsedData ? parsedData.upi_amount + parsedData.udhari_amount + parsedData.cash_amount : 0;
  const splitMatchesTotal = Boolean(parsedData && Math.abs(reviewedSplit - parsedData.total_bill) <= 0.01);

  // Handler for navigation tabs ensuring data availability
  const handleTabClick = (step: TerminalStep) => {
    if (step === 3) setFlowError('');
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
              <div className="mb-2 text-[9px] uppercase tracking-[0.16em] text-cyan-200/70">{paymentResult?.status === 'SHORTFALL_ALERT' ? 'Payment mismatch' : paymentResult?.status === 'SUCCESS' ? 'Payment matched' : currentStep === 4 ? 'Invoice audit' : currentStep === 3 ? 'Credit recovery' : activeInvoice ? 'Payment expected' : 'Counter ready'}</div>
              <div className={`font-mono text-3xl font-bold tracking-tight ${paymentResult?.status === 'SHORTFALL_ALERT' ? 'text-rose-300' : paymentResult?.status === 'SUCCESS' ? 'text-emerald-300' : 'text-cyan-100'}`}>
                {currentStep === 4 ? `${billAnalysis?.items.length || 0} LINES` : currentStep === 3 ? `₹${udhariDue.toFixed(2)}` : activeInvoice ? `₹${upiDue.toFixed(2)}` : parsedData ? `₹${parsedData.total_bill.toFixed(2)}` : 'READY'}
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
        <div className="grid grid-cols-3 gap-1 text-center">
          <button
            type="button"
            onClick={() => handleTabClick(1)}
            className={`py-2 px-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-[#0071e3] text-white shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            1. Checkout
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
            2. Credit Recovery
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
            3. Restock Audit
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
              Checkout • Voice, payment, and store credit
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
                ? 'Recognizing speech and extracting bill details…'
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
                  const formData = new FormData(e.currentTarget);
                  const command = String(formData.get('checkoutCommand') || '').trim();
                  if (command) executeCommand(command);
              }}
              className="relative"
            >
              <input
                type="text"
                name="checkoutCommand"
                aria-label="Customer bill command"
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  setParsedData(null);
                }}
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
          {parsedData && !activeInvoice && (
            <div ref={parsedBillRef} className="pt-6 border-t border-[#e5e7eb] space-y-6 max-w-xl mx-auto animate-in fade-in">
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
                    <input
                      aria-label="Store credit due date"
                      type="date"
                      value={parsedData.due_date || ''}
                      onChange={(event) => setParsedData((current) => current ? { ...current, due_date: event.target.value } : current)}
                      className="mt-1 max-w-full rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 text-xs font-semibold text-amber-800"
                    />
                  </div>
                )}
              </div>

              {/* Amount Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#f5f5f7] rounded-2xl border border-[#e5e7eb]">
                  <span className="text-xs text-[#86868b] block mb-1">Total Bill</span>
                  <div className="flex items-center justify-center gap-1"><span className="text-sm">₹</span><input aria-label="Total bill amount" type="number" min="0" step="0.01" value={parsedData.total_bill} onChange={(event) => setParsedData((current) => current ? { ...current, total_bill: Number(event.target.value) || 0 } : current)} className="w-24 bg-transparent text-center text-lg font-semibold text-[#1d1d1f] focus:outline-none" /></div>
                </div>
                <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200">
                  <span className="text-xs text-[#0071e3] font-medium block mb-1">UPI Due</span>
                  <div className="flex items-center justify-center gap-1"><span className="text-sm text-[#0071e3]">₹</span><input aria-label="UPI amount" type="number" min="0" step="0.01" value={parsedData.upi_amount} onChange={(event) => setParsedData((current) => current ? { ...current, upi_amount: Number(event.target.value) || 0 } : current)} className="w-24 bg-transparent text-center text-lg font-bold text-[#0071e3] focus:outline-none" /></div>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200">
                  <span className="text-xs text-amber-800 font-medium block mb-1">Store Credit</span>
                  <div className="flex items-center justify-center gap-1"><span className="text-sm text-amber-700">₹</span><input aria-label="Store credit amount" type="number" min="0" step="0.01" value={parsedData.udhari_amount} onChange={(event) => setParsedData((current) => current ? { ...current, udhari_amount: Number(event.target.value) || 0 } : current)} className="w-24 bg-transparent text-center text-lg font-bold text-amber-700 focus:outline-none" /></div>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200">
                  <span className="text-xs text-emerald-800 font-medium block mb-1">Cash</span>
                  <div className="flex items-center justify-center gap-1"><span className="text-sm text-emerald-700">₹</span><input aria-label="Cash amount" type="number" min="0" step="0.01" value={parsedData.cash_amount} onChange={(event) => setParsedData((current) => current ? { ...current, cash_amount: Number(event.target.value) || 0 } : current)} className="w-24 bg-transparent text-center text-lg font-bold text-emerald-700 focus:outline-none" /></div>
                </div>
              </div>

              <p className={`text-xs text-center ${splitMatchesTotal ? 'text-emerald-700' : 'text-rose-700'}`} role="status">
                {splitMatchesTotal
                  ? `Amounts reconcile: ₹${reviewedSplit.toFixed(2)} allocated against ₹${parsedData.total_bill.toFixed(2)} total.`
                  : `Amounts do not reconcile: UPI + credit + cash = ₹${reviewedSplit.toFixed(2)}, but total is ₹${parsedData.total_bill.toFixed(2)}. Correct the fields before continuing.`}
              </p>

              {/* Advance CTA */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleProceedToQR}
                  disabled={isGeneratingInvoice || isProcessingVoice || !splitMatchesTotal || parsedData.total_bill <= 0 || parsedData.upi_amount + parsedData.cash_amount + parsedData.udhari_amount <= 0 || (parsedData.udhari_amount > 0 && !parsedData.customer_name?.trim())}
                  className="h-11 px-6 rounded-full bg-[#0071e3] hover:bg-[#2997ff] text-white text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span>{isGeneratingInvoice ? 'Creating invoice…' : parsedData.upi_amount > 0 ? `Create bill & show ₹${parsedData.upi_amount.toFixed(2)} QR` : parsedData.udhari_amount > 0 ? `Record ₹${parsedData.udhari_amount.toFixed(2)} store credit` : `Record bill · ₹${parsedData.cash_amount.toFixed(2)} cash`}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeInvoice && (
            <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-7 animate-in fade-in">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Invoice created · {activeInvoice.invoice_id}</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">{activeInvoice.customer_name || 'Customer'} · ₹{activeInvoice.total_bill.toFixed(2)}</h3>
                  <p className="mt-1 text-sm text-slate-600">UPI ₹{activeInvoice.upi_due.toFixed(2)} · Cash ₹{activeInvoice.cash_received.toFixed(2)} · Credit ₹{activeInvoice.udhari_amount.toFixed(2)}</p>
                </div>
                <button type="button" onClick={handleReset} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">Start new bill</button>
              </div>

              {activeInvoice.upi_due > 0 ? (
                <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Collect ₹{activeInvoice.upi_due.toFixed(2)} by UPI</p>
                    {activeInvoice.payment_mode === 'PAYTM_DYNAMIC_QR' ? (
                      <>
                        <p className="mt-1 text-xs text-slate-600">Show this amount-locked QR to the customer. Settlement is checked against the invoice.</p>
                        <button type="button" onClick={() => void handleVerifyPayment()} disabled={isVerifyingPayment} className="mt-4 rounded-full bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{isVerifyingPayment ? 'Checking payment…' : 'Check payment status'}</button>
                      </>
                    ) : (
                      <p className="mt-2 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Demo QR for interface validation only. It cannot accept money or verify settlement. Connect the merchant’s Paytm Dynamic QR account for live payments.</p>
                    )}
                    {paymentStatusMessage && <p role="status" className="mt-3 text-xs text-slate-600">{paymentStatusMessage}</p>}
                    {paymentResult && <p role="status" className={`mt-3 rounded-xl p-3 text-sm font-semibold ${paymentResult.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{paymentResult.status === 'SUCCESS' ? `Payment verified: ₹${paymentResult.amount_received.toFixed(2)} received.` : `Payment shortfall: ₹${paymentResult.amount_received.toFixed(2)} received, ₹${paymentResult.deficit.toFixed(2)} still due.`}</p>}
                  </div>
                  {activeInvoice.qr_data && <div className="justify-self-center text-center"><div className="rounded-2xl bg-white p-3 shadow-sm"><QRCodeDisplay value={activeInvoice.qr_data} size={190} /></div><p className="mt-2 text-xs font-semibold text-slate-700">{activeInvoice.payment_mode === 'PAYTM_DYNAMIC_QR' ? 'Live Paytm QR' : 'Demo QR · not payable'}</p><p className="mt-1 text-xs text-slate-600">{activeInvoice.payment_mode === 'PAYTM_DYNAMIC_QR' ? (secondsRemaining === 0 ? 'QR expired' : `QR expires in ${Math.floor(secondsRemaining / 60)}:${(secondsRemaining % 60).toString().padStart(2, '0')}`) : `Invoice ${activeInvoice.invoice_id}`}</p></div>}
                </div>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No UPI payment is due on this bill. Cash and store credit have been recorded; there is no QR to show.</p>
              )}

              {activeInvoice.udhari_amount > 0 && <button type="button" onClick={() => setCurrentStep(3)} className="mt-5 rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white">Manage ₹{activeInvoice.udhari_amount.toFixed(2)} store credit</button>}
            </section>
          )}
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
              onClick={() => setCurrentStep(1)}
              className="text-xs text-[#86868b] hover:text-[#0071e3] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Checkout</span>
            </button>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full ${reminderSent ? 'bg-sky-50 text-[#0071e3]' : 'bg-amber-50 text-amber-700'}`}
            >
              {reminderSent ? 'WhatsApp Draft Prepared' : activeInvoice?.udhari_id ? 'Credit Balance Active' : 'Ledger View'}
            </span>
          </div>

          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#0071e3] block">
              Stage 3 • Store Credit &amp; WhatsApp Recovery
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-1">
              {activeInvoice?.udhari_id && activeInvoice.udhari_amount > 0 ? `Store Credit for ${customerName}` : 'Store Credit Ledger'}
            </h2>
            <p className="text-sm text-[#86868b] mt-1">
              {activeInvoice?.udhari_id && activeInvoice.udhari_amount > 0 ? 'Amounts and contact details are carried from the bill you just created.' : 'View outstanding balances from the merchant ledger and prepare customer reminders.'}
            </p>
          </div>

          {activeInvoice?.udhari_id && activeInvoice.udhari_amount > 0 ? (
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
                onClick={() => setCurrentStep(1)}
                className="text-xs text-[#86868b] hover:underline"
              >
                ← Back to Checkout
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
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="text-sm font-semibold text-slate-900">Outstanding store credit</h3><p className="mt-1 text-xs text-slate-500">Loaded from this merchant’s credit ledger.</p></div>
                <button type="button" onClick={() => { setIsLoadingCredits(true); setCreditLoadError(''); getUdhariList().then(setCreditEntries).catch((error) => setCreditLoadError(error instanceof Error ? error.message : 'Could not load the store credit ledger.')).finally(() => setIsLoadingCredits(false)); }} disabled={isLoadingCredits} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50">{isLoadingCredits ? 'Refreshing…' : 'Refresh ledger'}</button>
              </div>
              {creditLoadError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{creditLoadError}</p>}
              {isLoadingCredits ? <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Loading store credit ledger…</p> : creditEntries.filter((entry) => entry.status !== 'SETTLED').length === 0 ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">No unpaid store credit records found. Create a checkout with a credit balance to add one.</p> : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {creditEntries.filter((entry) => entry.status !== 'SETTLED').map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-0">
                    <div><p className="text-sm font-semibold text-slate-900">{entry.customer_name}</p><p className="mt-1 text-xs text-slate-500">{entry.transaction_id} · Due {formatDueDate(entry.due_date)} · {entry.status.replace('_', ' ').toLowerCase()}</p></div>
                    <div className="flex items-center gap-3"><span className="font-mono text-sm font-bold text-amber-700">₹{entry.amount_due.toFixed(2)}</span><button type="button" onClick={() => handleOpenLedgerWhatsApp(entry)} disabled={!entry.customer_phone} title={!entry.customer_phone ? 'A phone number is required' : 'Prepare a WhatsApp reminder'} className="rounded-full bg-[#25D366] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Prepare reminder</button></div>
                  </div>)}
                </div>
              )}
            </div>
          )}
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
              onClick={() => setCurrentStep(activeInvoice && udhariDue > 0 ? 3 : 1)}
              className="text-xs text-[#86868b] hover:text-[#0071e3] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{activeInvoice && udhariDue > 0 ? 'Back to Store Credit' : 'Back to Checkout'}</span>
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
                onClick={() => setCurrentStep(activeInvoice && udhariDue > 0 ? 3 : 1)}
                className="text-xs text-[#86868b] hover:underline"
              >
                {activeInvoice && udhariDue > 0 ? '← Back to Store Credit' : '← Back to Checkout'}
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
