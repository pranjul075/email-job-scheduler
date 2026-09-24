import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { EmailListItem } from '../components/email/EmailListItem';
import { EmailDetailModal } from '../components/email/EmailDetailModal';
import { ComposeModal } from '../components/email/ComposeModal';
import { SlackConnectModal } from '../components/slack/SlackConnectModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { api } from '../services/api';
import { ScheduledEmail, EmailCounts } from '../types';
import { Clock, Send, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [counts, setCounts] = useState<EmailCounts>({ scheduledCount: 0, sentCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get('slack_connected');
    const errParam = params.get('slack_error');
    if (connected === 'true' || errParam) {
      setIsSlackOpen(true);
      if (errParam) {
        setSlackError(decodeURIComponent(errParam));
      } else {
        setSlackError(null);
        refreshUser();
      }
      navigate('/dashboard', { replace: true });
    }
  }, [location.search]);


  const fetchCounts = useCallback(async () => {
    try {
      const res = await api.getEmailCounts();
      setCounts(res);
    } catch {}
  }, []);

  const fetchEmails = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);

      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        const res = await api.searchEmails(
          searchQuery,
          activeTab === 'scheduled' ? undefined : undefined,
          page,
          30
        );
        setEmails(res.items);
        setTotalPages(Math.max(1, Math.ceil(res.total / 30)));
      } else {
        setIsSearching(false);
        if (activeTab === 'scheduled') {
          const res = await api.getScheduledEmails(page, 30);
          setEmails(res.items);
          setTotalPages(res.totalPages || 1);
        } else {
          const res = await api.getSentEmails(page, 30);
          setEmails(res.items);
          setTotalPages(res.totalPages || 1);
        }
      }

      await fetchCounts();
    } catch (err: any) {
      setError(err.message || 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, page, fetchCounts]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchEmails(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchEmails]);

  const handleOpenDetail = (email: ScheduledEmail) => {
    setSelectedEmail(email);
    setIsDetailOpen(true);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setPage(1);
          setSearchQuery('');
        }}
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        counts={counts}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onRefresh={() => fetchEmails(false)}
          isRefreshing={loading}
        />

        <main className="flex-1 overflow-y-auto">
          {loading && emails.length === 0 ? (
            <LoadingSpinner message="Loading messages..." />
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={() => fetchEmails(false)}
            />
          ) : emails.length === 0 ? (
            <EmptyState
              title={
                searchQuery
                  ? 'No matching emails found'
                  : activeTab === 'scheduled'
                  ? 'No scheduled emails'
                  : 'No sent emails yet'
              }
              description={
                searchQuery
                  ? 'Try searching with different keywords or recipient emails.'
                  : activeTab === 'scheduled'
                  ? 'Compose a new message to schedule delayed email jobs with BullMQ.'
                  : 'Emails dispatched by workers will appear here once processed.'
              }
              actionText={activeTab === 'scheduled' && !searchQuery ? 'Compose New Email' : undefined}
              onAction={() => setIsComposeOpen(true)}
              icon={
                searchQuery ? (
                  <Search className="w-6 h-6 text-gray-400" />
                ) : activeTab === 'scheduled' ? (
                  <Clock className="w-6 h-6 text-[#00a854]" />
                ) : (
                  <Send className="w-6 h-6 text-gray-400" />
                )
              }
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {emails.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  onClick={() => handleOpenDetail(email)}
                />
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 text-xs text-gray-500">
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded bg-white border border-gray-200 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded bg-white border border-gray-200 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <EmailDetailModal
        email={selectedEmail}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedEmail(null);
        }}
      />

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          setActiveTab('scheduled');
          fetchEmails();
        }}
      />

      <SlackConnectModal
        isOpen={isSlackOpen}
        onClose={() => {
          setIsSlackOpen(false);
          setSlackError(null);
        }}
        initialError={slackError}
      />
    </div>
  );
};
