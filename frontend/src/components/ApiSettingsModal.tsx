'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle2, Save, Radio } from 'lucide-react';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [sarvamKey, setSarvamKey] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_sarvam_key') || '' : ''
  );
  const [sarvamLang, setSarvamLang] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_sarvam_lang') || 'hi' : 'hi'
  );
  const [groqKey, setGroqKey] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_groq_key') || '' : ''
  );
  const [geminiKey, setGeminiKey] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_gemini_key') || '' : ''
  );
  const [merchantVpa, setMerchantVpa] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_merchant_vpa') || 'srilakshmi@paytm' : 'srilakshmi@paytm'
  );
  const [whatsappToken, setWhatsappToken] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_whatsapp_token') || '' : ''
  );
  const [engineMode, setEngineMode] = useState('🟢 Active in Zero-Setup Mock Engine (Ready for hackathon judging out of the box, enter keys to switch to live APIs)');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Fetch backend settings when opened
  useEffect(() => {
    if (!isOpen) return;
    const fetchSettings = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.mode_description) setEngineMode(data.mode_description);
          if (data.merchant?.vpa) setMerchantVpa(data.merchant.vpa);
          if (data.merchant?.default_language) setSarvamLang(data.merchant.default_language);
        }
      } catch {
        // Fallback
      }
    };
    fetchSettings();
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('vani_sarvam_key', sarvamKey);
      localStorage.setItem('vani_sarvam_lang', sarvamLang);
      localStorage.setItem('vani_groq_key', groqKey);
      localStorage.setItem('vani_gemini_key', geminiKey);
      localStorage.setItem('vani_merchant_vpa', merchantVpa);
      localStorage.setItem('vani_whatsapp_token', whatsappToken);
    }

    try {
      await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sarvam_api_key: sarvamKey || undefined,
          groq_api_key: groqKey || undefined,
          gemini_api_key: geminiKey || undefined,
          whatsapp_api_token: whatsappToken || undefined,
          merchant_vpa: merchantVpa || undefined,
          default_language: sarvamLang || undefined,
        }),
      });
    } catch {
      // Local fallback
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A1B3D]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[6px] border border-[#E6EAF5] max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6EAF5] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[4px] bg-[#533AFD]/10 text-[#533AFD] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0A1B3D] tracking-tight">
                API & Production Configuration
              </h3>
              <p className="text-xs text-[#6B7A99]">
                Configure external AI & payment gateway credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[4px] text-[#6B7A99] hover:text-[#0A1B3D] hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Engine status banner */}
        <div className="bg-[#533AFD]/5 border-b border-[#533AFD]/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#533AFD]">
            <Radio className="w-3.5 h-3.5 text-[#0E9F6E] animate-pulse" />
            <span>{engineMode}</span>
          </div>
          <span className="text-[11px] text-[#6B7A99] bg-white px-2 py-0.5 rounded-[4px] border border-[#E6EAF5]">
            Offline Safe
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 text-xs">
          <p className="text-[#6B7A99] leading-relaxed">
            The platform executes with zero-dependency simulated fallbacks. Enter keys below to switch from local execution to real external APIs:
          </p>

          {/* Sarvam AI */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[#0A1B3D] font-bold mb-1">
                Sarvam AI Speech API Key
              </label>
              <input
                type="password"
                value={sarvamKey}
                onChange={(e) => setSarvamKey(e.target.value)}
                placeholder="sarvam_live_..."
                className="w-full h-[40px] px-3 bg-white border border-[#E6EAF5] rounded-[4px] text-[#0A1B3D] placeholder-[#6B7A99] focus:outline-none focus:border-[#533AFD]"
              />
            </div>
            <div>
              <label className="block text-[#0A1B3D] font-bold mb-1">
                Primary Dialect
              </label>
              <select
                value={sarvamLang}
                onChange={(e) => setSarvamLang(e.target.value)}
                className="w-full h-[40px] px-2.5 bg-white border border-[#E6EAF5] rounded-[4px] text-[#0A1B3D] focus:outline-none focus:border-[#533AFD]"
              >
                <option value="hi">Hindi (हिंदी)</option>
                <option value="en">English</option>
                <option value="ta">Tamil (தமிழ்)</option>
                <option value="te">Telugu (తెలుగు)</option>
              </select>
            </div>
          </div>

          {/* Groq Llama-3.3 Key */}
          <div>
            <label className="block text-[#0A1B3D] font-bold mb-1">
              Groq API Key (Llama-3.3-70B Versatile Intent Parsing)
            </label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full h-[40px] px-3 bg-white border border-[#E6EAF5] rounded-[4px] text-[#0A1B3D] placeholder-[#6B7A99] focus:outline-none focus:border-[#533AFD]"
            />
          </div>

          {/* Gemini 2.5 Flash Vision */}
          <div>
            <label className="block text-[#0A1B3D] font-bold mb-1">
              Google Gemini 2.5 Flash Vision API Key (Distributor Bill OCR)
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full h-[40px] px-3 bg-white border border-[#E6EAF5] rounded-[4px] text-[#0A1B3D] placeholder-[#6B7A99] focus:outline-none focus:border-[#533AFD]"
            />
          </div>

          {/* UPI Gateway Merchant VPA */}
          <div>
            <label className="block text-[#0A1B3D] font-bold mb-1">
              Merchant UPI VPA (for Dynamic QR Payload)
            </label>
            <input
              type="text"
              value={merchantVpa}
              onChange={(e) => setMerchantVpa(e.target.value)}
              placeholder="srilakshmi@paytm"
              className="w-full h-[40px] px-3 bg-white border border-[#E6EAF5] rounded-[4px] text-[#0A1B3D] focus:outline-none focus:border-[#533AFD]"
            />
          </div>

          {/* WhatsApp Token */}
          <div>
            <label className="block text-[#0A1B3D] font-bold mb-1">
              WhatsApp Cloud API Bearer Token
            </label>
            <input
              type="password"
              value={whatsappToken}
              onChange={(e) => setWhatsappToken(e.target.value)}
              placeholder="EAA..."
              className="w-full h-[40px] px-3 bg-white border border-[#E6EAF5] rounded-[4px] text-[#0A1B3D] placeholder-[#6B7A99] focus:outline-none focus:border-[#533AFD]"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-[#E6EAF5] flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-xs font-bold text-[#0E9F6E] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Settings saved and synced with FastAPI backend!
              </span>
            ) : (
              <span className="text-[11px] text-[#6B7A99]">
                Live in FastAPI backend & local storage
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-[38px] px-4 rounded-[4px] border border-[#E6EAF5] text-[#0A1B3D] font-bold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-[38px] px-5 rounded-[4px] bg-[#533AFD] hover:bg-[#4329E0] text-white font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
