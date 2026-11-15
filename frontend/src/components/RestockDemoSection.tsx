'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  CheckCheck,
  Clock,
  FileText,
} from 'lucide-react';
import { InvoiceAnalysisResponse, RestockOrderResponse } from '@/types';
import { playPaytmChime } from '@/lib/audio';

interface RestockDemoSectionProps {
  onAnalyzeInvoice: (file?: File) => Promise<void>;
  onSendPO: () => Promise<void>;
  ocrAnalysis: InvoiceAnalysisResponse | null;
  lastPO: RestockOrderResponse | null;
  isAnalyzingOcr: boolean;
  isSendingPO: boolean;
}

export const RestockDemoSection: React.FC<RestockDemoSectionProps> = ({
  onAnalyzeInvoice,
  onSendPO,
  ocrAnalysis,
  lastPO,
  isAnalyzingOcr,
  isSendingPO,
}) => {
  const [hasScanned, setHasScanned] = useState(false);

  const handleScanSample = async () => {
    setHasScanned(true);
    await onAnalyzeInvoice();
  };

  const handleDispatch = async () => {
    playPaytmChime();
    await onSendPO();
  };

  return (
    <section id="flow-restock" className="py-24 border-b border-[#E6EAF5] bg-white">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0E9F6E] mb-2 block">
            Flow 3 Interactive Experience
          </span>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-[#0A1B3D] leading-tight">
            WhatsApp Snap-to-Restock & Price Creep Auditor.
          </h2>
          <p className="text-base text-[#6B7A99] mt-3">
            Photograph distributor paper invoices on WhatsApp. Gemini 2.5 Flash Vision extracts line items, audits historical unit rates, flags unannounced price hikes, and drafts standardized purchase orders.
          </p>
        </div>

        {/* WhatsApp Chat Product Presentation Canvas */}
        <div className="max-w-3xl mx-auto bg-[#EFEAE2] rounded-[8px] border border-[#E6EAF5] shadow-xl overflow-hidden">
          {/* Authentic WhatsApp Business Header */}
          <div className="bg-[#075E54] text-white px-6 py-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#128C7E] text-white flex items-center justify-center font-bold text-sm">
                MC
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">
                  Metro Cash & Carry Wholesaler
                </div>
                <div className="text-xs text-emerald-200">
                  +91 98888 77665 • Verified Distributor Account
                </div>
              </div>
            </div>
            <span className="text-xs bg-[#128C7E] text-white px-2.5 py-1 rounded-[3px] font-medium">
              Restock Agent Active
            </span>
          </div>

          {/* Chat Body with Interactive Flow */}
          <div className="p-6 sm:p-8 flex flex-col gap-4 min-h-[460px] overflow-y-auto">
            {/* Timestamp tag */}
            <div className="text-center my-1">
              <span className="bg-white/90 text-[#6B7A99] text-[11px] px-3 py-1 rounded-[3px] font-medium shadow-2xs">
                Today, 11:32 AM
              </span>
            </div>

            {/* Bubble 1: Storekeeper Uploads Invoice Photo */}
            <div className="self-end max-w-[85%] sm:max-w-[70%] bg-[#DCF8C6] text-[#0A1B3D] p-4 rounded-[6px] shadow-2xs text-xs sm:text-sm border border-emerald-100">
              <div className="flex items-center gap-2 font-bold text-[#075E54] mb-2">
                <FileText className="w-4 h-4" />
                <span>Distributor Invoice Photo Uploaded</span>
              </div>
              <p className="text-xs text-gray-700">
                Invoice_Metro_Nov14_Crumpled.jpg (Paper bill received from delivery agent)
              </p>

              {/* Upload & Trigger Scan Action */}
              {!hasScanned && !ocrAnalysis && (
                <button
                  onClick={handleScanSample}
                  disabled={isAnalyzingOcr}
                  className="w-full mt-3 h-[42px] px-4 bg-[#533AFD] hover:bg-[#4329E0] disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  {isAnalyzingOcr ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  <span>
                    {isAnalyzingOcr ? 'Analyzing with Gemini Vision OCR...' : 'Run Vision OCR & Rate Audit'}
                  </span>
                </button>
              )}

              <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 mt-2">
                <span>11:32 AM</span>
                <CheckCheck className="w-3.5 h-3.5 text-[#533AFD]" />
              </div>
            </div>

            {/* Bubble 2: Gemini Vision OCR Results Extracted */}
            {ocrAnalysis && (
              <div className="self-start max-w-[95%] sm:max-w-[85%] bg-white text-[#0A1B3D] p-5 rounded-[6px] shadow-2xs text-xs sm:text-sm border border-[#E6EAF5] animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-[#0A1B3D] mb-2 pb-2 border-b border-gray-100">
                  <span>
                    {ocrAnalysis.analysis_source === 'GEMINI_VISION' ? 'Gemini Vision OCR' : 'Local OCR Fixture'}
                    : Extracted {ocrAnalysis.items.length} SKUs
                  </span>
                  <span className="text-[#0E9F6E] bg-emerald-50 px-2 py-0.5 rounded-[2px]">
                    Bill #{ocrAnalysis.invoice_no}
                  </span>
                </div>
                <div className={`mb-3 rounded-[4px] border px-3 py-2 text-[11px] ${
                  ocrAnalysis.analysis_source === 'GEMINI_VISION'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-sky-200 bg-sky-50 text-sky-900'
                }`}>
                  <strong>{ocrAnalysis.analysis_source === 'GEMINI_VISION' ? 'LIVE OCR' : 'LOCAL VERIFIED FIXTURE'}</strong>
                  {' — '}
                  {ocrAnalysis.validation_note || 'Results are deterministic demo data and do not claim a supplier API call.'}
                </div>

                {/* Extracted Line Items Table */}
                <div className="overflow-x-auto my-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-[#6B7A99]">
                        <th className="py-1.5">SKU Description</th>
                        <th className="py-1.5 text-center">Qty</th>
                        <th className="py-1.5 text-right">Unit Rate</th>
                        <th className="py-1.5 text-right">Prev Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocrAnalysis.items.map((item, i) => (
                        <tr
                          key={i}
                          className={`border-b border-gray-100 ${
                            item.price_hike_detected ? 'bg-amber-50 font-bold text-amber-950' : ''
                          }`}
                        >
                          <td className="py-1.5 pr-2">{item.sku}</td>
                          <td className="py-1.5 text-center text-gray-600">{item.quantity}</td>
                          <td className="py-1.5 text-right">₹{item.unit_rate}</td>
                          <td className="py-1.5 text-right text-gray-500">
                            {item.previous_rate ? `₹${item.previous_rate}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Price Creep Flagged Callout */}
                {ocrAnalysis.price_hikes && ocrAnalysis.price_hikes.length > 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-[4px] p-3 my-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold text-amber-950 block">
                        ⚠️ Margin Leak: Fortune Sunflower Oil +10.7% Price Hike!
                      </span>
                      <p className="text-amber-900 mt-0.5">
                        Supplier increased unit rate from ₹140 to ₹155 (+₹15/unit) compared against Oct 12 invoice.
                      </p>
                    </div>
                  </div>
                )}

                {/* 1-Click Purchase Order Action */}
                {!lastPO && (
                  <button
                    onClick={handleDispatch}
                    disabled={isSendingPO}
                    className="w-full mt-2 h-[42px] px-4 bg-[#075E54] hover:bg-[#128C7E] disabled:opacity-50 text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>
                      {isSendingPO
                        ? 'Dispatching Purchase Order to Wholesaler...'
                        : 'Draft & 1-Click Dispatch PO #882 to Wholesaler'}
                    </span>
                  </button>
                )}

                <div className="text-[10px] text-gray-400 mt-2 text-right">11:33 AM</div>
              </div>
            )}

            {/* Bubble 3: Purchase Order Dispatched */}
            {lastPO && (
              <div className="self-end max-w-[85%] sm:max-w-[75%] bg-[#DCF8C6] text-[#0A1B3D] p-4 rounded-[6px] shadow-2xs text-xs sm:text-sm border border-emerald-100 animate-in fade-in">
                <div className="flex items-center justify-between font-bold text-emerald-900 text-xs mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    Purchase Order PO-882 Dispatched
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-[2px]">
                    Delivered
                  </span>
                </div>

                <pre className="font-mono text-xs text-gray-800 whitespace-pre-wrap bg-white/80 p-3 rounded-[4px] border border-emerald-200">
                  {lastPO.whatsapp_preview}
                </pre>

                <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 mt-2">
                  <span>11:34 AM</span>
                  <CheckCheck className="w-3.5 h-3.5 text-[#533AFD]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
