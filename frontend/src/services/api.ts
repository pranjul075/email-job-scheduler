import {
  User,
  Sender,
  ScheduledEmail,
  Campaign,
  SlackStatus,
  EmailCounts,
  EmailStatus,
} from '../types';

const BASE_URL = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config: RequestInit = {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      credentials: 'include',
    };

    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const data = await response.json();
        errorMessage = data.error || data.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  async login(email: string, password: string): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name?: string): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  }

  getGoogleAuthUrl(): string {
    return `${BASE_URL}/auth/google`;
  }

  async getScheduledEmails(page = 1, limit = 20): Promise<{
    items: ScheduledEmail[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.request(`/emails/scheduled?page=${page}&limit=${limit}`);
  }

  async getSentEmails(page = 1, limit = 20): Promise<{
    items: ScheduledEmail[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.request(`/emails/sent?page=${page}&limit=${limit}`);
  }

  async searchEmails(query: string, status?: EmailStatus, page = 1, limit = 20): Promise<{
    source: string;
    total: number;
    page: number;
    items: ScheduledEmail[];
  }> {
    const params = new URLSearchParams({
      q: query,
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) params.append('status', status);
    return this.request(`/emails/search?${params.toString()}`);
  }

  async getEmailCounts(): Promise<EmailCounts> {
    return this.request<EmailCounts>('/emails/counts');
  }

  async getEmailById(id: string): Promise<{ email: ScheduledEmail }> {
    return this.request<{ email: ScheduledEmail }>(`/emails/${id}`);
  }

  async getSenders(): Promise<{ senders: Sender[] }> {
    return this.request<{ senders: Sender[] }>('/senders');
  }

  async createSender(data: {
    name: string;
    email: string;
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    isDefault?: boolean;
  }): Promise<{ sender: Sender }> {
    return this.request<{ sender: Sender }>('/senders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async scheduleCampaign(data: {
    senderId: string;
    name?: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delaySeconds?: number;
    hourlyLimit?: number;
  }): Promise<{ success: boolean; campaign: Campaign; scheduledCount: number }> {
    return this.request('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async parseLeads(fileOrText: File | string): Promise<{
    validEmails: string[];
    validCount: number;
    duplicatesRemoved: number;
    invalidCount: number;
  }> {
    if (typeof fileOrText === 'string') {
      return this.request('/schedules/parse-leads', {
        method: 'POST',
        body: JSON.stringify({ text: fileOrText }),
      });
    }

    const formData = new FormData();
    formData.append('file', fileOrText);

    return this.request('/schedules/parse-leads', {
      method: 'POST',
      body: formData,
    });
  }

  async getSlackStatus(): Promise<SlackStatus> {
    return this.request<SlackStatus>('/slack/status');
  }

  async getSlackConnectUrl(): Promise<{ url: string }> {
    return this.request<{ url: string }>('/slack/connect');
  }

  async disconnectSlack(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/slack/disconnect', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
