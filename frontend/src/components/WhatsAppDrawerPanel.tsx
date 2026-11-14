'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Truck,
  Send,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  PackageCheck,
  CheckCheck,
} from 'lucide-react';
import { UdhariItem, InvoiceAnalysisResponse, RestockOrderResponse } from '@/types';
import { playPaytmChime } from '@/lib/audio';

interface WhatsAppDrawerPanelProps {
  udhariList: UdhariItem[];
  onSendReminder: (id: string) => Promise<void>;
  onReconcileUdhari: (id: string, amount: number) => Promise<void>;
  onAnalyzeInvoice: (file?: File) => Promise<void>;
  onSendPO: () => Promise<void>;
  ocrAnalysis: InvoiceAnalysisResponse | null;
  lastPO: RestockOrderResponse | null;
  isAnalyzingOcr: boolean;
  isSendingPO: boolean;
  isStandalone?: boolean;
}

export const WhatsAppDrawerPanel: React.FC<WhatsAppDrawerPanelProps> = ({
  udhariList,
  onSendReminder,
  onReconcileUdhari,
  onAnalyzeInvoice,
  onSendPO,
  ocrAnalysis,
  lastPO,
  isAnalyzingOcr,
  isSendingPO,
  isStandalone = false,
}) => {
  const [activeTab, setActiveTab] = useState<'udhari' | 'restock'>('udhari');
  const [selectedUdhari, setSelectedUdhari] = useState<UdhariItem | null>(null);

  const activeCustomer = selectedUdhari || udhariList[0] || null;

  const handlePayUdhariLink = async (udhari: UdhariItem) => {
    playPaytmChime();
    await onReconcileUdhari(udhari.id, udhari.amount_due);
  };

  return (
    <div className={`flex flex-col gap-6 ${isStandalone ? 'max-w-4xl mx-auto' : ''}`}>
      {/* Panel Top Title: Stripe Light */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E6EAF5]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[4px] bg-[#0E9F6E]/10 text-[#0E9F6E] flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0A1B3D] tracking-tight">
              WhatsApp Ledger & Restock Hub
            </h2>
            <p className="text-xs text-[#6B7A99] font-medium">
              Digital Bahi-Khata Recovery & Snap-to-Restock Agent
            </p>
          </div>
        </div>
        <span className="bg-[#FAFBFD] text-[#0A1B3D] text-xs font-bold px-3 py-1 rounded-[4px] border border-[#E6EAF5]">
          WhatsApp Cloud API
        </span>
      </div>

      {/* Disciplined Tabs Switcher */}
      <div className="flex items-center bg-[#F8FAFC] border border-[#E6EAF5] rounded-[4px] p-1">
        <button
          onClick={() => setActiveTab('udhari')}
          className={`flex-1 py-2 px-4 rounded-[3px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'udhari'
              ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
              : 'text-[#6B7A99] hover:text-[#0A1B3D]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Customer Udhari Ledger & Payment Links</span>
        </button>
        <button
          onClick={() => setActiveTab('restock')}
          className={`flex-1 py-2 px-4 rounded-[3px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'restock'
              ? 'bg-white text-[#533AFD] shadow-xs border border-[#E6EAF5]'
              : 'text-[#6B7A99] hover:text-[#0A1B3D]'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Distributor Restock & Vision OCR</span>
        </button>
      </div>

      {/* TAB 1: CUSTOMER UDHARI CHAT */}
      {activeTab === 'udhari' && (
        <div className="flex flex-col gap-5">
          {/* WhatsApp Chat Simulation Container */}
          <div className="bg-[#EFEAE2] rounded-[6px] border border-[#E6EAF5] overflow-hidden flex flex-col h-[480px] shadow-sm">
            {/* WhatsApp Header */}
            <div className="bg-[#075E54] text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#128C7E] text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                  {activeCustomer?.customer_name?.slice(0, 2) || 'RK'}
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight">
                    {activeCustomer?.customer_name || 'Ramesh Kumar'}
                  </div>
                  <div className="text-xs text-emerald-200">
                    +91 {activeCustomer?.customer_phone || '9876543210'} • Online
                  </div>
                </div>
              </div>
              <span className="text-xs bg-[#128C7E] text-white px-2.5 py-0.5 rounded-[3px] font-medium">
                Kirana Credit Ledger
              </span>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto flex flex-col gap-3.5">
              {/* Date stamp */}
              <div className="text-center my-1">
                <span className="bg-white/90 text-[#6B7A99] text-[11px] px-2.5 py-0.5 rounded-[3px] font-medium shadow-2xs">
                  Today, 11:25 AM
                </span>
              </div>

              {/* Message 1: Initial Bill Notice */}
              <div className="self-end max-w-[85%] sm:max-w-[75%] bg-[#DCF8C6] text-[#0A1B3D] p-3.5 rounded-[6px] shadow-2xs text-xs sm:text-sm border border-emerald-100">
                <p className="font-bold text-[#075E54]">
                  Namaste {activeCustomer?.customer_name || 'Ramesh'} ji 🙏
                </p>
                <p className="mt-1 text-[#0A1B3D]">
                  Thank you for shopping at <span className="font-bold">Sri Lakshmi Stores</span> today.
                </p>
                <div className="bg-white/80 p-2.5 rounded-[4px] mt-2 text-xs border border-emerald-200">
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-600">Total Bill Amount:</span>
                    <span className="font-semibold">₹650.00</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-600">UPI Paid at Counter:</span>
                    <span className="font-semibold text-emerald-700">₹400.00 ✓</span>
                  </div>
                  <div className="flex justify-between py-1 border-t border-gray-200 font-bold text-sm text-[#0A1B3D]">
                    <span>Balance Credit (Udhari):</span>
                    <span>₹{activeCustomer?.amount_due || 250}.00</span>
                  </div>
                  <div className="text-[11px] text-[#6B7A99] mt-0.5">
                    Promised Due Date: <span className="font-semibold text-[#0A1B3D]">{activeCustomer?.due_date || 'Mon, 17 Nov'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 mt-1.5">
                  <span>11:26 AM</span>
                  <CheckCheck className="w-3.5 h-3.5 text-[#533AFD]" />
                </div>
              </div>

              {/* Message 2: Automated Payment Link with 1-Click Settle */}
              <div className="self-end max-w-[85%] sm:max-w-[75%] bg-[#DCF8C6] text-[#0A1B3D] p-3.5 rounded-[6px] shadow-2xs text-xs sm:text-sm border border-emerald-100">
                <div className="flex items-center gap-1.5 text-[#0A1B3D] font-bold text-xs mb-1">
                  <span>Payment Link Dispatched</span>
                </div>
                <p className="text-xs text-[#0A1B3D] leading-relaxed">
                  Please tap below to settle your outstanding balance of{' '}
                  <span className="font-bold">₹{activeCustomer?.amount_due || 250}</span> via UPI:
                </p>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-xs text-[#533AFD] underline block my-1.5 font-mono truncate font-semibold"
                >
                  {activeCustomer?.paytm_payment_link || 'https://p.paytm.me/pay?id=udh-001&am=250.00'}
                </a>

                {/* Interactive 1-Click Customer Payment Simulator */}
                {activeCustomer?.status === 'SETTLED' ? (
                  <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 p-2.5 rounded-[4px] mt-2.5 flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-[#0E9F6E]" />
                    <span>✓ Settle Confirmed: ₹{activeCustomer.amount_due} Reconciled</span>
                  </div>
                ) : (
                  <button
                    onClick={() => activeCustomer && handlePayUdhariLink(activeCustomer)}
                    className="w-full mt-2.5 py-2.5 px-4 bg-[#533AFD] hover:bg-[#4329E0] text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>⚡ Pay ₹{activeCustomer?.amount_due || 250} via Payment Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 mt-1.5">
                  <span>11:27 AM</span>
                  <CheckCheck className="w-3.5 h-3.5 text-[#533AFD]" />
                </div>
              </div>

              {/* Message 3: Customer Paid Confirmation */}
              {activeCustomer?.status === 'SETTLED' && (
                <div className="self-start max-w-[85%] sm:max-w-[75%] bg-white text-[#0A1B3D] p-3.5 rounded-[6px] shadow-2xs text-xs sm:text-sm border border-[#E6EAF5] animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-[#0E9F6E]" />
                    <span>Payment Received via UPI!</span>
                  </div>
                  <p className="text-xs text-gray-700">
                    {activeCustomer.customer_name} paid ₹{activeCustomer.amount_due} (Ref: UTR#PAYTMUDH{activeCustomer.id.slice(0, 6)}). Ledger reconciled and marked Settled.
                  </p>
                  <div className="text-[10px] text-gray-400 mt-1">11:29 AM</div>
                </div>
              )}
            </div>

            {/* Chat Action Footer: Dispatched reminder */}
            <div className="p-3 bg-[#F0F2F5] border-t border-[#E6EAF5] flex items-center gap-3">
              <button
                onClick={() => activeCustomer && onSendReminder(activeCustomer.id)}
                className="flex-1 py-2 px-4 bg-white text-[#075E54] border border-[#E6EAF5] hover:bg-emerald-50 rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4 text-[#075E54]" />
                <span>Send WhatsApp Reminder Link Now</span>
              </button>
            </div>
          </div>

          {/* Store Udhari Ledger Directory with Customer Cards */}
          <div className="bg-white p-5 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
                  Store Credit (Udhari) Records
                </h3>
                <p className="text-xs text-[#6B7A99]">
                  Select account to view customer WhatsApp thread:
                </p>
              </div>
              <span className="text-xs text-[#533AFD] font-bold bg-[#533AFD]/10 px-2.5 py-0.5 rounded-[4px]">
                {udhariList.length} Active Records
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-[180px] overflow-y-auto">
              {udhariList.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedUdhari(item)}
                  className={`p-3 rounded-[4px] border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                    activeCustomer?.id === item.id
                      ? 'bg-white border-[#533AFD] shadow-xs ring-1 ring-[#533AFD]'
                      : 'bg-[#FAFBFD] border-[#E6EAF5] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-[#0A1B3D]">
                      {item.customer_name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-[2px] ${
                        item.status === 'SETTLED'
                          ? 'bg-emerald-100 text-[#0E9F6E]'
                          : item.status === 'REMINDER_SENT'
                          ? 'bg-blue-100 text-[#533AFD]'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/60">
                    <span className="text-[11px] text-[#6B7A99]">Due: {item.due_date}</span>
                    <span className="font-bold text-sm text-[#0A1B3D]">₹{item.amount_due}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WHOLESALER RESTOCK (SNAP-TO-RESTOCK & PRICE HIKE OCR) */}
      {activeTab === 'restock' && (
        <div className="flex flex-col gap-5">
          {/* Upload / OCR Trigger Box */}
          <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#0A1B3D] uppercase tracking-wider">
                  Snap-to-Restock Vision OCR
                </h3>
                <p className="text-xs text-[#6B7A99] mt-0.5">
                  Photograph paper bills to detect distributor price increases & draft reorders
                </p>
              </div>
              <span className="text-xs font-bold text-[#533AFD] bg-[#533AFD]/10 px-2.5 py-0.5 rounded-[4px]">
                Gemini 2.5 Flash Vision
              </span>
            </div>

            {/* Quick Demo Invoice Button */}
            <button
              onClick={() => onAnalyzeInvoice()}
              disabled={isAnalyzingOcr}
              className="h-[46px] w-full bg-[#533AFD] hover:bg-[#4329E0] disabled:opacity-50 text-white rounded-[4px] text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-colors shadow-xs cursor-pointer"
            >
              {isAnalyzingOcr ? (
                <Clock className="w-4 h-4 animate-spin text-white" />
              ) : (
                <UploadCloud className="w-5 h-5 text-white" />
              )}
              <span>
                {isAnalyzingOcr ? 'Analyzing Paper Invoice with Gemini Vision...' : 'Load & Scan Metro Cash & Carry Paper Bill'}
              </span>
            </button>
          </div>

          {/* OCR Result Breakdown & Price Hike Warning */}
          {ocrAnalysis && (
            <div className="bg-white p-6 rounded-[6px] border border-[#E6EAF5] shadow-xs flex flex-col gap-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#0A1B3D]">
                    {ocrAnalysis.vendor_name}
                  </h4>
                  <p className="text-xs text-[#6B7A99]">
                    Invoice #{ocrAnalysis.invoice_no} • Date: {ocrAnalysis.invoice_date}
                  </p>
                </div>
                <span className="text-xs font-bold bg-[#0E9F6E]/10 text-[#0E9F6E] px-2.5 py-0.5 rounded-[3px]">
                  OCR Line-Items Extracted
                </span>
              </div>

              {/* Price Creep Flagged Alert */}
              {ocrAnalysis.price_hikes && ocrAnalysis.price_hikes.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-[4px] p-4 flex items-start gap-3 shadow-2xs">
                  <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold text-amber-950 block text-sm">
                      ⚠️ Margin Leak Detected (+10.7% Price Creep)
                    </span>
                    <p className="text-amber-900 mt-1 leading-relaxed">
                      <span className="font-bold">Fortune Sunlite Sunflower Oil 1L</span> unit rate increased from{' '}
                      <span className="line-through font-bold">₹140</span> to <span className="font-black underline text-red-700">₹155</span> (+₹15/unit)!
                      Historical supplier logs flagged price creep.
                    </p>
                  </div>
                </div>
              )}

              {/* Parsed SKUs Table with Breathing Room */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6EAF5] text-[#6B7A99] font-bold">
                      <th className="py-2.5">SKU Description</th>
                      <th className="py-2.5 text-center">Qty</th>
                      <th className="py-2.5 text-right">Current Rate</th>
                      <th className="py-2.5 text-right">Prev Rate</th>
                      <th className="py-2.5 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocrAnalysis.items.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-gray-100 ${
                          item.price_hike_detected ? 'bg-amber-50/80 font-bold text-amber-950' : 'text-gray-800'
                        }`}
                      >
                        <td className="py-2.5 pr-2">{item.sku}</td>
                        <td className="py-2.5 text-center text-[#6B7A99]">{item.quantity}</td>
                        <td className="py-2.5 text-right font-bold">₹{item.unit_rate}</td>
                        <td className="py-2.5 text-right text-gray-500">
                          {item.previous_rate ? `₹${item.previous_rate}` : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          {item.price_hike_detected ? (
                            <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-[2px]">
                              +{item.hike_percentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[#0E9F6E] font-semibold">0%</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 1-Click PO Dispatch Action */}
              <button
                onClick={onSendPO}
                disabled={isSendingPO}
                className="h-[46px] w-full bg-[#0E9F6E] hover:bg-emerald-700 disabled:opacity-50 text-white rounded-[4px] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <PackageCheck className="w-5 h-5" />
                <span>
                  {isSendingPO
                    ? 'Dispatching Purchase Order to Wholesaler WhatsApp...'
                    : '1-Click Dispatch PO #882 to Wholesaler WhatsApp'}
                </span>
              </button>
            </div>
          )}

          {/* Dispatched PO Confirmation & WhatsApp Bubble */}
          {lastPO && (
            <div className="bg-[#DCF8C6] border border-emerald-300 rounded-[6px] p-4 text-xs sm:text-sm text-[#0A1B3D] shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between text-emerald-900 font-bold mb-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Purchase Order {lastPO.po_number} Dispatched to Metro Cash & Carry
                </span>
                <span className="text-[11px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-[3px] font-bold">
                  WhatsApp Delivered
                </span>
              </div>
              <pre className="font-mono text-xs text-gray-800 whitespace-pre-wrap bg-white/80 p-3 rounded-[4px] border border-emerald-200">
                {lastPO.whatsapp_preview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
