'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

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
  const [generationError, setGenerationError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl('');
    setGenerationError(false);
    if (!value.trim()) return () => { cancelled = true; };

    QRCode.toDataURL(value, {
      width: size,
      margin: 3,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch((err) => {
        console.error('QR code generation error:', err);
        if (!cancelled) setGenerationError(true);
      });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        role="status"
        className={`flex items-center justify-center bg-white rounded-[16px] border border-[#e6e6e6] ${!generationError ? 'animate-pulse' : ''} ${className}`}
      >
        <span className="px-4 text-center text-xs text-[#717171] font-medium">{generationError ? 'Could not create QR. Reopen this invoice to try again.' : value ? 'Creating secure QR…' : 'No QR for this bill'}</span>
      </div>
    );
  }

  return <img src={dataUrl} alt="Amount and invoice encoded QR code" width={size} height={size} className={`rounded-xl border border-slate-200 bg-white p-1 ${className}`} />;
};
