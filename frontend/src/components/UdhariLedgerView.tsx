'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  Search,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { UdhariItem } from '@/types';
import { getUdhariList, sendUdhariReminder, reconcileUdhariPayment } from '@/lib/api';
import { playPaytmChime } from '@/lib/audio';

export const UdhariLedgerView: React.FC = () => {
  const [items, setItems] = useState<UdhariItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'REMINDER_SENT' | 'SETTLED'>('ALL');
  const [search, setSearch] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchList = async () => {
    setIsLoading(true);
    try {
      const data = await getUdhariList();
      setItems(data);
    } catch (err) {
      console.warn('Failed to fetch udhari list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getUdhariList()
      .then((data) => {
        if (isMounted) {
          setItems(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch udhari list:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSendReminder = async (item: UdhariItem) => {
    setActionLoadingId(item.id);
    try {
      await sendUdhariReminder(item.id);
      setNotification(`WhatsApp reminder link sent to ${item.customer_name}!`);
      // Update local state
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'REMINDER_SENT' } : i))
      );
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.warn('Send reminder error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReconcile = async (item: UdhariItem) => {
    setActionLoadingId(item.id);
    try {
      await reconcileUdhariPayment(item.id, item.amount_due);
      playPaytmChime();
      setNotification(`Payment of ₹${item.amount_due} reconciled for ${item.customer_name}!`);
      // Update local state
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'SETTLED', settled_at: new Date().toISOString() } : i))
      );
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.warn('Reconcile error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Metrics
  const totalOutstanding = items
    .filter((i) => i.status !== 'SETTLED')
    .reduce((acc, i) => acc + i.amount_due, 0);

  const activeAccountsCount = items.filter((i) => i.status !== 'SETTLED').length;
  const settledCount = items.filter((i) => i.status === 'SETTLED').length;

  // Filtered items
  const filteredItems = items.filter((item) => {
    const matchesFilter = filter === 'ALL' || item.status === filter;
    const matchesSearch =
      search === '' ||
      item.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      item.customer_phone.includes(search) ||
      (item.transaction_id && item.transaction_id.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0A1B3D] tracking-tight">
            Store Credit Ledger (Bahi Khata)
          </h2>
          <p className="text-xs text-[#6B7A99] mt-0.5">
            Automated WhatsApp credit recovery and one-click UPI reconciliation
          </p>
        </div>

        <button
          onClick={fetchList}
          className="h-9 px-3 rounded-[4px] border border-[#E6EAF5] hover:bg-gray-50 text-xs font-semibold text-[#0A1B3D] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#533AFD] ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="bg-[#0E9F6E]/10 border border-[#0E9F6E]/30 text-[#0E9F6E] px-4 py-2.5 rounded-[4px] text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[6px] border border-[#E6EAF5] p-5 shadow-xs">
          <span className="text-xs text-[#6B7A99] block mb-1">Total Outstanding Credit</span>
          <span className="text-2xl font-light text-amber-600 font-mono tracking-tight">
            ₹{totalOutstanding.toFixed(2)}
          </span>
          <span className="text-[11px] text-[#6B7A99] block mt-1">
            Across {activeAccountsCount} active customer accounts
          </span>
        </div>

        <div className="bg-white rounded-[6px] border border-[#E6EAF5] p-5 shadow-xs">
          <span className="text-xs text-[#6B7A99] block mb-1">Pending Unpaid Accounts</span>
          <span className="text-2xl font-light text-[#0A1B3D] font-mono tracking-tight">
            {activeAccountsCount}
          </span>
          <span className="text-[11px] text-[#6B7A99] block mt-1">
            Awaiting WhatsApp recovery
          </span>
        </div>

        <div className="bg-white rounded-[6px] border border-[#E6EAF5] p-5 shadow-xs">
          <span className="text-xs text-[#6B7A99] block mb-1">Settled Accounts</span>
          <span className="text-2xl font-light text-[#0E9F6E] font-mono tracking-tight">
            {settledCount}
          </span>
          <span className="text-[11px] text-[#0E9F6E] block mt-1">
            Reconciled to merchant VPA ✓
          </span>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-[6px] border border-[#E6EAF5] shadow-xs overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-[#E6EAF5] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC]">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-[4px] border border-[#E6EAF5]">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-[#533AFD] text-white shadow-xs'
                  : 'text-[#6B7A99] hover:text-[#0A1B3D]'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter('UNPAID')}
              className={`px-3 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
                filter === 'UNPAID'
                  ? 'bg-[#533AFD] text-white shadow-xs'
                  : 'text-[#6B7A99] hover:text-[#0A1B3D]'
              }`}
            >
              Unpaid ({items.filter((i) => i.status === 'UNPAID').length})
            </button>
            <button
              onClick={() => setFilter('REMINDER_SENT')}
              className={`px-3 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
                filter === 'REMINDER_SENT'
                  ? 'bg-[#533AFD] text-white shadow-xs'
                  : 'text-[#6B7A99] hover:text-[#0A1B3D]'
              }`}
            >
              Reminded ({items.filter((i) => i.status === 'REMINDER_SENT').length})
            </button>
            <button
              onClick={() => setFilter('SETTLED')}
              className={`px-3 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
                filter === 'SETTLED'
                  ? 'bg-[#533AFD] text-white shadow-xs'
                  : 'text-[#6B7A99] hover:text-[#0A1B3D]'
              }`}
            >
              Settled ({settledCount})
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6B7A99] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer or phone..."
              className="h-8 pl-8 pr-3 bg-white border border-[#E6EAF5] rounded-[4px] text-xs text-[#0A1B3D] placeholder-[#6B7A99] focus:outline-none focus:border-[#533AFD]"
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E6EAF5] bg-white text-[#6B7A99]">
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Invoice Ref</th>
                <th className="py-3 px-4 font-semibold">Due Date</th>
                <th className="py-3 px-4 font-semibold text-right">Amount Due</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF5]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6B7A99]">
                    No udhari credit records found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#0A1B3D]">{item.customer_name}</div>
                      <div className="text-[11px] text-[#6B7A99] font-mono">
                        +91 {item.customer_phone}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#6B7A99]">
                      {item.transaction_id || item.id}
                    </td>
                    <td className="py-3.5 px-4 text-[#0A1B3D]">
                      {item.due_date}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#0A1B3D]">
                      ₹{item.amount_due.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-[4px] ${
                          item.status === 'SETTLED'
                            ? 'bg-[#0E9F6E]/10 text-[#0E9F6E]'
                            : item.status === 'REMINDER_SENT'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.status === 'SETTLED'
                          ? 'SETTLED ✓'
                          : item.status === 'REMINDER_SENT'
                          ? 'REMINDER SENT'
                          : 'UNPAID'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status !== 'SETTLED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSendReminder(item)}
                              disabled={actionLoadingId === item.id}
                              className="h-8 px-2.5 rounded-[4px] border border-[#E6EAF5] hover:bg-gray-50 text-xs font-semibold text-[#0E9F6E] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Send WhatsApp payment link"
                            >
                              <Send className="w-3 h-3" />
                              <span className="hidden sm:inline">Remind</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReconcile(item)}
                              disabled={actionLoadingId === item.id}
                              className="h-8 px-2.5 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Reconcile received payment"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="hidden sm:inline">Settle</span>
                            </button>
                          </>
                        )}

                        {item.status === 'SETTLED' && (
                          <span className="text-[11px] text-[#0E9F6E] font-medium flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Reconciled</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
