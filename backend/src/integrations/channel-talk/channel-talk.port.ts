export type NotificationEvent =
  | 'ORDER_SUBMITTED_SUCCESS'
  | 'GOODS_PAYMENT_COMPLETED'
  | 'INSPECTION_READY'
  | 'INTERNATIONAL_CHARGE_READY'
  | 'FORWARDING_SHIPPED';

export interface ChannelTalkPort {
  sendNotification(input: SendNotificationInput): Promise<SendNotificationResult>;
}

export interface SendNotificationInput {
  event: NotificationEvent;
  recipientKey: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
}

export interface SendNotificationResult {
  providerMessageId: string;
}
