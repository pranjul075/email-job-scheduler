import React, { useState } from 'react';
import { Star, Clock } from 'lucide-react';
import { ScheduledEmail } from '../../types';

export interface EmailListItemProps {
  email: ScheduledEmail;
  onClick: () => void;
}

export const EmailListItem: React.FC<EmailListItemProps> = ({ email, onClick }) => {
  const [isStarred, setIsStarred] = useState(false);

  const formatScheduledTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${day} ${time}`;
  };

  const cleanPreview = email.body
    ? email.body.replace(/<[^>]*>?/gm, '').trim()
    : '';

  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between px-6 py-3.5 border-b border-gray-100 hover:bg-gray-50/80 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
        <div className="w-44 shrink-0 truncate">
          <span className="text-xs font-semibold text-gray-900">
            To: {email.recipientEmail}
          </span>
        </div>

        <div className="shrink-0">
          {email.status === 'SENT' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f0f2f5] text-gray-600">
              Sent
            </span>
          ) : email.status === 'FAILED' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-200">
              Failed
            </span>
          ) : email.status === 'RATE_LIMITED' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3 h-3 text-amber-600" />
              Rate Limited ({formatScheduledTime(email.scheduledAt)})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#fff5ea] text-[#f27405] border border-[#ffd8b2]">
              <Clock className="w-3 h-3 text-[#f27405]" />
              {formatScheduledTime(email.scheduledAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 truncate text-xs">
          <span className="font-bold text-gray-900 shrink-0 max-w-xs truncate">
            {email.subject}
          </span>
          <span className="text-gray-400 truncate">
            - {cleanPreview || 'No content preview'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsStarred(!isStarred);
          }}
          className="text-gray-300 hover:text-amber-400 transition-colors p-1"
        >
          <Star
            className={`w-4 h-4 ${
              isStarred ? 'fill-amber-400 text-amber-400' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
};
