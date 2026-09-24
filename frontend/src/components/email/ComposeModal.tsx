import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Strikethrough,
  Undo2,
  Redo2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { SendLaterPicker } from './SendLaterPicker';
import { api } from '../../services/api';
import { Sender } from '../../types';

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [toInput, setToInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);

  const [leadStats, setLeadStats] = useState<{
    validEmails: string[];
    duplicatesRemoved: number;
    invalidCount: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSenders().then((res) => {
        setSenders(res.senders);
        if (res.senders.length > 0) {
          const defaultSender =
            res.senders.find((s) => s.isDefault) || res.senders[0];
          setSelectedSenderId(defaultSender.id);
        }
      });
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.parseLeads(file);
      setLeadStats(res);
      setToInput(res.validEmails.join(', '));
    } catch (err: any) {
      setError(err.message || 'Failed to extract leads from file');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setError(null);

      if (!selectedSenderId) {
        setError('Please select a sender');
        return;
      }

      if (!subject.trim()) {
        setError('Email subject cannot be empty');
        return;
      }

      if (!body.trim()) {
        setError('Email body cannot be empty');
        return;
      }

      let recipientsList: string[] = [];
      if (leadStats && leadStats.validEmails.length > 0) {
        recipientsList = leadStats.validEmails;
      } else {
        const parsed = await api.parseLeads(toInput);
        if (parsed.validEmails.length === 0) {
          setError('Please provide at least one valid recipient email address');
          return;
        }
        recipientsList = parsed.validEmails;
      }

      setLoading(true);

      await api.scheduleCampaign({
        senderId: selectedSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: recipientsList,
        startTime: scheduledTime ? scheduledTime.toISOString() : undefined,
        delaySeconds,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  const selectedSender = senders.find((s) => s.id === selectedSenderId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-gray-900">
              Compose New Email
            </h2>
          </div>

          <div className="flex items-center gap-3 relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Upload CSV / Text Leads"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
              className={`p-2 rounded-full transition-colors ${
                scheduledTime
                  ? 'text-[#00a854] bg-[#e6f7ec]'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Schedule send time"
            >
              <Clock className="w-4 h-4" />
            </button>

            <SendLaterPicker
              isOpen={isSendLaterOpen}
              onClose={() => setIsSendLaterOpen(false)}
              onSelectTime={(date) => setScheduledTime(date)}
              currentTime={scheduledTime || undefined}
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 rounded-full border border-[#00a854] text-[#00a854] hover:bg-[#e6f7ec] font-semibold text-xs transition-colors disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Send'}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 py-2.5 bg-red-50 border-b border-red-100 text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {scheduledTime && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-100 text-xs text-[#00a854] font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Scheduled to start at {scheduledTime.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => setScheduledTime(null)}
              className="text-[11px] hover:underline"
            >
              Clear schedule
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-8 py-3 flex items-center border-b border-gray-100 gap-4 text-xs">
            <span className="w-16 text-gray-400 font-medium">From</span>
            <div className="relative">
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 pr-8 text-xs font-medium text-gray-800 focus:outline-none focus:border-[#00a854] cursor-pointer"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email} ({s.name})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="px-8 py-3 flex items-center border-b border-gray-100 gap-4 text-xs">
            <span className="w-16 text-gray-400 font-medium">To</span>
            <input
              type="text"
              value={toInput}
              onChange={(e) => {
                setToInput(e.target.value);
                setLeadStats(null);
              }}
              placeholder="recipient@example.com (or click paperclip to upload CSV / text lead list)"
              className="flex-1 border-0 p-0 text-xs text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
            />
          </div>

          {leadStats && (
            <div className="px-8 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-[11px] text-gray-600">
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{leadStats.validEmails.length} valid recipients</span>
              </div>
              {leadStats.duplicatesRemoved > 0 && (
                <span className="text-gray-400">
                  {leadStats.duplicatesRemoved} duplicates removed
                </span>
              )}
              {leadStats.invalidCount > 0 && (
                <span className="text-amber-600">
                  {leadStats.invalidCount} invalid rows skipped
                </span>
              )}
            </div>
          )}

          <div className="px-8 py-3 flex items-center border-b border-gray-100 gap-4 text-xs">
            <span className="w-16 text-gray-400 font-medium">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 border-0 p-0 text-xs text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
            />
          </div>

          <div className="px-8 py-3 flex items-center border-b border-gray-100 gap-8 text-xs bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">
                Delay between 2 emails:
              </span>
              <input
                type="number"
                min="1"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 1)}
                className="w-16 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-center font-mono font-semibold focus:outline-none focus:border-[#00a854]"
              />
              <span className="text-gray-400 text-[11px]">sec</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Hourly Limit:</span>
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                className="w-20 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-center font-mono font-semibold focus:outline-none focus:border-[#00a854]"
              />
              <span className="text-gray-400 text-[11px]">emails/hr</span>
            </div>
          </div>

          <div className="px-8 py-2.5 border-b border-gray-100 flex items-center gap-2 text-gray-400 bg-white text-xs">
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-gray-200 mx-1" />
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100 font-bold">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100 italic">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100 underline">
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-gray-200 mx-1" />
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-gray-200 mx-1" />
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <List className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100">
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="flex-1 w-full p-8 text-xs text-gray-800 placeholder-gray-400 focus:outline-none resize-none min-h-[260px] leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};
