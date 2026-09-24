import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle2, AlertCircle, ExternalLink, Unlink } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { SlackStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';

export interface SlackConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialError?: string | null;
}

export const SlackConnectModal: React.FC<SlackConnectModalProps> = ({
  isOpen,
  onClose,
  initialError,
}) => {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSlackStatus();
      setStatus(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load Slack status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialError) {
        setError(initialError);
        setLoading(false);
      } else {
        setError(null);
      }
      fetchStatus();
    }
  }, [isOpen, initialError]);

  const handleConnect = async () => {
    try {
      setError(null);
      const res = await api.getSlackConnectUrl();
      window.location.href = res.url;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Slack connection');
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      setError(null);
      await api.disconnectSlack();
      await fetchStatus();
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Slack Integration" maxWidth="max-w-md">
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#4a154b] text-white flex items-center justify-center shrink-0 shadow-sm">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Rate Limit Alert Notifications
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Receive real-time Slack alerts whenever an hourly sender limit is reached.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">Status</span>
            {status?.connected ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="text-gray-400 font-medium">Not Connected</span>
            )}
          </div>

          {status?.connected && (
            <>
              {status.teamName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Workspace</span>
                  <span className="font-semibold text-gray-800">
                    {status.teamName}
                  </span>
                </div>
              )}
              {status.channelName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Alert Channel</span>
                  <span className="font-semibold text-gray-800">
                    #{status.channelName}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {status?.connected ? (
            <Button
              onClick={handleDisconnect}
              variant="danger"
              size="sm"
              loading={loading}
              icon={<Unlink className="w-3.5 h-3.5" />}
            >
              Disconnect Slack
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              variant="primary"
              size="sm"
              loading={loading}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              Connect Slack
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
