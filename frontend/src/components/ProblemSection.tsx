'use client';

import React from 'react';

export const ProblemSection: React.FC = () => {
  return (
    <section id="problem" className="py-24 border-b border-[#E6EAF5] bg-white">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#533AFD] mb-2 block">
            The Problem Context
          </span>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-[#0A1B3D] leading-tight">
            The three daily revenue leaks draining Indian kirana stores.
          </h2>
          <p className="text-base text-[#6B7A99] mt-3">
            Across 12M+ retail counters, UPI powers 83% of checkouts. Yet bookkeeping and credit remain disconnected from payment hardware.
          </p>
        </div>

        {/* 3 Spacious Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Unrecorded Udhari */}
          <div className="bg-[#FAFBFD] p-8 rounded-[6px] border border-[#E6EAF5] flex flex-col justify-between hover:border-[#533AFD]/40 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-[4px] bg-[#533AFD]/10 text-[#533AFD] flex items-center justify-center text-xl mb-6">
                📒
              </div>
              <h3 className="text-lg font-bold text-[#0A1B3D] tracking-tight mb-2">
                Unrecorded Verbal Udhari
              </h3>
              <p className="text-sm text-[#6B7A99] leading-relaxed">
                Shopkeepers attend to 3 to 5 buyers per minute during peak evening rush. Partial credit agreed verbally is forgotten and never logged in notebooks.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-[#E6EAF5]">
              <div className="text-2xl font-light text-[#0A1B3D] tracking-tight">
                ₹250 <span className="text-xs font-bold text-[#6B7A99]">/ day</span>
              </div>
              <span className="text-xs text-[#E02424] font-bold block mt-0.5">
                Avg forgotten customer credit per counter
              </span>
            </div>
          </div>

          {/* Card 2: Static QR Shortfalls & Spoofs */}
          <div className="bg-[#FAFBFD] p-8 rounded-[6px] border border-[#E6EAF5] flex flex-col justify-between hover:border-[#E02424]/40 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-[4px] bg-[#E02424]/10 text-[#E02424] flex items-center justify-center text-xl mb-6">
                ⚠️
              </div>
              <h3 className="text-lg font-bold text-[#0A1B3D] tracking-tight mb-2">
                Static QR Shortfalls & Spoofing
              </h3>
              <p className="text-sm text-[#6B7A99] leading-relaxed">
                Customers scan static QR stickers, edit ₹400 to ₹40 on modified apps or show fake screenshot UTRs. Passive soundboxes announce ₹40 after they walk away.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-[#E6EAF5]">
              <div className="text-2xl font-light text-[#0A1B3D] tracking-tight">
                ₹180 <span className="text-xs font-bold text-[#6B7A99]">/ day</span>
              </div>
              <span className="text-xs text-[#E02424] font-bold block mt-0.5">
                Avg fraud & underpayment shortfall
              </span>
            </div>
          </div>

          {/* Card 3: Blind Wholesale Restocking */}
          <div className="bg-[#FAFBFD] p-8 rounded-[6px] border border-[#E6EAF5] flex flex-col justify-between hover:border-[#FF7A1A]/40 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-[4px] bg-[#FF7A1A]/10 text-[#FF7A1A] flex items-center justify-center text-xl mb-6">
                📦
              </div>
              <h3 className="text-lg font-bold text-[#0A1B3D] tracking-tight mb-2">
                Distributor Price Creep & Overbilling
              </h3>
              <p className="text-sm text-[#6B7A99] leading-relaxed">
                Wholesale paper invoices are dumped in a drawer. Distributors quietly hike staple items (e.g. cooking oil by +10.7%) without merchant awareness.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-[#E6EAF5]">
              <div className="text-2xl font-light text-[#0A1B3D] tracking-tight">
                ₹370 <span className="text-xs font-bold text-[#6B7A99]">/ reorder</span>
              </div>
              <span className="text-xs text-[#FF7A1A] font-bold block mt-0.5">
                Unmonitored distributor rate creep
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
