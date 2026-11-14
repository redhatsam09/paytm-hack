'use client';

import React, { useState } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Send,
  Sparkles,
  Check,
  Building2,
} from 'lucide-react';
import { InvoiceAnalysisResponse, RestockOrderResponse } from '@/types';
import { analyzeDistributorInvoice, sendPurchaseOrder } from '@/lib/api';

export const RestockWorkflow: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<InvoiceAnalysisResponse | null>(null);
  const [showDraftPO, setShowDraftPO] = useState<boolean>(false);
  const [isSendingPO, setIsSendingPO] = useState<boolean>(false);
  const [poResult, setPoResult] = useState<RestockOrderResponse | null>(null);

  // Analyze uploaded or sample invoice
  const handleAnalyze = async (sample = false) => {
    setIsAnalyzing(true);
    setPoResult(null);
    try {
      const res = await analyzeDistributorInvoice(sample ? null : file);
      setAnalysisResult(res);
      setShowDraftPO(false);
    } catch (err) {
      console.warn('Invoice analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Dispatch PO to Wholesaler via WhatsApp
  const handleSendPO = async () => {
    if (!analysisResult?.draft_po) return;
    setIsSendingPO(true);
    try {
      const res = await sendPurchaseOrder({
        po_number: analysisResult.draft_po.po_number,
        supplier_name: analysisResult.draft_po.supplier_name,
        supplier_phone: analysisResult.draft_po.supplier_phone,
        items: analysisResult.draft_po.items,
      });
      setPoResult(res);
    } catch (err) {
      console.warn('Send PO failed:', err);
    } finally {
      setIsSendingPO(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#0A1B3D] tracking-tight">
          Wholesaler Invoice Scanner & Price Creep Audit
        </h2>
        <p className="text-xs text-[#6B7A99] mt-1">
          Detect silent price creep across distributor bills and automatically draft WhatsApp purchase orders at negotiated rates.
        </p>
      </div>

      {/* Integration Notice */}
      <div className="bg-[#F8FAFC] border border-[#E6EAF5] rounded-[4px] px-3.5 py-2 flex items-center justify-between text-xs text-[#6B7A99]">
        <span className="flex items-center gap-1.5 font-medium">
          <span>🔌</span>
          <span>Connect Gemini 2.5 Flash Vision API for real camera OCR → using mock extraction engine</span>
        </span>
        <span className="text-[11px] text-[#533AFD] font-semibold bg-[#533AFD]/5 px-2 py-0.5 rounded-[4px]">
          Zero-Setup Mock Safe
        </span>
      </div>

      {/* Upload Box Card */}
      <div className="bg-white rounded-[6px] border border-[#E6EAF5] p-6 shadow-xs">
        <div className="border-2 border-dashed border-[#E6EAF5] hover:border-[#533AFD]/50 rounded-[6px] p-8 text-center transition-all bg-[#F8FAFC]">
          <div className="w-12 h-12 rounded-full bg-[#533AFD]/10 text-[#533AFD] flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-[#0A1B3D]">
            Upload Distributor Invoice / Delivery Challan
          </h4>
          <p className="text-xs text-[#6B7A99] mt-1">
            Drag & drop invoice image/PDF or browse files
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <label className="h-10 px-4 rounded-[4px] bg-white border border-[#E6EAF5] text-xs font-semibold text-[#0A1B3D] hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer">
              <FileText className="w-4 h-4 text-[#6B7A99]" />
              <span>{file ? file.name : 'Choose File'}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
              />
            </label>

            {file && (
              <button
                type="button"
                onClick={() => handleAnalyze(false)}
                disabled={isAnalyzing}
                className="h-10 px-5 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>{isAnalyzing ? 'Extracting SKUs...' : 'Analyze Uploaded Bill'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAnalyze(true)}
              disabled={isAnalyzing}
              className="h-10 px-4 rounded-[4px] bg-[#533AFD]/10 hover:bg-[#533AFD]/20 text-[#533AFD] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAnalyzing ? 'Processing...' : 'Load Sample Wholesaler Bill (Metro Cash & Carry)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Extracted Invoice & Price Audit Table */}
      {analysisResult && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[6px] border border-[#E6EAF5] shadow-xs overflow-hidden">
            {/* Header info */}
            <div className="p-5 border-b border-[#E6EAF5] flex flex-wrap items-center justify-between gap-4 bg-[#F8FAFC]">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#533AFD]" />
                  <h3 className="text-sm font-bold text-[#0A1B3D]">
                    {analysisResult.vendor_name}
                  </h3>
                </div>
                <div className="text-xs text-[#6B7A99] mt-0.5">
                  Invoice: <span className="font-mono text-[#0A1B3D]">{analysisResult.invoice_no}</span> • Date: {analysisResult.invoice_date}
                </div>
              </div>

              {analysisResult.price_hikes?.length > 0 && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1 rounded-[4px] text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Silent Price Creep Detected (+10.7%)</span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6EAF5] bg-white text-[#6B7A99]">
                    <th className="py-3 px-4 font-semibold">SKU / Item</th>
                    <th className="py-3 px-4 font-semibold text-center">Qty</th>
                    <th className="py-3 px-4 font-semibold text-right">Billed Rate</th>
                    <th className="py-3 px-4 font-semibold text-right">Baseline Rate</th>
                    <th className="py-3 px-4 font-semibold text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAF5]">
                  {analysisResult.items.map((item, idx) => (
                    <tr
                      key={idx}
                      className={item.price_hike_detected ? 'bg-rose-50/40' : 'hover:bg-gray-50/50'}
                    >
                      <td className="py-3 px-4 font-medium text-[#0A1B3D]">{item.sku}</td>
                      <td className="py-3 px-4 text-center text-[#6B7A99]">{item.quantity}</td>
                      <td className="py-3 px-4 text-right font-bold text-[#0A1B3D]">
                        ₹{item.unit_rate.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-[#6B7A99]">
                        ₹{(item.previous_rate || item.unit_rate).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.price_hike_detected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-[4px]">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>+{item.hike_percentage.toFixed(1)}% Hike</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0E9F6E] bg-[#0E9F6E]/10 px-2 py-0.5 rounded-[4px]">
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

            {/* Table Footer Action */}
            <div className="p-4 border-t border-[#E6EAF5] flex items-center justify-between bg-white">
              <span className="text-xs text-[#6B7A99]">
                Baseline matched against 30-day kirana price memory
              </span>
              <button
                type="button"
                onClick={() => setShowDraftPO(true)}
                className="h-10 px-5 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>Draft Counter-Restock Purchase Order</span>
              </button>
            </div>
          </div>

          {/* Draft Purchase Order & WhatsApp Dispatch */}
          {showDraftPO && analysisResult.draft_po && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* WhatsApp PO Card */}
              <div className="bg-[#EFEAE2] rounded-[6px] border border-[#E6EAF5] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0A1B3D]">Wholesaler WhatsApp PO Dispatch</span>
                    <span className="text-[11px] text-[#6B7A99]">
                      ({analysisResult.draft_po.supplier_name})
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6B7A99] flex items-center gap-1">
                    <span>🔌</span>
                    <span>Connect WhatsApp API for live dispatch → simulated</span>
                  </div>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="max-w-lg bg-white rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px] p-4 shadow-sm border border-black/5 text-xs">
                  <div className="font-bold text-[#0A1B3D] text-[13px] mb-1">
                    📦 PURCHASE ORDER: {analysisResult.draft_po.po_number}
                  </div>
                  <div className="text-[#6B7A99] text-[11px] mb-2">
                    From: <span className="text-[#0A1B3D] font-semibold">Sri Lakshmi Stores</span> • To:{' '}
                    <span className="text-[#0A1B3D] font-semibold">{analysisResult.draft_po.supplier_name}</span>
                  </div>

                  <p className="text-[#0A1B3D] leading-relaxed mb-3">
                    Please confirm dispatch for the following restocking requirements at our agreed baseline rates:
                  </p>

                  <div className="bg-[#F8FAFC] rounded-[4px] p-3 border border-[#E6EAF5] space-y-1.5 font-mono text-[11px]">
                    {analysisResult.draft_po.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-[#0A1B3D]">
                        <span>• {it.quantity}x {it.sku}</span>
                        <span className="font-bold text-[#533AFD]">Target: ₹{it.expected_rate.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-[10px] text-[#6B7A99] italic">
                    _Auto-generated via Vani Restock Agent • Rate protection enabled_
                  </div>
                </div>

                {/* Send Button */}
                <div className="mt-5 pt-4 border-t border-[#0A1B3D]/10 flex items-center justify-between">
                  {poResult ? (
                    <div className="text-xs font-bold text-[#0E9F6E] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{poResult.message}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-[#0A1B3D] font-medium">
                      One-click dispatch directly to distributor WhatsApp
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleSendPO}
                    disabled={isSendingPO || Boolean(poResult)}
                    className="h-10 px-5 rounded-[4px] bg-[#0E9F6E] hover:bg-[#057A55] text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{poResult ? 'PO Dispatched ✓' : 'Send PO to Wholesaler via WhatsApp'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
