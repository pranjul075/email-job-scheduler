import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

export interface SendLaterPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTime: (date: Date) => void;
  currentTime?: Date;
}

export const SendLaterPicker: React.FC<SendLaterPickerProps> = ({
  isOpen,
  onClose,
  onSelectTime,
  currentTime,
}) => {
  if (!isOpen) return null;

  const now = new Date();
  const defaultIso = (currentTime || new Date(now.getTime() + 3600000))
    .toISOString()
    .slice(0, 16);

  const [customDateTime, setCustomDateTime] = useState(defaultIso);

  const getPresetDate = (hours: number, minutes = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const presets = [
    { label: 'Tomorrow, 9:00 AM', date: getPresetDate(9, 0) },
    { label: 'Tomorrow, 10:00 AM', date: getPresetDate(10, 0) },
    { label: 'Tomorrow, 11:00 AM', date: getPresetDate(11, 0) },
    { label: 'Tomorrow, 3:00 PM', date: getPresetDate(15, 0) },
  ];

  const handleDone = () => {
    if (customDateTime) {
      onSelectTime(new Date(customDateTime));
    }
    onClose();
  };

  return (
    <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 animate-scaleUp">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#00a854]" />
          <span>Send Later</span>
        </h3>
      </div>

      <div className="mb-4">
        <label className="block text-[11px] font-medium text-gray-500 mb-1.5">
          Pick date & time
        </label>
        <div className="relative flex items-center">
          <CalendarIcon className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="datetime-local"
            value={customDateTime}
            onChange={(e) => setCustomDateTime(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#00a854] focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 mb-5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
          Quick Presets
        </span>
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              onSelectTime(preset.date);
              onClose();
            }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-[#e6f7ec] hover:text-[#00a854] rounded-lg transition-colors font-medium flex items-center justify-between"
          >
            <span>{preset.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleDone}
          className="px-4 py-1.5 rounded-full border border-[#00a854] text-[#00a854] hover:bg-[#e6f7ec] text-xs font-semibold transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
