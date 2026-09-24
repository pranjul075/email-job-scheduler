import React, { useState, useRef, useEffect } from 'react';
import { Clock, Send, ChevronDown, LogOut, ExternalLink, MessageSquare, Check, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EmailCounts } from '../../types';

export interface SidebarProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  onOpenSlackModal: () => void;
  counts: EmailCounts;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenCompose,
  onOpenSlackModal,
  counts,
}) => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = user?.name || 'Oliver Brown';
  const userEmail = user?.email || 'oliver.brown@domain.io';

  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-100 flex flex-col justify-between shrink-0 select-none">
      <div className="p-5 flex flex-col gap-6">
        <div className="flex items-center gap-2.5 px-0.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00a854] to-[#05c464] flex items-center justify-center shadow-sm text-white shrink-0">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="15" x="2" y="4" rx="2.5" />
              <path d="m22 6.5-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 6.5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center text-lg font-bold tracking-tight text-gray-900 leading-none">
              <span>Reach</span>
              <span className="text-[#00a854]">Inbox</span>
            </div>
            <span className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase mt-1">
              Job Scheduler
            </span>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-gray-50/70 hover:bg-gray-100 transition-colors border border-gray-100"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#00a854] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col text-left truncate">
                <span className="text-xs font-semibold text-gray-900 truncate">
                  {userName}
                </span>
                <span className="text-[11px] text-gray-400 truncate">
                  {userEmail}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
          </button>

          {menuOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 text-xs">
              <div className="px-3 py-2 border-b border-gray-50 flex flex-col">
                <span className="font-semibold text-gray-800">{userName}</span>
                <span className="text-gray-400 truncate">{userEmail}</span>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSlackModal();
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-[#00a854]" />
                  <span>Slack Alerts</span>
                </div>
                {user?.slackConnected ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                    <Check className="w-2.5 h-2.5" /> Connected
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">Not linked</span>
                )}
              </button>
              <a
                href="/admin/queues"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>BullMQ Live Queues</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">Live</span>
              </a>
              <div className="my-1 border-t border-gray-50" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onOpenCompose}
          className="w-full py-2.5 px-4 rounded-full border border-[#00a854] text-[#00a854] font-medium text-sm hover:bg-[#e6f7ec] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Compose</span>
        </button>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 px-3 uppercase mb-1">
            CORE
          </span>

          <button
            onClick={() => onTabChange('scheduled')}
            className={`flex items-center justify-between px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
              activeTab === 'scheduled'
                ? 'bg-[#e6f7ec] text-[#00a854] font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Scheduled</span>
            </div>
            <span
              className={`text-xs ${
                activeTab === 'scheduled' ? 'text-[#00a854] font-bold' : 'text-gray-400'
              }`}
            >
              {counts.scheduledCount}
            </span>
          </button>

          <button
            onClick={() => onTabChange('sent')}
            className={`flex items-center justify-between px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
              activeTab === 'sent'
                ? 'bg-[#e6f7ec] text-[#00a854] font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4 shrink-0" />
              <span>Sent</span>
            </div>
            <span
              className={`text-xs ${
                activeTab === 'sent' ? 'text-[#00a854] font-bold' : 'text-gray-400'
              }`}
            >
              {counts.sentCount}
            </span>
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 flex flex-col gap-2">
        <button
          onClick={onOpenSlackModal}
          className="flex items-center justify-between text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span>Slack Rate Limit Alerts</span>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              user?.slackConnected ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
        </button>

        <a
          href="/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            <span>BullMQ Live Monitor</span>
          </div>
        </a>
      </div>
    </aside>
  );
};
