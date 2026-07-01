export const notificationTypes = [
  'hot_prospect',
  'new_conversation',
  'potential_booking',
  'follow_up_today',
  'follow_up_overdue',
  'system_error',
  'ai_provider_unavailable',
  'export_completed',
  'new_organization',
  'new_site'
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export const notificationProviders = ['internal', 'email', 'webhook'] as const;

export type NotificationProviderName = (typeof notificationProviders)[number] | 'resend' | 'mock';

export const notificationStatuses = ['pending', 'sent', 'failed', 'skipped'] as const;

export type NotificationStatus = (typeof notificationStatuses)[number];

export type NotificationVariables = Partial<
  Record<
    | 'firstName'
    | 'lastName'
    | 'organization'
    | 'site'
    | 'conversationUrl'
    | 'score'
    | 'status'
    | 'tags'
    | 'createdAt',
    string | number
  >
> &
  Record<string, string | number | undefined>;

export type NotificationSettings = {
  organizationId: string;
  adminEmails: string[];
  notificationsEnabled: boolean;
  frequency: 'instant' | 'daily' | 'disabled';
  language: string;
  preferredProvider: 'mock' | 'resend';
  webhookUrl: string | null;
  webhookHeaders: Record<string, string>;
  webhookSecret: string | null;
  retryAttempts: number;
  timeoutMs: number;
};

export type NotificationRequest = {
  type: NotificationType;
  organizationId: string;
  siteId?: string;
  recipient?: string;
  variables?: NotificationVariables;
  channels?: Array<'internal' | 'email' | 'webhook'>;
};

export type NotificationRecordInput = {
  organizationId: string;
  siteId?: string;
  type: NotificationType;
  title: string;
  subject: string;
  contentPreview?: string;
  recipient?: string;
  provider: NotificationProviderName;
  status: NotificationStatus;
  errorMessage?: string;
  attemptCount: number;
  sentAt?: Date;
};

export type NotificationRecord = {
  id: string;
  organization_id: string;
  site_id: string | null;
  type: NotificationType;
  title: string;
  subject: string;
  content_preview: string | null;
  recipient: string | null;
  provider: NotificationProviderName;
  status: NotificationStatus;
  error_message: string | null;
  attempt_count: number;
  sent_at: Date | null;
  created_at: Date;
};
