export type EmailStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_FAILED' | 'CANCELLED';

export interface Sender {
  id: string;
  name: string;
  email: string;
  host: string;
  port: number;
  isDefault: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  senders?: Sender[];
  slackConnected?: boolean;
  slackTeam?: string | null;
  slackChannel?: string | null;
}

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  senderId: string;
  userId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  sentAt?: string | null;
  error?: string | null;
  bullJobId?: string | null;
  idempotencyKey: string;
  etherealMessageId?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  senderRef?: {
    id: string;
    name: string;
    email: string;
  };
  campaignRef?: {
    id: string;
    name: string;
  };
}

export interface Campaign {
  id: string;
  userId: string;
  senderId: string;
  name: string;
  subject: string;
  body: string;
  delaySeconds: number;
  hourlyLimit: number;
  scheduledAt: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  senderRef?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
  channelName: string | null;
}

export interface EmailCounts {
  scheduledCount: number;
  sentCount: number;
}
