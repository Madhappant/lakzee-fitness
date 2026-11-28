import { redactSensitiveData, logger } from './logger';

export type AlertRuleKey =
  | 'HEALTH_CHECK_FAILED'
  | 'SERVER_ERROR_SPIKE'
  | 'BRUTE_FORCE_AUTH_SPIKE'
  | 'HIGH_API_LATENCY';

export type AlertSeverity = 'warning' | 'critical';

export interface AlertPayload {
  rule: AlertRuleKey;
  severity: AlertSeverity;
  title: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface RecordedAlert extends AlertPayload {
  id: string;
  timestamp: string;
  deliveredChannels: string[];
}

const MAX_ALERT_HISTORY = 50;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

class AlertManager {
  private lastTriggeredAt = new Map<AlertRuleKey, number>();
  private history: RecordedAlert[] = [];
  private pendingDeliveries = new Set<Promise<void>>();

  private getCooldownMs(): number {
    const parsed = Number(process.env.ALERT_COOLDOWN_MS);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_COOLDOWN_MS;
  }

  trigger(payload: AlertPayload): boolean {
    const now = Date.now();
    const cooldownMs = this.getCooldownMs();
    const prevTime = this.lastTriggeredAt.get(payload.rule);
    if (prevTime !== undefined && now - prevTime < cooldownMs) {
      return false;
    }

    this.lastTriggeredAt.set(payload.rule, now);
    const safeContext = payload.context
      ? (redactSensitiveData(payload.context) as Record<string, unknown>)
      : undefined;

    const record: RecordedAlert = {
      ...payload,
      context: safeContext,
      id: `alt-${now}-${this.history.length + 1}`,
      timestamp: new Date(now).toISOString(),
      deliveredChannels: ['structured-log'],
    };

    if (this.history.length >= MAX_ALERT_HISTORY) {
      this.history.shift();
    }
    this.history.push(record);

    const logFn = payload.severity === 'critical' ? logger.error : logger.warn;
    logFn(`SRE Alert [${payload.rule}]: ${payload.title}`, {
      rule: payload.rule,
      severity: payload.severity,
      message: payload.message,
      ...(safeContext ? { context: safeContext } : {}),
    });

    const delivery = this.deliverWebhooks(record);
    this.pendingDeliveries.add(delivery);
    void delivery.finally(() => {
      this.pendingDeliveries.delete(delivery);
    });

    return true;
  }

  private async deliverWebhooks(alert: RecordedAlert): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const telegramChatId = process.env.TELEGRAM_CHAT_ID?.trim();
    const tasks: Promise<void>[] = [];

    if (webhookUrl) {
      const isDiscord = webhookUrl.includes('discord.com/api/webhooks') || webhookUrl.includes('discordapp.com/api/webhooks');
      const body = isDiscord
        ? {
            content: `[${alert.severity.toUpperCase()}] **${alert.title}** (\`${alert.rule}\`)\n${alert.message}`,
          }
        : {
            text: `[${alert.severity.toUpperCase()}] ${alert.title} (${alert.rule}): ${alert.message}`,
            service: 'lakzee-backend',
            alert,
          };

      tasks.push(
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3000),
        })
          .then((res) => {
            if (res.ok) alert.deliveredChannels.push('webhook');
          })
          .catch(() => {
            // Alert delivery failures are intentionally non-fatal
          })
      );
    }

    if (telegramToken && telegramChatId) {
      const tgUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
      tasks.push(
        fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: `[${alert.severity.toUpperCase()}] ${alert.title} (${alert.rule})\n${alert.message}`,
          }),
          signal: AbortSignal.timeout(3000),
        })
          .then((res) => {
            if (res.ok) alert.deliveredChannels.push('telegram');
          })
          .catch(() => {
            // Non-fatal
          })
      );
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }

  getRecentAlerts(limit = 20): RecordedAlert[] {
    return this.history.slice(-limit).reverse();
  }

  async flush(): Promise<void> {
    if (this.pendingDeliveries.size > 0) {
      await Promise.allSettled([...this.pendingDeliveries]);
    }
  }

  reset(): void {
    this.lastTriggeredAt.clear();
    this.history = [];
  }
}

export const alertManager = new AlertManager();
