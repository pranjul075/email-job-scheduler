import React from 'react';
import { ArrowLeft, Star, Trash2, ExternalLink, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { ScheduledEmail } from '../../types';

export interface EmailDetailModalProps {
  email: ScheduledEmail | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({
  email,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !email) return null;

  const senderName = email.senderRef?.name || 'Sender';
  const senderEmail = email.senderRef?.email || 'sender@example.com';
  const initial = senderName.charAt(0).toUpperCase();

  const formattedDate = new Date(
    email.sentAt || email.scheduledAt
  ).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-gray-900 truncate">
              {email.subject}
            </h2>
          </div>

          <div className="flex items-center gap-3 text-gray-400">
            <button className="p-1.5 rounded-full hover:bg-gray-100 hover:text-amber-400 transition-colors">
              <Star className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-full hover:bg-gray-100 hover:text-red-600 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#00a854] text-white flex items-center justify-center font-bold text-base shrink-0">
                {initial}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">
                    {senderName}
                  </span>
                  <span className="text-xs text-gray-400">
                    &lt;{senderEmail}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                  <span>to {email.recipientEmail}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs text-gray-400">{formattedDate}</span>
              {email.status === 'SENT' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Sent via SMTP
                </span>
              ) : email.status === 'FAILED' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  <AlertCircle className="w-3 h-3" /> Delivery Failed
                </span>
              ) : email.status === 'RATE_LIMITED' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Clock className="w-3 h-3" /> Deferred (Rate Limited)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                  <Clock className="w-3 h-3" /> Scheduled in BullMQ
                </span>
              )}
            </div>
          </div>

          {email.etherealPreviewUrl && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-emerald-800">
                  Ethereal Email Web Preview
                </span>
                <span className="text-xs text-emerald-600">
                  This message was dispatched to the real Ethereal SMTP test inbox.
                </span>
              </div>
              <a
                href={email.etherealPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00a854] text-white text-xs font-semibold rounded-lg hover:bg-[#008f47] transition-colors shrink-0"
              >
                <span>View Email Online</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {email.error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <span className="font-bold">Error:</span> {email.error}
            </div>
          )}

          <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed text-sm whitespace-pre-wrap">
            <div dangerouslySetInnerHTML={{ __html: email.body }} />
          </div>
        </div>
      </div>
    </div>
  );
};
