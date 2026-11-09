export type NotifyResult = 'shown' | 'denied' | 'default' | 'unsupported';

/**
 * Shows a system notification, asking permission first if it has never been
 * asked. Call it from a click or a key: browsers prompt only then. Any other
 * option is passed to the Notification.
 */
export function notify(
  message: string,
  options?: { title?: string; icon?: string } & Omit<NotificationOptions, 'body'>
): Promise<NotifyResult>;
