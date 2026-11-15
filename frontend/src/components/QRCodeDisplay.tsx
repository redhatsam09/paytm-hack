'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Radio } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 220,
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#3d3d3d', // Charcoal
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-[#fcfcfc] rounded-[16px] border border-[#e6e6e6] animate-pulse ${className}`}
      >
        <span className="text-xs text-[#717171] font-medium">Generating Dynamic QR...</span>
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="Dynamic Amount-Locked UPI QR"
        width={size}
        height={size}
        className="rounded-[16px] border border-[#e6e6e6]"
      />
      {/* Vani Center Audio Emblem */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-10 h-10 bg-white rounded-full shadow-sm border border-[#3a3f5c] flex items-center justify-center p-1">
          <div className="w-full h-full bg-[#3a3f5c] rounded-full flex items-center justify-center text-white">
            <Radio className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};
