import React from 'react';
import { EmailStatus } from '../../types';

export interface BadgeProps {
  status?: EmailStatus;
  text?: string;
  variant?: 'scheduled' | 'sent' | 'processing' | 'failed' | 'rate_limited' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  text,
  variant,
  icon,
  className = '',
}) => {
  let computedVariant = variant;

  if (status && !computedVariant) {
    switch (status) {
      case 'PENDING':
        computedVariant = 'scheduled';
        break;
      case 'PROCESSING':
        computedVariant = 'processing';
        break;
      case 'SENT':
        computedVariant = 'sent';
        break;
      case 'FAILED':
        computedVariant = 'failed';
        break;
      case 'RATE_LIMITED':
        computedVariant = 'rate_limited';
        break;
      default:
        computedVariant = 'neutral';
    }
  }

  const variantStyles = {
    scheduled: 'bg-[#fff5ea] text-[#f27405] border border-[#ffd8b2]',
    sent: 'bg-[#f0f2f5] text-[#4b5563] border border-gray-200',
    processing: 'bg-blue-50 text-blue-700 border border-blue-200',
    failed: 'bg-red-50 text-red-700 border border-red-200',
    rate_limited: 'bg-amber-50 text-amber-700 border border-amber-200',
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
  };

  const displayText =
    text ||
    (status === 'PENDING'
      ? 'Scheduled'
      : status === 'PROCESSING'
      ? 'Processing'
      : status === 'SENT'
      ? 'Sent'
      : status === 'FAILED'
      ? 'Failed'
      : status === 'RATE_LIMITED'
      ? 'Rate Limited'
      : 'Status');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        variantStyles[computedVariant || 'neutral']
      } ${className}`}
    >
      {icon}
      {displayText}
    </span>
  );
};
