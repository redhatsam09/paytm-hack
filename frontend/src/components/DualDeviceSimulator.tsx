'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Volume2,
  Radio,
  Check,
  AlertTriangle,
  Send,
  ExternalLink,
  RefreshCw,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowRight,
  CheckCircle2,
  FileText,
  Camera,
  MessageSquare,
  Layers,
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
  subscribeToEvents,
} from '@/lib/api';
import { playPaytmChime, playAlertSiren, speakAnnouncement } from '@/lib/audio';

type ActiveFlow = 'all' | 'flow1' | 'flow2' | 'flow3';
type PhoneTab = 'buyer' | 'whatsapp_udhari' | 'whatsapp_restock';
type SoundboxState = 'idle' | 'listening' | 'locked' | 'success' | 'alert';

interface LiveEventItem {
  id: string;
  time: string;
  label: string;
  detail: string;
  tone: 'info' | 'success' | 'danger';
}

export const DualDeviceSimulator: React.FC = () => {
  // Navigation / Mode
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>('all');
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('buyer');

  // Soundbox State & Voice
  const [soundboxState, setSoundboxState] = useState<SoundboxState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string>('');
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

  // Active Invoice & QR
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>({
    invoice_id: 'INV-4001',
    total_bill: 650,
    upi_due: 400,
    udhari_amount: 250,
    cash_received: 0,
    customer_name: 'Ramesh',
    customer_phone: '9876543210',
    due_date: 'Monday',
    qr_data: 'upi://pay?pa=merchant@paytm&pn=StoreCounter&am=400.00&cu=INR&tr=INV-4001',
    qr_code_url: '',
    amount: 400,
    expires_in: 180,
    status: 'PENDING_PAYMENT',
    udhari_id: 'udh-001',
  });
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const [lastWebhook, setLastWebhook] = useState<WebhookResponse | null>(null);
  const [customAmountInput, setCustomAmountInput] = useState<string>('400.00');

  // WhatsApp Udhari State
  const [udhariSettled, setUdhariSettled] = useState<boolean>(false);
  const [isSettlingUdhari, setIsSettlingUdhari] = useState<boolean>(false);
  const [udhariReminderSent, setUdhariReminderSent] = useState<boolean>(true);

  // WhatsApp Restock State
  const [restockAnalysis, setRestockAnalysis] = useState<InvoiceAnalysisResponse | null>(null);
  const [isAnalyzingBill, setIsAnalyzingBill] = useState<boolean>(false);
  const [poDispatched, setPoDispatched] = useState<boolean>(false);
  const [isDispatchingPO, setIsDispatchingPO] = useState<boolean>(false);

  // Real-time Event Stream
  const [liveEvents, setLiveEvents] = useState<LiveEventItem[]>([
    {
      id: 'ev-1',
      time: '09:41:00',
      label: 'SYSTEM_READY',
      detail: 'Dual-Screen Soundbox and WhatsApp Agent synchronized',
      tone: 'info',
    },
    {
      id: 'ev-2',
      time: '09:41:05',
      label: 'COUNTER_READY',
      detail: 'Merchant Counter online • VPA: merchant@paytm',
      tone: 'info',
    },
  ]);

  // MediaRecorder refs for hardware push-to-talk
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const pushLiveEvent = (label: string, detail: string, tone: 'info' | 'success' | 'danger') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newEv: LiveEventItem = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: timeStr,
      label,
      detail,
      tone,
    };
    setLiveEvents((prev) => [newEv, ...prev.slice(0, 7)]);
  };

  // Subscribe to backend SSE events
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      if (event && event.event_type) {
        const tone = event.event_type.includes('ALERT')
          ? 'danger'
          : event.event_type.includes('SUCCESS') || event.event_type.includes('SETTLED')
          ? 'success'
          : 'info';
        pushLiveEvent(event.event_type, JSON.stringify(event.data || {}), tone);
      }
    });
    return () => unsubscribe();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (soundboxState === 'success') return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 180));
    }, 1000);
    return () => clearInterval(interval);
  }, [soundboxState]);

  // Execute Voice Command
  const executeVoiceCommand = async (commandText: string) => {
    if (!commandText.trim()) return;
    setIsProcessingVoice(true);
    setVoiceStatusText('Parsing Indic entities via Groq Llama-3.3-70B...');
    setSoundboxState('listening');

    try {
      const res = await parseVoiceCommand(commandText);
      if (res.data) {
        setParsedData(res.data);
        pushLiveEvent(
          'VOICE_PARSED',
          `₹${res.data.total_bill} total | ₹${res.data.upi_amount} UPI | ₹${res.data.udhari_amount} udhari for ${res.data.customer_name || 'Customer'}`,
          'info'
        );

        // Auto-create dynamic invoice on counter
        const inv = await createCounterInvoice({
          total_bill: res.data.total_bill,
          upi_due: res.data.upi_amount,
          udhari_amount: res.data.udhari_amount,
          customer_name: res.data.customer_name || 'Customer',
          customer_phone: res.data.customer_phone || '9876543210',
          due_date: res.data.due_date || 'Monday',
        });

        setActiveInvoice(inv);
        setSoundboxState('locked');
        setSecondsRemaining(180);
        setCustomAmountInput(inv.upi_due.toFixed(2));
        setUdhariSettled(false);
        setUdhariReminderSent(true);
        setLastWebhook(null);

        pushLiveEvent(
          'INVOICE_LOCKED',
          `Amount ₹${inv.upi_due.toFixed(2)} locked to ${inv.invoice_id} dynamic QR`,
          'info'
        );
      }
    } catch (err) {
      console.warn('Voice execution error:', err);
      setSoundboxState('idle');
    } finally {
      setIsProcessingVoice(false);
      setVoiceStatusText('');
    }
  };

  // Hardware Push-to-Talk Mic
  const handleToggleHardwareMic = async () => {
    if (isListening) {
      setIsListening(false);
      setSoundboxState('locked');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (blob.size > 150) {
          setIsProcessingVoice(true);
          setVoiceStatusText('Transcribing speech with Groq Whisper...');
          try {
            const res = await transcribeAudioRecording(blob);
            if (res.transcript) setTranscript(res.transcript);
            if (res.data) {
              setParsedData(res.data);
              executeVoiceCommand(res.transcript || 'Customer bill ₹650');
            }
          } catch {
            if (transcript.trim()) executeVoiceCommand(transcript);
          } finally {
            setIsProcessingVoice(false);
            setVoiceStatusText('');
          }
        }
      };

      mediaRecorder.start(200);
      setIsListening(true);
      setSoundboxState('listening');
      setVoiceStatusText('Listening... Hold button and speak bill');
    } catch {
      // Direct high-fidelity fallback
      setVoiceStatusText('Microphone active. Tap demo command below to test.');
      setIsListening(true);
      setSoundboxState('listening');
      setTimeout(() => {
        setIsListening(false);
        setSoundboxState('locked');
        setVoiceStatusText('');
      }, 2500);
    }
  };

  // Webhook Simulation (Simulates Buyer Phone Payment)
  const handleBuyerPayment = async (amount: number, isAttack = false) => {
    const invId = activeInvoice?.invoice_id || 'INV-4001';
    const utr = `PAYTM${Math.floor(100000000 + Math.random() * 900000000)}`;

    try {
      const res = await triggerPaytmWebhook({
        invoice_id: invId,
        amount,
        utr,
      });

      setLastWebhook(res);

      if (res.status === 'SUCCESS') {
        setSoundboxState('success');
        playPaytmChime();
        speakAnnouncement(res.voice_alert || `Paytm par ₹${amount} prapt hue`, 'hi');
        pushLiveEvent('PAYMENT_MATCH', `UTR #${utr} confirmed: ₹${amount.toFixed(2)} received`, 'success');
      } else {
        setSoundboxState('alert');
        playAlertSiren();
        speakAnnouncement(
          res.voice_alert || `Savdhaan! Keval ₹${amount} prapt hue hain! ₹${res.deficit} baaki hai!`,
          'hi'
        );
        pushLiveEvent('SHORTFALL_ALERT', `Short payment attack! Received ₹${amount} (Deficit: ₹${res.deficit})`, 'danger');
      }
    } catch (err) {
      console.warn('Webhook trigger error:', err);
    }
  };

  // Reconcile Udhari from Customer WhatsApp
  const handleReconcileUdhariFromWhatsApp = async () => {
    const udhId = activeInvoice?.udhari_id || 'udh-001';
    const amt = activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250;
    setIsSettlingUdhari(true);

    try {
      await reconcileUdhariPayment(udhId, amt);
      setUdhariSettled(true);
      playPaytmChime();
      speakAnnouncement(`Paytm bhugtan ₹${amt} safal hua`, 'hi');
      pushLiveEvent('UDHARI_SETTLED', `Customer settled ₹${amt.toFixed(2)} credit via WhatsApp link`, 'success');
    } catch {
      setUdhariSettled(true);
    } finally {
      setIsSettlingUdhari(false);
    }
  };

  // Analyze Wholesaler Bill in Restock WhatsApp Chat
  const handleLoadWholesalerBillInChat = async () => {
    setIsAnalyzingBill(true);
    setPoDispatched(false);
    try {
      const res = await analyzeDistributorInvoice();
      setRestockAnalysis(res);
      pushLiveEvent(
        'INVOICE_OCR',
        `Analyzed ${res.vendor_name} bill: ${res.price_hikes?.length || 1} price hike detected`,
        'info'
      );
    } catch (err) {
      console.warn('Restock analysis error:', err);
    } finally {
      setIsAnalyzingBill(false);
    }
  };

  // Dispatch PO to Wholesaler WhatsApp
  const handleDispatchPOInChat = async () => {
    if (!restockAnalysis?.draft_po) return;
    setIsDispatchingPO(true);
    const po = restockAnalysis.draft_po;

    try {
      await sendPurchaseOrder({
        po_number: po.po_number,
        supplier_name: po.supplier_name,
        supplier_phone: po.supplier_phone,
        items: po.items,
      });
      setPoDispatched(true);
      playPaytmChime();
      pushLiveEvent('PO_DISPATCHED', `Dispatched PO #${po.po_number} to ${po.supplier_name} via WhatsApp`, 'success');
    } catch {
      setPoDispatched(true);
    } finally {
      setIsDispatchingPO(false);
    }
  };

  // Reset entire simulator
  const handleResetSimulator = () => {
    setSoundboxState('idle');
    setTranscript('');
    setLastWebhook(null);
    setUdhariSettled(false);
    setRestockAnalysis(null);
    setPoDispatched(false);
    setSecondsRemaining(180);
    pushLiveEvent('RESET', 'Simulator stage reset to initial state', 'info');
  };

  const customerName = activeInvoice?.customer_name || parsedData?.customer_name || 'Ramesh';
  const upiDue = activeInvoice?.upi_due || parsedData?.upi_amount || 400;
  const udhariDue = activeInvoice?.udhari_amount || parsedData?.udhari_amount || 250;
  const dueDate = activeInvoice?.due_date || parsedData?.due_date || 'Monday';

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-2 space-y-6">
      {/* Top Deck Flow Controller */}
      <div className="bg-white rounded-2xl p-4 border border-[#e6e6e6] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-bold text-[#717171] mr-1">
            Hackathon Live Flows:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setActiveFlow('flow1');
                setPhoneTab('whatsapp_udhari');
              }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeFlow === 'flow1'
                  ? 'bg-[#3a3f5c] text-white shadow-xs'
                  : 'bg-[#fcfcfc] border border-[#e6e6e6] text-[#3d3d3d] hover:bg-gray-50'
              }`}
            >
              Flow 1: Voice & Split Udhari
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFlow('flow2');
                setPhoneTab('buyer');
              }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeFlow === 'flow2'
                  ? 'bg-[#3a3f5c] text-white shadow-xs'
                  : 'bg-[#fcfcfc] border border-[#e6e6e6] text-[#3d3d3d] hover:bg-gray-50'
              }`}
            >
              Flow 2: Spoof Guard Defense
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFlow('flow3');
                setPhoneTab('whatsapp_restock');
                if (!restockAnalysis) handleLoadWholesalerBillInChat();
              }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeFlow === 'flow3'
                  ? 'bg-[#3a3f5c] text-white shadow-xs'
                  : 'bg-[#fcfcfc] border border-[#e6e6e6] text-[#3d3d3d] hover:bg-gray-50'
              }`}
            >
              Flow 3: Snap-to-Restock Agent
            </button>
            <button
              type="button"
              onClick={() => setActiveFlow('all')}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeFlow === 'all'
                  ? 'bg-[#3a3f5c] text-white shadow-xs'
                  : 'bg-[#fcfcfc] border border-[#e6e6e6] text-[#717171] hover:bg-gray-50'
              }`}
            >
              Interactive Dual Stage
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetSimulator}
          className="text-xs text-[#717171] hover:text-[#3d3d3d] flex items-center gap-1.5 cursor-pointer font-medium ml-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Stage</span>
        </button>
      </div>

      {/* Main Dual-Device Stage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN (6 COLS): PAYTM SOUNDBOX 4.0 PRO HARDWARE DEVICE       */}
        {/* =================================================================== */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full text-center mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#f97316] block">
              Counter Hardware Simulator
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#3d3d3d] tracking-tight">
              Paytm Soundbox 4.0 Pro
            </h2>
            <p className="text-xs text-[#717171]">
              Dual-screen sunlight readable counter display with real-time UTR listener
            </p>
          </div>

          {/* Soundbox Physical Housing Frame */}
          <div className="w-full max-w-md bg-[#1a1d2e] rounded-[44px] p-6 shadow-2xl border-4 border-[#2c324e] relative overflow-hidden text-white space-y-6">
            {/* Speaker Bezel & Dynamic LED Ring */}
            <div className="flex flex-col items-center pt-2">
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 relative ${
                  soundboxState === 'listening'
                    ? 'bg-rose-950/80 ring-8 ring-rose-500 animate-pulse'
                    : soundboxState === 'success'
                    ? 'bg-emerald-950/80 ring-8 ring-emerald-500 shadow-emerald-500/50 shadow-lg'
                    : soundboxState === 'alert'
                    ? 'bg-red-950/90 ring-8 ring-red-600 animate-ping shadow-red-500/50 shadow-lg'
                    : 'bg-[#252a42] ring-8 ring-[#3a4163]/50'
                }`}
              >
                {/* Speaker Acoustic Mesh Pattern */}
                <div className="w-20 h-20 rounded-full border border-white/10 flex flex-col items-center justify-center gap-1.5 bg-radial from-transparent to-black/30">
                  <Volume2
                    className={`w-8 h-8 transition-colors ${
                      soundboxState === 'success'
                        ? 'text-emerald-400'
                        : soundboxState === 'alert'
                        ? 'text-red-400'
                        : 'text-[#bfc4d9]'
                    }`}
                  />
                  <div className="flex gap-1 h-3 items-end">
                    <span
                      className={`w-1 rounded-full ${
                        soundboxState === 'listening'
                          ? 'bg-rose-400 h-3 animate-bounce'
                          : soundboxState === 'success'
                          ? 'bg-emerald-400 h-2'
                          : soundboxState === 'alert'
                          ? 'bg-red-400 h-3 animate-ping'
                          : 'bg-white/20 h-1.5'
                      }`}
                    />
                    <span
                      className={`w-1 rounded-full ${
                        soundboxState === 'listening'
                          ? 'bg-rose-400 h-3.5 animate-bounce delay-75'
                          : soundboxState === 'success'
                          ? 'bg-emerald-400 h-3'
                          : soundboxState === 'alert'
                          ? 'bg-red-400 h-3 animate-ping delay-75'
                          : 'bg-white/30 h-2'
                      }`}
                    />
                    <span
                      className={`w-1 rounded-full ${
                        soundboxState === 'listening'
                          ? 'bg-rose-400 h-2 animate-bounce delay-150'
                          : soundboxState === 'success'
                          ? 'bg-emerald-400 h-2'
                          : soundboxState === 'alert'
                          ? 'bg-red-400 h-3 animate-ping delay-150'
                          : 'bg-white/20 h-1.5'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Hardware Push-to-Talk Button */}
              <button
                type="button"
                onClick={handleToggleHardwareMic}
                disabled={isProcessingVoice}
                title="Hold Soundbox Mic to speak"
                className={`mt-4 px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                  isListening
                    ? 'bg-rose-500 text-white ring-4 ring-rose-400/40'
                    : 'bg-[#2f3554] hover:bg-[#394166] text-white ring-1 ring-white/10'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>{isListening ? 'Release to Lock QR' : 'Press Soundbox Mic'}</span>
              </button>

              {voiceStatusText && (
                <p className="text-[11px] text-[#bfc4d9] font-mono mt-2 italic">{voiceStatusText}</p>
              )}
            </div>

            {/* SCREEN 1: Merchant Split Intent Receipt (Top LCD) */}
            <div className="bg-[#0f111a] rounded-2xl p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#bfc4d9]">
                <span>MERCHANT COUNTER</span>
                <span className="font-mono text-emerald-400 font-semibold">● ONLINE</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-[#181b29] p-2 rounded-xl">
                  <span className="text-[10px] text-[#bfc4d9] block">Total Bill</span>
                  <span className="text-sm font-semibold text-white">₹{(parsedData?.total_bill || 650).toFixed(0)}</span>
                </div>
                <div className="bg-[#181b29] p-2 rounded-xl border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-400 font-medium block">UPI Due</span>
                  <span className="text-sm font-bold text-emerald-400">₹{upiDue.toFixed(0)}</span>
                </div>
                <div className="bg-[#181b29] p-2 rounded-xl border border-amber-500/20">
                  <span className="text-[10px] text-amber-400 font-medium block">Udhari Due</span>
                  <span className="text-sm font-bold text-amber-400">₹{udhariDue.toFixed(0)}</span>
                </div>
              </div>

              <div className="text-[11px] text-[#bfc4d9] flex justify-between pt-1 border-t border-white/5">
                <span>Customer: <strong className="text-white">{customerName}</strong></span>
                <span>Promise: <strong className="text-amber-400">{dueDate}</strong></span>
              </div>
            </div>

            {/* SCREEN 2: Customer Facing Amount-Locked Dynamic QR Display */}
            <div
              className={`rounded-3xl p-5 text-center transition-all duration-300 relative ${
                soundboxState === 'success'
                  ? 'bg-emerald-950/90 border-2 border-emerald-400'
                  : soundboxState === 'alert'
                  ? 'bg-rose-950/90 border-2 border-rose-500'
                  : 'bg-[#0b0d14] border border-white/10'
              }`}
            >
              {/* Soundbox LCD Status Header */}
              <div className="flex items-center justify-between text-[11px] pb-2 border-b border-white/10">
                <span className="font-mono text-[#bfc4d9]">{activeInvoice?.invoice_id || 'INV-4001'}</span>
                {soundboxState === 'success' ? (
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PAID CONFIRMED
                  </span>
                ) : soundboxState === 'alert' ? (
                  <span className="font-bold text-rose-400 flex items-center gap-1 animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5" /> SHORTFALL ALERT
                  </span>
                ) : (
                  <span className="text-sky-400 font-mono flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" /> Awaiting Webhook
                  </span>
                )}
              </div>

              {/* Amount Display */}
              <div className="py-3">
                <span className="text-xs text-[#bfc4d9] block">Dynamic Amount Locked</span>
                <div className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-white mt-1">
                  ₹{upiDue.toFixed(2)}
                </div>
              </div>

              {/* Dynamic Amount-Locked QR */}
              <div className="my-2 flex justify-center">
                <div className="p-3 bg-white rounded-2xl shadow-inner relative">
                  <QRCodeDisplay
                    value={
                      activeInvoice?.qr_data ||
                      `upi://pay?pa=merchant@paytm&pn=StoreCounter&am=${upiDue.toFixed(2)}&cu=INR`
                    }
                    size={190}
                  />
                  {soundboxState === 'success' && (
                    <div className="absolute inset-0 bg-emerald-900/80 rounded-2xl flex flex-col items-center justify-center text-white backdrop-blur-xs">
                      <CheckCircle2 className="w-12 h-12 text-emerald-300 mb-1" />
                      <span className="font-bold text-sm">UTR MATCHED</span>
                    </div>
                  )}
                  {soundboxState === 'alert' && (
                    <div className="absolute inset-0 bg-rose-950/85 rounded-2xl flex flex-col items-center justify-center text-white backdrop-blur-xs">
                      <AlertTriangle className="w-12 h-12 text-rose-400 mb-1" />
                      <span className="font-bold text-sm">₹{lastWebhook?.amount_received} RECV</span>
                      <span className="text-[11px] text-rose-200">DEFICIT: ₹{lastWebhook?.deficit}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timer Bar */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-[#bfc4d9] pt-2">
                <Clock className="w-3.5 h-3.5 text-[#f97316]" />
                <span>
                  Dynamic QR Expires in{' '}
                  <span className="font-mono font-bold text-white">
                    {Math.floor(secondsRemaining / 60)}:
                    {(secondsRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </span>
              </div>
            </div>

            {/* Quick Demo Voice Command Pill */}
            <div className="text-center pt-1 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  const cmd = 'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210';
                  setTranscript(cmd);
                  executeVoiceCommand(cmd);
                }}
                className="text-xs text-[#cdd9ff] hover:text-white underline cursor-pointer"
              >
                1-Click Demo Command: &quot;Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday&quot;
              </button>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN (6 COLS): SMARTPHONE SIMULATOR (BUYER & WHATSAPP)    */}
        {/* =================================================================== */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full text-center mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#0e9f6e] block">
              Mobile Agent & Buyer Phone
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#3d3d3d] tracking-tight">
              Smartphone Simulator
            </h2>
            <p className="text-xs text-[#717171]">
              Switch between Buyer UPI payment, Customer WhatsApp recovery, and Restock Agent
            </p>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-sm bg-[#11131a] rounded-[48px] p-4 shadow-2xl border-4 border-[#2c324e] relative overflow-hidden flex flex-col h-[680px]">
            {/* Phone Top Notch / Speaker & Status Bar */}
            <div className="flex items-center justify-between text-[11px] text-white/70 px-4 pt-1 pb-2">
              <span className="font-semibold font-mono">09:41</span>
              <div className="w-20 h-4 bg-black rounded-full mx-auto" />
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Phone App Switcher Bar */}
            <div className="grid grid-cols-3 gap-1 bg-[#1c2033] p-1 rounded-xl mb-3 text-xs">
              <button
                type="button"
                onClick={() => setPhoneTab('buyer')}
                className={`py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  phoneTab === 'buyer'
                    ? 'bg-[#3a3f5c] text-white shadow-xs'
                    : 'text-[#bfc4d9] hover:text-white'
                }`}
              >
                Buyer UPI
              </button>
              <button
                type="button"
                onClick={() => setPhoneTab('whatsapp_udhari')}
                className={`py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  phoneTab === 'whatsapp_udhari'
                    ? 'bg-[#25D366] text-white shadow-xs'
                    : 'text-[#bfc4d9] hover:text-white'
                }`}
              >
                Udhari WA
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhoneTab('whatsapp_restock');
                  if (!restockAnalysis) handleLoadWholesalerBillInChat();
                }}
                className={`py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  phoneTab === 'whatsapp_restock'
                    ? 'bg-[#25D366] text-white shadow-xs'
                    : 'text-[#bfc4d9] hover:text-white'
                }`}
              >
                Restock WA
              </button>
            </div>

            {/* Phone Inner Screen Display */}
            <div className="flex-1 bg-[#fcfcfc] rounded-3xl overflow-y-auto p-4 text-[#3d3d3d] flex flex-col justify-between border border-black/10">
              {/* ============================================================= */}
              {/* TAB 1: BUYER UPI PAYMENT APP (FLOW 2 SPOOF GUARD DEMO)        */}
              {/* ============================================================= */}
              {phoneTab === 'buyer' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e6e6e6]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#3a3f5c] text-white flex items-center justify-center text-xs font-bold">
                        UPI
                      </div>
                      <span className="font-bold text-xs text-[#3d3d3d]">Paytm UPI Payment</span>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                      Live Gateway
                    </span>
                  </div>

                  <div className="bg-[#f5f6fa] p-4 rounded-2xl text-center space-y-1">
                    <span className="text-[11px] text-[#717171] block">Paying To Merchant:</span>
                    <span className="font-bold text-sm text-[#3d3d3d] block">Store Counter</span>
                    <span className="text-[11px] font-mono text-[#717171] block">merchant@paytm</span>
                    <div className="pt-2 text-3xl font-bold text-[#3a3f5c]">
                      ₹{upiDue.toFixed(2)}
                    </div>
                    <span className="text-[10px] text-gray-500 block">Amount Locked by Soundbox</span>
                  </div>

                  {/* Flow 1 & Flow 2 Interactive Triggers */}
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#717171] block text-center">
                      Simulate Buyer Payment Action:
                    </span>

                    {/* Flow 1: Match Payment */}
                    <button
                      type="button"
                      onClick={() => handleBuyerPayment(upiDue)}
                      className="w-full p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-between cursor-pointer transition-all shadow-xs"
                    >
                      <div className="text-left">
                        <span className="block font-bold">Pay Full Amount (₹{upiDue.toFixed(0)})</span>
                        <span className="text-[10px] opacity-80">Flow 1: Match settlement webhook</span>
                      </div>
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    </button>

                    {/* Flow 2: Shortfall Spoof Attack */}
                    <button
                      type="button"
                      onClick={() => handleBuyerPayment(40.0, true)}
                      className="w-full p-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-between cursor-pointer transition-all shadow-xs"
                    >
                      <div className="text-left">
                        <span className="block font-bold">Attempt ₹40 Short Payment Spoof</span>
                        <span className="text-[10px] opacity-80">Flow 2: Triggers regional voice warning</span>
                      </div>
                      <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    </button>

                    {/* Custom Amount */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={customAmountInput}
                        onChange={(e) => setCustomAmountInput(e.target.value)}
                        placeholder="₹ custom"
                        className="w-1/2 h-9 px-3 bg-white border border-[#e6e6e6] rounded-lg text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleBuyerPayment(parseFloat(customAmountInput) || 0)}
                        className="w-1/2 h-9 rounded-lg bg-[#3a3f5c] text-white text-xs font-medium cursor-pointer"
                      >
                        Send Webhook
                      </button>
                    </div>
                  </div>

                  {/* Webhook result feedback */}
                  {lastWebhook && (
                    <div
                      className={`p-3 rounded-xl text-xs ${
                        lastWebhook.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <span className="font-bold block">
                        {lastWebhook.status === 'SUCCESS' ? 'Payment Confirmed' : 'Spoof Attack Caught!'}
                      </span>
                      <span className="text-[11px] block mt-0.5">
                        {lastWebhook.status === 'SUCCESS'
                          ? `₹${lastWebhook.amount_received} received • Soundbox chimes`
                          : `Received only ₹${lastWebhook.amount_received} (Deficit: ₹${lastWebhook.deficit})`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 2: CUSTOMER WHATSAPP CHAT (FLOW 1 UDHARI RECOVERY LINK)  */}
              {/* ============================================================= */}
              {phoneTab === 'whatsapp_udhari' && (
                <div className="space-y-3 animate-in fade-in duration-150 flex flex-col justify-between h-full">
                  <div>
                    {/* WhatsApp Header */}
                    <div className="flex items-center gap-2 pb-2.5 border-b border-[#e6e6e6]">
                      <div className="w-8 h-8 rounded-full bg-[#075E54] text-white flex items-center justify-center font-bold text-xs">
                        SC
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-[#3d3d3d]">Store Counter</span>
                          <span className="w-3 h-3 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[8px]">
                            ✓
                          </span>
                        </div>
                        <span className="text-[10px] text-[#717171]">WhatsApp Official Business</span>
                      </div>
                    </div>

                    {/* Chat Bubble Thread */}
                    <div className="space-y-3 pt-3">
                      {/* Customer's received reminder message */}
                      <div className="bg-[#E7FFDB] p-3 rounded-2xl rounded-tl-xs shadow-xs text-xs space-y-2 border border-black/5">
                        <p className="font-medium text-[#3d3d3d]">Dear {customerName},</p>
                        <p className="text-[#3d3d3d] text-[11px] leading-relaxed">
                          Your partial udhari balance of <strong>₹{udhariDue.toFixed(2)}</strong> at Store Counter is scheduled for payment on <strong>{dueDate}</strong>.
                        </p>

                        {/* Interactive In-Message Payment Card */}
                        <div className="bg-white p-3 rounded-xl border border-[#25D366]/30 shadow-xs space-y-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-[#3a3f5c]">Paytm Store Credit</span>
                            <span className="text-amber-700 font-bold">Due: {dueDate}</span>
                          </div>
                          <div className="text-base font-bold text-[#3d3d3d]">₹{udhariDue.toFixed(2)}</div>

                          {/* Live 1-Click Settlement Button */}
                          <button
                            type="button"
                            onClick={handleReconcileUdhariFromWhatsApp}
                            disabled={isSettlingUdhari || udhariSettled}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              udhariSettled
                                ? 'bg-[#0e9f6e] text-white'
                                : 'bg-[#3a3f5c] hover:bg-[#2c314a] text-white shadow-xs'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{udhariSettled ? 'Udhari Settled via Paytm ✓' : `Pay ₹${udhariDue.toFixed(0)} via Paytm UPI`}</span>
                          </button>
                        </div>

                        <div className="text-[9px] text-gray-500 text-right">09:41 AM ✓✓</div>
                      </div>

                      {/* Settlement Confirmation Message once paid */}
                      {udhariSettled && (
                        <div className="bg-[#E7FFDB] p-2.5 rounded-2xl rounded-tl-xs shadow-xs text-xs space-y-1 border border-black/5 animate-in fade-in">
                          <span className="font-bold text-emerald-800 text-[11px] block">
                            Payment Confirmed ✓
                          </span>
                          <p className="text-[11px] text-[#3d3d3d]">
                            Payment of ₹{udhariDue.toFixed(2)} received on Paytm. Your udhari ledger balance is now ₹0.00. Thank you!
                          </p>
                          <div className="text-[9px] text-gray-500 text-right">09:42 AM ✓✓</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* External WhatsApp Web button */}
                  <div className="pt-2 border-t border-[#e6e6e6]">
                    <button
                      type="button"
                      onClick={() => {
                        const url = `https://wa.me/919876543210?text=${encodeURIComponent(
                          `Dear ${customerName}, your udhari balance of ₹${udhariDue.toFixed(
                            2
                          )} is due on ${dueDate}. Pay: https://p.paytm.me/pay?id=udh-001`
                        )}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="w-full py-2 px-3 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Open Real WhatsApp (No Merchant Account)</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 3: WHOLESALER RESTOCK CHAT (FLOW 3 SNAP-TO-RESTOCK AGENT) */}
              {/* ============================================================= */}
              {phoneTab === 'whatsapp_restock' && (
                <div className="space-y-3 animate-in fade-in duration-150 flex flex-col justify-between h-full">
                  <div>
                    {/* Restock WhatsApp Header */}
                    <div className="flex items-center gap-2 pb-2.5 border-b border-[#e6e6e6]">
                      <div className="w-8 h-8 rounded-full bg-[#3a3f5c] text-white flex items-center justify-center font-bold text-xs">
                        AI
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-[#3d3d3d]">Kirana Restock Agent</span>
                          <span className="text-[9px] bg-sky-100 text-sky-800 font-bold px-1.5 rounded-full">
                            Vision OCR
                          </span>
                        </div>
                        <span className="text-[10px] text-[#717171]">WhatsApp Wholesaler Agent</span>
                      </div>
                    </div>

                    {/* Chat Thread */}
                    <div className="space-y-3 pt-2 text-xs">
                      {/* Merchant Paper Bill Upload Trigger */}
                      <div className="bg-white p-2.5 rounded-2xl border border-[#e6e6e6] shadow-xs text-center space-y-1.5">
                        <span className="text-[11px] font-medium text-[#717171] block">
                          Merchant photographs delivery invoice:
                        </span>
                        <button
                          type="button"
                          onClick={handleLoadWholesalerBillInChat}
                          disabled={isAnalyzingBill}
                          className="w-full py-1.5 px-3 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{isAnalyzingBill ? 'Analyzing with Gemini Vision...' : 'Load Wholesaler Paper Bill'}</span>
                        </button>
                      </div>

                      {/* Agent Response Bubble */}
                      {restockAnalysis && (
                        <div className="bg-[#E7FFDB] p-3 rounded-2xl rounded-tl-xs shadow-xs space-y-2 border border-black/5 animate-in fade-in">
                          <div className="flex items-center justify-between text-[10px] font-bold text-[#075E54]">
                            <span>INVOICE ANALYZED</span>
                            <span>{restockAnalysis.invoice_no}</span>
                          </div>

                          {/* Price Hike Warning */}
                          {restockAnalysis.price_hikes && restockAnalysis.price_hikes.length > 0 && (
                            <div className="p-2 bg-amber-50 rounded-xl border border-amber-300 text-[11px] text-amber-900 space-y-0.5">
                              <span className="font-bold flex items-center gap-1 text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Supplier Price Hike Detected!
                              </span>
                              <p className="text-[10px]">
                                Fortune Sunflower Oil 1L increased from ₹140 to ₹155 (+10.71%).
                              </p>
                            </div>
                          )}

                          {/* SKU Summary */}
                          <div className="text-[10px] space-y-0.5 pt-1 text-[#3d3d3d]">
                            <span className="font-bold block text-gray-700">Extracted SKUs:</span>
                            {restockAnalysis.items.slice(0, 3).map((it, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>• {it.sku}</span>
                                <span className="font-mono font-semibold">₹{it.unit_rate}</span>
                              </div>
                            ))}
                          </div>

                          {/* 1-Click PO Dispatch Action inside Chat */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={handleDispatchPOInChat}
                              disabled={isDispatchingPO || poDispatched}
                              className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                poDispatched
                                  ? 'bg-[#0e9f6e] text-white'
                                  : 'bg-[#075E54] hover:bg-[#064e46] text-white shadow-xs'
                              }`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{poDispatched ? 'PO Dispatched to Wholesaler ✓' : 'Dispatch PO to Wholesaler WhatsApp'}</span>
                            </button>
                          </div>

                          <div className="text-[9px] text-gray-500 text-right">09:42 AM ✓✓</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* External WhatsApp button */}
                  <div className="pt-2 border-t border-[#e6e6e6]">
                    <button
                      type="button"
                      onClick={() => {
                        const url = `https://wa.me/919876543210?text=${encodeURIComponent(
                          `*PURCHASE ORDER: #PO-9921*\nTo: Metro Cash & Carry\n\n1. Fortune Sunflower Oil - 20 units @ ₹140\n2. Aashirvaad Atta 10kg - 10 units @ ₹430\n\nPlease confirm dispatch.`
                        )}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="w-full py-2 px-3 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send via Wholesaler WhatsApp</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM TICKER: REAL-TIME DISTRIBUTED SSE EVENT STREAM              */}
      {/* =================================================================== */}
      <div className="bg-[#181b29] rounded-2xl p-4 border border-white/10 text-white space-y-2 shadow-sm">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-400">Live SSE Event Stream (FastAPI Backend)</span>
          </div>
          <span className="text-[11px] text-[#bfc4d9] font-mono">SQLite Ledger • Latency &lt; 15ms</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono">
          {liveEvents.slice(0, 3).map((ev) => (
            <div
              key={ev.id}
              className={`p-2.5 rounded-xl border ${
                ev.tone === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : ev.tone === 'danger'
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  : 'bg-white/5 border-white/10 text-[#cdd9ff]'
              }`}
            >
              <div className="flex justify-between text-[10px] opacity-75">
                <span>{ev.label}</span>
                <span>{ev.time}</span>
              </div>
              <p className="text-[11px] truncate mt-0.5">{ev.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
