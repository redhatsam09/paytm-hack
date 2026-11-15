'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Clock,
  RotateCcw,
  Upload,
  FileText,
  Send,
  ShieldCheck,
  User,
  CheckCircle2,
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

type TerminalStep = 1 | 2 | 3 | 4;

export const CheckoutTerminal: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<TerminalStep>(1);

  // Step 1: Voice Input & Intent Split
  const [transcript, setTranscript] = useState<string>(
    'Ramesh bill ₹650 — ₹400 UPI now, ₹250 credit for Monday'
  );
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<VoiceParseData | null>({
    total_bill: 650,
    upi_amount: 400,
    udhari_amount: 250,
    cash_amount: 0,
    due_date: '2026-11-17',
    customer_name: 'Ramesh',
    customer_phone: '9876543210',
    items: ['Kirana goods'],
  });

  // Step 2: Dynamic QR & Payment Verification
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>('400.00');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [paymentResult, setPaymentResult] = useState<WebhookResponse | null>(null);

  // Step 3: Credit Recovery
  const [reminderSent, setReminderSent] = useState<boolean>(false);
  const [isSendingReminder, setIsSendingReminder] = useState<boolean>(false);
  const [isSettlingCredit, setIsSettlingCredit] = useState<boolean>(false);
  const [isCreditSettled, setIsCreditSettled] = useState<boolean>(false);

  // Step 4: Restock & Price Audit
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

  // Execute voice / text command
  const executeCommand = async (text: string) => {
    setIsProcessingVoice(true);
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
    }
  };

  // Push-to-Talk Mic: Click to start, click again to stop and auto-execute
  const handleToggleMic = () => {
    if (isListening) {
      setIsListening(false);
      executeCommand(transcript);
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
          executeCommand(spoken);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognition.start();
        return;
      } catch {
        // Fallback simulation below
      }
    }

    // High fidelity simulated speech capture
    setTimeout(() => {
      setIsListening(false);
      executeCommand(transcript);
    }, 1800);
  };

  // Step 1 -> Step 2: Create dynamic invoice
  const handleProceedToQR = async () => {
    if (!parsedData) return;
    setIsGeneratingInvoice(true);
    try {
      const invoice = await createCounterInvoice({
        total_bill: parsedData.total_bill,
        upi_due: parsedData.upi_amount,
        udhari_amount: parsedData.udhari_amount,
        cash_received: parsedData.cash_amount,
        customer_name: parsedData.customer_name || 'Customer',
        customer_phone: parsedData.customer_phone || '9876543210',
        due_date: parsedData.due_date,
      });

      setActiveInvoice(invoice);
      setSecondsRemaining(180);
      setPaymentResult(null);
      setReceivedAmountInput(invoice.upi_due.toFixed(2));
      setCurrentStep(2);
    } catch (err) {
      console.warn('Invoice generation failed:', err);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Step 2: Interactive payment verification
  const handleVerifyPayment = async () => {
    const invId = activeInvoice?.invoice_id || 'INV-2026-001';
    const amount = parseFloat(receivedAmountInput) || 0;
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

        // Automatically advance to Step 3 if credit exists, or give complete button
        setTimeout(() => {
          if ((activeInvoice?.udhari_amount || parsedData?.udhari_amount || 0) > 0) {
            setCurrentStep(3);
          }
        }, 1500);
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

  // Step 3: Settle Store Credit
  const handleSettleCredit = async () => {
    setIsSettlingCredit(true);
    try {
      const udhId = activeInvoice?.udhari_id || 'udh-001';
      const amt = activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250;
      await reconcileUdhariPayment(udhId, amt);
      setIsCreditSettled(true);
      playPaytmChime();
      speakAnnouncement(`Paytm bhugtan ₹${amt} safal hua`, 'hi');
    } catch (err) {
      console.warn('Credit settlement error:', err);
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

  // Step 4: Dispatch PO
  const handleDispatchPO = async () => {
    if (!billAnalysis?.draft_po) return;
    setIsSendingPO(true);
    try {
      const res = await sendPurchaseOrder({
        po_number: billAnalysis.draft_po.po_number,
        supplier_name: billAnalysis.draft_po.supplier_name,
        supplier_phone: billAnalysis.draft_po.supplier_phone,
        items: billAnalysis.draft_po.items,
      });
      setPoResult(res);
      playPaytmChime();
    } catch (err) {
      console.warn('Dispatch PO error:', err);
    } finally {
      setIsSendingPO(false);
    }
  };

  // Reset checkout
  const handleReset = () => {
    setCurrentStep(1);
    setPaymentResult(null);
    setActiveInvoice(null);
    setReminderSent(false);
    setIsCreditSettled(false);
    setSecondsRemaining(180);
  };

  const customerName = activeInvoice?.customer_name || parsedData?.customer_name || 'Customer';

  return (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-4">
      {/* Step Indicator Header */}
      <div className="mb-10 max-w-2xl mx-auto">
        <div className="grid grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`h-2 rounded-full transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-[#3a3f5c]'
                : currentStep > 1
                ? 'bg-[#0e9f6e]'
                : 'bg-[#e6e6e6]'
            }`}
          />
          <button
            type="button"
            onClick={() => {
              if (activeInvoice || parsedData) setCurrentStep(2);
            }}
            className={`h-2 rounded-full transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-[#3a3f5c]'
                : currentStep > 2
                ? 'bg-[#0e9f6e]'
                : 'bg-[#e6e6e6]'
            }`}
          />
          <button
            type="button"
            onClick={() => {
              if (currentStep >= 3 || paymentResult?.status === 'SUCCESS') setCurrentStep(3);
            }}
            className={`h-2 rounded-full transition-all cursor-pointer ${
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
            className={`h-2 rounded-full transition-all cursor-pointer ${
              currentStep === 4 ? 'bg-[#3a3f5c]' : 'bg-[#e6e6e6]'
            }`}
          />
        </div>

        <div className="flex justify-between text-xs sm:text-sm text-[#717171] mt-3 font-medium px-1">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`cursor-pointer ${currentStep === 1 ? 'text-[#3d3d3d] font-semibold' : ''}`}
          >
            1. Voice Checkout
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeInvoice || parsedData) setCurrentStep(2);
            }}
            className={`cursor-pointer ${currentStep === 2 ? 'text-[#3d3d3d] font-semibold' : ''}`}
          >
            2. Payment ({customerName})
          </button>
          <button
            type="button"
            onClick={() => {
              if (currentStep >= 3 || paymentResult?.status === 'SUCCESS') setCurrentStep(3);
            }}
            className={`cursor-pointer ${currentStep === 3 ? 'text-[#3d3d3d] font-semibold' : ''}`}
          >
            3. Credit Recovery
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep(4)}
            className={`cursor-pointer ${currentStep === 4 ? 'text-[#3d3d3d] font-semibold' : ''}`}
          >
            4. Restock Audit
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* STEP 1: VOICE INPUT & BILL CREATION                               */}
      {/* ================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-[32px] p-8 sm:p-12 border border-[#e6e6e6] shadow-xs space-y-8 animate-in fade-in duration-200">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-medium text-[#3d3d3d] tracking-tight">
              Create Customer Bill by Voice
            </h2>
            <p className="text-sm sm:text-base text-[#717171] mt-2">
              Speak the customer name and amounts naturally in Hindi or English
            </p>
          </div>

          {/* Centered Large Push-to-Talk Mic */}
          <div className="text-center py-6">
            <button
              type="button"
              onClick={handleToggleMic}
              className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all mx-auto cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white shadow-xl scale-105 animate-pulse ring-8 ring-rose-100'
                  : 'bg-[#3a3f5c] hover:bg-[#2c314a] text-white shadow-lg ring-8 ring-[#3a3f5c]/5 hover:scale-102'
              }`}
            >
              <Mic className="w-12 h-12" />
            </button>

            <span className="block text-sm sm:text-base text-[#3d3d3d] mt-4 font-medium">
              {isListening ? 'Listening to speech... click to finish' : 'Click to speak customer bill'}
            </span>

            {isListening && (
              <div className="flex items-center justify-center gap-2 mt-4 h-6">
                <span className="w-1.5 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.1s' }} />
                <span className="w-1.5 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.25s' }} />
                <span className="w-1.5 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 bg-rose-500 rounded-full wave-bar" style={{ animationDelay: '0.35s' }} />
              </div>
            )}
          </div>

          {/* Input field (auto-executes on Enter) */}
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeCommand(transcript);
              }}
            >
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="e.g. Rahul 500  OR  Ramesh bill 650, 400 UPI now, 250 credit Monday"
                className="w-full h-14 sm:h-16 px-7 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-sm sm:text-base text-[#3d3d3d] placeholder-[#999999] focus:outline-none focus:border-[#3a3f5c] shadow-2xs font-normal"
              />
            </form>

            {/* Subtle clean sample text links */}
            <div className="mt-3 text-center text-xs sm:text-sm text-[#717171]">
              <span className="mr-1">Try:</span>
              <button
                type="button"
                onClick={() => {
                  const t = 'Rahul bill ₹500 full UPI';
                  setTranscript(t);
                  executeCommand(t);
                }}
                className="hover:text-[#3a3f5c] underline underline-offset-2 cursor-pointer mx-1.5"
              >
                Rahul ₹500 UPI
              </button>
              •
              <button
                type="button"
                onClick={() => {
                  const t = 'Ramesh bill ₹650 — ₹400 UPI now, ₹250 credit for Monday';
                  setTranscript(t);
                  executeCommand(t);
                }}
                className="hover:text-[#3a3f5c] underline underline-offset-2 cursor-pointer mx-1.5"
              >
                Ramesh ₹650 split bill
              </button>
              •
              <button
                type="button"
                onClick={() => {
                  const t = 'Sayandeep bill ₹1200 — ₹700 cash, ₹500 credit for Friday';
                  setTranscript(t);
                  executeCommand(t);
                }}
                className="hover:text-[#3a3f5c] underline underline-offset-2 cursor-pointer ml-1.5"
              >
                Sayandeep ₹1200 split
              </button>
            </div>
          </div>

          {/* Customer Bill Breakdown Card */}
          {parsedData && (
            <div className="pt-8 border-t border-[#e6e6e6] space-y-6 max-w-2xl mx-auto">
              {/* Customer Name Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#3a3f5c]/10 text-[#3a3f5c] flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-[#717171] block">Customer</span>
                    <span className="text-lg font-semibold text-[#3d3d3d]">
                      {parsedData.customer_name || 'Customer'}
                    </span>
                  </div>
                </div>

                {parsedData.udhari_amount > 0 && parsedData.due_date && (
                  <div className="text-right">
                    <span className="text-xs text-[#717171] block">Credit Promise</span>
                    <span className="text-sm font-medium text-amber-700">
                      Due: {parsedData.due_date}
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
                <div className="p-4 rounded-2xl bg-[#3a3f5c]/5 border border-[#3a3f5c]/15">
                  <span className="text-xs text-[#3a3f5c] font-medium block mb-1">UPI Due</span>
                  <span className="text-xl sm:text-2xl font-bold text-[#3a3f5c]">
                    ₹{parsedData.upi_amount.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <span className="text-xs text-amber-800 font-medium block mb-1">Store Credit</span>
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
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleProceedToQR}
                  disabled={isGeneratingInvoice || isProcessingVoice}
                  className="h-14 px-8 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-medium text-sm sm:text-base flex items-center gap-2.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <span>
                    {isGeneratingInvoice
                      ? 'Preparing Payment...'
                      : `Proceed to Payment for ${customerName} (₹${parsedData.upi_amount.toFixed(2)})`}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: PAYMENT & SPOOF VERIFICATION (CARRIES CUSTOMER NAME)      */}
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

          {/* Centered QR & Amount Display */}
          <div className="text-center py-4">
            <div className="text-sm sm:text-base text-[#717171] mb-1 font-medium">
              Amount Due for {customerName}
            </div>
            <div className="text-5xl sm:text-6xl font-light text-[#3d3d3d] tracking-tight">
              ₹{(activeInvoice?.upi_due || parsedData?.upi_amount || 400).toFixed(2)}
            </div>

            <div className="my-6 flex justify-center">
              <QRCodeDisplay
                value={
                  activeInvoice?.qr_data ||
                  'upi://pay?pa=srilakshmi@paytm&pn=SriLakshmiStores&am=400.00&cu=INR'
                }
                size={260}
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-[#717171]">
              <Clock className="w-4 h-4 text-[#f97316]" />
              <span>
                QR expires in{' '}
                <span className="font-mono font-semibold text-[#3d3d3d]">
                  {Math.floor(secondsRemaining / 60)}:
                  {(secondsRemaining % 60).toString().padStart(2, '0')}
                </span>
              </span>
            </div>
          </div>

          {/* Payment Terminal & Spoof Verification */}
          <div className="pt-6 border-t border-[#e6e6e6] space-y-4 max-w-xl mx-auto">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <label className="font-semibold text-[#3d3d3d]">
                Payment Verification:
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReceivedAmountInput((activeInvoice?.upi_due || 400).toFixed(2))}
                  className="text-xs px-3 py-1 rounded-full border border-[#e6e6e6] hover:bg-gray-50 text-[#3d3d3d] cursor-pointer"
                >
                  ₹{(activeInvoice?.upi_due || 400).toFixed(0)} (Full Match)
                </button>
                <button
                  type="button"
                  onClick={() => setReceivedAmountInput('40.00')}
                  className="text-xs px-3 py-1 rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                >
                  ₹40 (Shortfall Spoof)
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm text-[#717171]">₹</span>
                <input
                  type="text"
                  value={receivedAmountInput}
                  onChange={(e) => setReceivedAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-13 pl-9 pr-4 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-base text-[#3d3d3d] font-mono focus:outline-none focus:border-[#3a3f5c]"
                />
              </div>
              <button
                type="button"
                onClick={handleVerifyPayment}
                disabled={isVerifyingPayment}
                className="h-13 px-8 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-medium text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isVerifyingPayment ? 'Verifying...' : 'Verify Payment'}</span>
              </button>
            </div>

            {/* Success state */}
            {paymentResult?.status === 'SUCCESS' && (
              <div className="p-4 bg-[#0e9f6e]/10 border border-[#0e9f6e]/30 rounded-2xl text-sm text-[#0e9f6e] flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold">
                    Payment of ₹{paymentResult.amount_received.toFixed(2)} verified for {customerName}!
                  </span>
                </div>
                {(activeInvoice?.udhari_amount || parsedData?.udhari_amount || 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="font-semibold underline underline-offset-2 cursor-pointer ml-2"
                  >
                    View Store Credit →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="font-semibold underline underline-offset-2 cursor-pointer ml-2"
                  >
                    Next Customer →
                  </button>
                )}
              </div>
            )}

            {/* Shortfall spoof warning */}
            {paymentResult?.status === 'SHORTFALL_ALERT' && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-sm text-rose-800 flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">
                      Shortfall Alert for {customerName}
                    </span>
                    <span className="text-xs">
                      Received ₹{paymentResult.amount_received.toFixed(2)} • Outstanding Deficit: ₹{paymentResult.deficit.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentResult(null)}
                  className="text-rose-700 underline underline-offset-2 text-xs font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: STORE CREDIT RECOVERY FOR CUSTOMER                        */}
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
              <span>Back to Payment</span>
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
              {isCreditSettled ? 'Settled ✓' : reminderSent ? 'WhatsApp Link Sent' : 'Store Credit Pending'}
            </span>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            <div>
              <h2 className="text-2xl sm:text-3xl font-medium text-[#3d3d3d] tracking-tight">
                Store Credit for {customerName}
              </h2>
              <p className="text-sm text-[#717171] mt-1">
                Automated payment reminder and digital recovery link
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
                <span className="text-xs text-[#717171] block mb-1">Balance Due</span>
                <span className="text-base font-bold text-amber-700">
                  ₹{(activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#717171] block mb-1">Promised Date</span>
                <span className="text-base font-medium text-[#3d3d3d]">
                  {activeInvoice?.due_date || parsedData?.due_date || 'Monday'}
                </span>
              </div>
            </div>

            {/* WhatsApp Message Preview */}
            <div className="p-6 rounded-2xl bg-[#fcfcfc] border border-[#e6e6e6] space-y-3">
              <span className="text-xs font-medium text-[#717171] block">
                Scheduled WhatsApp Reminder Message:
              </span>
              <div className="p-5 rounded-2xl bg-white border border-[#e6e6e6] text-sm text-[#3d3d3d] space-y-2">
                <p className="font-medium">
                  Dear {customerName},
                </p>
                <p className="text-xs text-[#717171] leading-relaxed">
                  Your store credit balance of <strong>₹{(activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250).toFixed(2)}</strong> at Sri Lakshmi Stores is scheduled for payment on <strong>{activeInvoice?.due_date || parsedData?.due_date || 'Monday'}</strong>.
                </p>
                <p className="text-xs text-[#717171]">
                  Please complete your payment using the direct payment link:
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-2 rounded-full bg-[#3a3f5c] text-white text-xs font-medium">
                    Pay Now: https://p.paytm.me/pay?id=credit-001
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={isSendingReminder || reminderSent}
                className="h-12 px-6 rounded-full border border-[#e6e6e6] hover:bg-gray-50 text-xs sm:text-sm font-medium text-[#3d3d3d] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4 text-[#3a3f5c]" />
                <span>{reminderSent ? 'WhatsApp Link Sent ✓' : 'Send WhatsApp Reminder'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSettleCredit}
                  disabled={isSettlingCredit || isCreditSettled}
                  className={`h-12 px-7 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                    isCreditSettled
                      ? 'bg-[#0e9f6e] text-white'
                      : 'bg-[#3a3f5c] hover:bg-[#2c314a] text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isCreditSettled
                      ? 'Credit Settled ✓'
                      : `Simulate Payment (₹${(activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250).toFixed(2)})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="h-12 px-5 rounded-full border border-[#e6e6e6] hover:bg-gray-50 text-xs sm:text-sm text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Next Customer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 4: DISTRIBUTOR INVOICE & RESTOCK                              */}
      {/* ================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white rounded-[32px] p-8 sm:p-12 border border-[#e6e6e6] shadow-xs space-y-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-sm text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Counter</span>
            </button>
            <span className="text-xs text-[#717171]">Wholesaler Invoice Audit</span>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            <div>
              <h2 className="text-2xl sm:text-3xl font-medium text-[#3d3d3d] tracking-tight">
                Distributor Invoice Scanner & Restock
              </h2>
              <p className="text-sm text-[#717171] mt-1">
                Upload distributor delivery bill to detect price hikes and auto-draft reorders
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
                  {isAnalyzingBill ? 'Analyzing with OCR...' : 'Load Sample Wholesaler Bill'}
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
                    onClick={handleDispatchPO}
                    disabled={isSendingPO || !!poResult}
                    className="h-12 px-7 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{poResult ? 'PO Dispatched to WhatsApp ✓' : 'Dispatch PO via WhatsApp'}</span>
                  </button>
                </div>

                {showPOPreview && billAnalysis.draft_po && (
                  <div className="p-4 rounded-xl bg-[#fcfcfc] border border-[#e6e6e6] text-xs font-mono text-[#3d3d3d] space-y-1">
                    <p className="font-semibold">PURCHASE ORDER: #{billAnalysis.draft_po.po_number}</p>
                    <p>To: {billAnalysis.draft_po.supplier_name}</p>
                    <div className="py-1">
                      {billAnalysis.draft_po.items.map((it, i) => (
                        <p key={i}>• {it.quantity}x {it.sku} @ ₹{it.expected_rate}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
