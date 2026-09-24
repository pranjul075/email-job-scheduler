import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import type { EmailStatus } from '@prisma/client';

export interface EmailDocument {
  id: string;
  recipientEmail: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  userId: string;
  campaignId: string;
  createdAt: string;
  updatedAt: string;
}

const INDEX_NAME = 'emails';

export class SearchService {
  private client: Client;
  private isAvailable = false;

  constructor() {
    this.client = new Client({
      node: env.ELASTICSEARCH_URL,
    });
    this.checkHealthAndInitialize();
  }

  public async checkHealthAndInitialize(): Promise<boolean> {
    try {
      await this.client.ping();
      this.isAvailable = true;

      const indexExists = await this.client.indices.exists({ index: INDEX_NAME });
      if (!indexExists) {
        await this.client.indices.create({
          index: INDEX_NAME,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              senderEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              senderName: { type: 'text' },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        });
      }
      return true;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  public async indexEmail(doc: EmailDocument): Promise<void> {
    try {
      if (!this.isAvailable) {
        const healthy = await this.checkHealthAndInitialize();
        if (!healthy) return;
      }
      await this.client.index({
        index: INDEX_NAME,
        id: doc.id,
        document: doc,
      });
    } catch {}
  }

  public async updateEmailStatus(
    id: string,
    status: EmailStatus,
    sentAt?: Date | null,
    error?: string | null
  ): Promise<void> {
    try {
      if (!this.isAvailable) {
        const healthy = await this.checkHealthAndInitialize();
        if (!healthy) return;
      }
      await this.client.update({
        index: INDEX_NAME,
        id,
        doc: {
          status,
          sentAt: sentAt ? sentAt.toISOString() : null,
          error: error || null,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch {}
  }

  public async searchUserEmails(params: {
    userId: string;
    query?: string;
    status?: EmailStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    if (this.isAvailable) {
      try {
        const mustClauses: any[] = [{ term: { userId: params.userId } }];

        if (params.status) {
          mustClauses.push({ term: { status: params.status } });
        }

        if (params.query && params.query.trim().length > 0) {
          mustClauses.push({
            multi_match: {
              query: params.query.trim(),
              fields: ['subject^3', 'recipientEmail^2', 'senderEmail^2', 'senderName', 'body'],
              fuzziness: 'AUTO',
            },
          });
        }

        const response = await this.client.search({
          index: INDEX_NAME,
          from: skip,
          size: limit,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ scheduledAt: { order: 'desc' } }],
        });

        const hits = response.hits.hits;
        const total = typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

        const emailIds = hits.map((h: any) => h._id);

        if (emailIds.length > 0) {
          const dbEmails = await prisma.scheduledEmail.findMany({
            where: { id: { in: emailIds } },
            include: { senderRef: true },
          });

          const map = new Map(dbEmails.map((e) => [e.id, e]));
          const sorted = emailIds.map((id) => map.get(id)).filter(Boolean);

          return {
            source: 'elasticsearch',
            total,
            page,
            limit,
            items: sorted,
          };
        }

        return {
          source: 'elasticsearch',
          total,
          page,
          limit,
          items: [],
        };
      } catch {
        this.isAvailable = false;
      }
    }

    const whereClause: any = {
      userId: params.userId,
    };

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.query && params.query.trim().length > 0) {
      const q = params.query.trim();
      whereClause.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { senderRef: { email: { contains: q, mode: 'insensitive' } } },
        { senderRef: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.scheduledEmail.count({ where: whereClause }),
      prisma.scheduledEmail.findMany({
        where: whereClause,
        include: { senderRef: true },
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      source: 'database',
      total,
      page,
      limit,
      items,
    };
  }
}

export const searchService = new SearchService();
