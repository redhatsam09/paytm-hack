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
  const [paytmSecret, setPaytmSecret] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_paytm_secret') || '' : ''
  );
  const [whatsappToken, setWhatsappToken] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_whatsapp_token') || '' : ''
  );
  const [whatsappPhoneId, setWhatsappPhoneId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vani_whatsapp_phone_id') || '' : ''
  );
  const [engineMode, setEngineMode] = useState('🟢 Zero-Setup Engine Active (Ready for live demo without keys)');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Fetch backend settings when opened
  useEffect(() => {
    if (!isOpen) return;
    const fetchSettings = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.mode_description) setEngineMode(`🟢 ${data.mode_description}`);
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
      localStorage.setItem('vani_paytm_secret', paytmSecret);
      localStorage.setItem('vani_whatsapp_token', whatsappToken);
      localStorage.setItem('vani_whatsapp_phone_id', whatsappPhoneId);
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
          paytm_webhook_secret: paytmSecret || undefined,
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
    <div className="fixed inset-0 z-50 bg-[#3d3d3d]/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] border border-[#e6e6e6] max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-8 py-5 border-b border-[#e6e6e6] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#3a3f5c]/10 text-[#3a3f5c] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#3d3d3d] tracking-tight">
                Pluggable API Keys & Configuration
              </h3>
              <p className="text-xs text-[#717171]">
                Connect external Indic AI & WhatsApp gateway credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[#717171] hover:text-[#3d3d3d] hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Engine status banner */}
        <div className="bg-[#f97316]/5 border-b border-[#f97316]/15 px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-[#3a3f5c]">
            <Radio className="w-3.5 h-3.5 text-[#0e9f6e] animate-pulse" />
            <span>{engineMode}</span>
          </div>
          <span className="text-[11px] text-[#717171] bg-white px-2.5 py-0.5 rounded-full border border-[#e6e6e6]">
            Mock Engine Safe
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-8 flex flex-col gap-4 text-xs max-h-[70vh] overflow-y-auto">
          <p className="text-[#717171] leading-relaxed">
            All fields are empty by default. Vani executes smoothly using its built-in sovereign mock fallbacks. Enter keys below to switch to real production APIs:
          </p>

          {/* Sarvam AI Key & Language */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[#3d3d3d] font-semibold mb-1">
                Sarvam AI Speech API Key
              </label>
              <input
                type="password"
                value={sarvamKey}
                onChange={(e) => setSarvamKey(e.target.value)}
                placeholder="sarvam_live_..."
                className="w-full h-11 px-4 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-[#3d3d3d] placeholder-[#999999] focus:outline-none focus:border-[#3a3f5c]"
              />
            </div>
            <div>
              <label className="block text-[#3d3d3d] font-semibold mb-1">
                Dialect
              </label>
              <select
                value={sarvamLang}
                onChange={(e) => setSarvamLang(e.target.value)}
                className="w-full h-11 px-3 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-[#3d3d3d] focus:outline-none focus:border-[#3a3f5c]"
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
            <label className="block text-[#3d3d3d] font-semibold mb-1">
              Groq API Key (Llama-3.3-70B Indic Intent Parsing)
            </label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full h-11 px-4 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-[#3d3d3d] placeholder-[#999999] focus:outline-none focus:border-[#3a3f5c]"
            />
          </div>

          {/* Gemini 2.5 Flash Vision */}
          <div>
            <label className="block text-[#3d3d3d] font-semibold mb-1">
              Google Gemini 2.5 Flash Vision Key (Distributor Bill OCR)
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full h-11 px-4 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-[#3d3d3d] placeholder-[#999999] focus:outline-none focus:border-[#3a3f5c]"
            />
          </div>

          {/* WhatsApp Token & Phone ID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#3d3d3d] font-semibold mb-1">
                WhatsApp Cloud API Token
              </label>
              <input
                type="password"
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
                placeholder="EAA..."
                className="w-full h-11 px-4 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-[#3d3d3d] placeholder-[#999999] focus:outline-none focus:border-[#3a3f5c]"
              />
            </div>
            <div>
              <label className="block text-[#3d3d3d] font-semibold mb-1">
                WhatsApp Phone Number ID
              </label>
              <input
                type="text"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
                placeholder="1049281726..."
                className="w-full h-11 px-4 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-[#3d3d3d] placeholder-[#999999] focus:outline-none focus:border-[#3a3f5c]"
              />
            </div>
          </div>

          {/* Merchant VPA & Webhook Secret */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#3d3d3d] font-semibold mb-1">
                Merchant UPI VPA (Dynamic QR Target)
              </label>
              <input
                type="text"
                value={merchantVpa}
                onChange={(e) => setMerchantVpa(e.target.value)}
                placeholder="srilakshmi@paytm"
                className="w-full h-11 px-4 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-[#3d3d3d] focus:outline-none focus:border-[#3a3f5c]"
              />
            </div>
            <div>
              <label className="block text-[#3d3d3d] font-semibold mb-1">
                Paytm Webhook Secret
              </label>
              <input
                type="password"
                value={paytmSecret}
                onChange={(e) => setPaytmSecret(e.target.value)}
                placeholder="sec_paytm_live_..."
                className="w-full h-11 px-4 bg-[#fcfcfc] border border-[#e6e6e6] rounded-full text-[#3d3d3d] placeholder-[#999999] focus:outline-none focus:border-[#3a3f5c]"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-[#e6e6e6] flex items-center justify-between mt-2">
            {savedSuccess ? (
              <span className="text-xs font-semibold text-[#0e9f6e] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Configuration saved to runtime & storage!
              </span>
            ) : (
              <span className="text-[11px] text-[#717171]">
                Synced with FastAPI backend
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-5 rounded-full border border-[#e6e6e6] text-[#3d3d3d] font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 px-6 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Keys</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
