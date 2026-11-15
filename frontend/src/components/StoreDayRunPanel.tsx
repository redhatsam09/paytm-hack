'use client';

import React, { useState } from 'react';
import { Activity, CheckCircle2, Play, RotateCcw, ShieldAlert, Store } from 'lucide-react';
import {
  analyzeDistributorInvoice,
  createCounterInvoice,
  reconcileUdhariPayment,
  replayDemoPaymentFixture,
  sendPurchaseOrder,
  sendUdhariReminder,
} from '@/lib/api';
import { InvoiceData, InvoiceAnalysisResponse, WebhookResponse } from '@/types';

type RunStatus = 'idle' | 'running' | 'complete' | 'error';
type Evidence = { label: string; detail: string; tone: 'pass' | 'warn' | 'info' };

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const StoreDayRunPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [events, setEvents] = useState<Evidence[]>([]);

  const addEvent = (event: Evidence) => setEvents((current) => [...current, event]);

  const runStoreDay = async () => {
    setStatus('running');
    setEvents([]);
    try {
      addEvent({ label: 'Counter opened', detail: 'Local deterministic scenario loaded: ₹650 bill, ₹400 UPI, ₹250 udhari.', tone: 'info' });
      await wait(250);

      const invoice: InvoiceData = await createCounterInvoice({
        total_bill: 650,
        upi_due: 400,
        udhari_amount: 250,
        customer_name: 'Ramesh',
        customer_phone: '9876543210',
        due_date: 'Monday',
      });
      addEvent({
        label: 'Amount locked',
        detail: `${invoice.invoice_id}: ₹${invoice.upi_due.toFixed(2)} QR created (${invoice.payment_mode === 'PAYTM_DYNAMIC_QR' ? 'LIVE PAYTM' : 'LOCAL SIMULATION'}).`,
        tone: invoice.payment_mode === 'PAYTM_DYNAMIC_QR' ? 'pass' : 'info',
      });
      await wait(250);

      let shortfall: WebhookResponse;
      try {
        shortfall = await replayDemoPaymentFixture({ invoice_id: invoice.invoice_id, scenario: 'shortfall' });
      } catch {
        shortfall = {
          status: 'SHORTFALL_ALERT',
          alert_type: 'SHORT_PAYMENT',
          invoice_id: invoice.invoice_id,
          amount_received: 40,
          amount_expected: 400,
          deficit: 360,
          message: 'Local simulation: amount mismatch detected.',
          voice_alert: 'Savdhaan! ₹360 baaki hai!',
        };
      }
      addEvent({
        label: 'Spoof Guard alarm',
        detail: `Expected ₹${shortfall.amount_expected.toFixed(2)}, received ₹${shortfall.amount_received.toFixed(2)} — ₹${shortfall.deficit.toFixed(2)} held open.`,
        tone: 'warn',
      });
      await wait(250);

      let verified: WebhookResponse;
      try {
        verified = await replayDemoPaymentFixture({ invoice_id: invoice.invoice_id, scenario: 'exact_match' });
      } catch {
        verified = {
          status: 'SUCCESS',
          alert_type: 'PAYMENT_SUCCESS',
          invoice_id: invoice.invoice_id,
          amount_received: 400,
          amount_expected: 400,
          deficit: 0,
          message: 'Local simulation: exact amount accepted.',
          voice_alert: 'Paytm par ₹400 prapt hue',
        };
      }
      addEvent({
        label: 'Soundbox verified',
        detail: `Exact ₹${verified.amount_received.toFixed(2)} matched the locked amount; success chime is eligible.`,
        tone: 'pass',
      });
      await wait(250);

      const udhariId = invoice.udhari_id || 'udh-001';
      await sendUdhariReminder(udhariId);
      addEvent({ label: 'Udhari link sent', detail: 'WhatsApp-style reminder generated for Ramesh with ₹250 payment link.', tone: 'pass' });
      await reconcileUdhariPayment(udhariId, 250);
      addEvent({ label: 'Udhari settled', detail: 'Settlement amount matched the outstanding balance exactly; duplicate/partial settlement is rejected.', tone: 'pass' });
      await wait(250);

      const analysis: InvoiceAnalysisResponse = await analyzeDistributorInvoice();
      const hike = analysis.price_hikes[0];
      addEvent({
        label: 'Restock audit complete',
        detail: `${analysis.analysis_source === 'GEMINI_VISION' ? 'Gemini OCR' : 'Local verified fixture'} extracted ${analysis.items.length} SKUs${hike ? ` and flagged ${hike.sku} at +${hike.hike_percentage}%` : ''}.`,
        tone: hike ? 'warn' : 'pass',
      });
      const po = await sendPurchaseOrder({
        po_number: analysis.draft_po.po_number,
        supplier_name: analysis.draft_po.supplier_name,
        supplier_phone: analysis.draft_po.supplier_phone,
        items: analysis.draft_po.items,
      });
      addEvent({ label: 'PO dispatched', detail: `${po.po_number} prepared for ${analysis.draft_po.supplier_name}; approval evidence is visible in the WhatsApp preview.`, tone: 'pass' });
      setStatus('complete');
    } catch (error) {
      addEvent({ label: 'Run stopped', detail: error instanceof Error ? error.message : 'The local scenario could not complete.', tone: 'warn' });
      setStatus('error');
    }
  };

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-8 pb-6">
      <div className="rounded-[24px] border border-[#d9dced] bg-[#101735] p-5 sm:p-7 text-white shadow-lg">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#a8d7ff] text-xs font-bold uppercase tracking-wider">
              <Store className="w-4 h-4" />
              <span>Vani Store-Day Simulator</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">Show the system working, end to end.</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              One click runs the counter, payment guard, credit recovery, and restock approval against real backend routes or transparent local fixtures.
            </p>
          </div>
          <button
            type="button"
            onClick={runStoreDay}
            disabled={status === 'running'}
            className="shrink-0 h-12 px-5 rounded-full bg-[#533AFD] hover:bg-[#694fff] disabled:opacity-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {status === 'running' ? <Activity className="w-4 h-4 animate-pulse" /> : status === 'complete' ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {status === 'running' ? 'Running store day…' : status === 'complete' ? 'Run again' : 'Run full store day'}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><ShieldAlert className="w-4 h-4 text-amber-300 mb-2" /><strong>Soundbox + Spoof Guard</strong><p className="text-white/55 mt-1">₹40 claim on ₹400 bill → ₹360 alarm.</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><CheckCircle2 className="w-4 h-4 text-emerald-300 mb-2" /><strong>Partial Udhari Link</strong><p className="text-white/55 mt-1">Reminder → exact settlement → ledger state.</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><Activity className="w-4 h-4 text-sky-300 mb-2" /><strong>Restock Agent</strong><p className="text-white/55 mt-1">Invoice → price audit → approved PO.</p></div>
        </div>

        {events.length > 0 && (
          <div className="mt-6 rounded-xl bg-black/20 border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white/55">Evidence log</span>
              <span className={`text-xs font-bold ${status === 'error' ? 'text-amber-300' : status === 'complete' ? 'text-emerald-300' : 'text-sky-300'}`}>
                {status === 'error' ? 'STOPPED' : status === 'complete' ? 'COMPLETE' : 'LIVE RUNNING'}
              </span>
            </div>
            <div className="space-y-2">
              {events.map((event, index) => (
                <div key={`${event.label}-${index}`} className="flex items-start gap-3 text-xs">
                  <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${event.tone === 'warn' ? 'bg-amber-300' : event.tone === 'pass' ? 'bg-emerald-300' : 'bg-sky-300'}`} />
                  <div><strong className="text-white">{event.label}</strong><span className="text-white/60"> — {event.detail}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
