import fetch from 'node-fetch';
import { NotificationPayload, LeakResult } from './types';

export class Notifier {
  /**
   * 通知を送信
   */
  static async send(
    type: 'slack' | 'webhook' | 'email',
    url: string,
    leaks: LeakResult[],
    repository: string,
    customMessage?: string
  ): Promise<void> {
    const payload: NotificationPayload = {
      leaks,
      totalLeaks: leaks.length,
      repository,
      detectedAt: new Date().toISOString()
    };

    switch (type) {
      case 'slack':
        await this.sendSlackNotification(url, payload, customMessage);
        break;
      case 'webhook':
        await this.sendWebhookNotification(url, payload);
        break;
      case 'email':
        console.warn('Email notification is not yet implemented. Use webhook or Slack instead.');
        break;
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  /**
   * Slack通知を送信
   */
  private static async sendSlackNotification(
    webhookUrl: string,
    payload: NotificationPayload,
    customMessage?: string
  ): Promise<void> {
    const message = customMessage || '⚠️ GitHub上でソースコードの流出が検出されました';
    
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: message
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*リポジトリ:*\n${payload.repository}`
          },
          {
            type: 'mrkdwn',
            text: `*検出数:*\n${payload.totalLeaks}件`
          },
          {
            type: 'mrkdwn',
            text: `*検出日時:*\n${new Date(payload.detectedAt).toLocaleString('ja-JP')}`
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    // 各流出情報を追加
    for (const leak of payload.leaks.slice(0, 10)) { // 最大10件まで表示
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*リポジトリ:*\n<${leak.repositoryUrl}|${leak.repositoryName}>`
          },
          {
            type: 'mrkdwn',
            text: `*オーナー:*\n<${leak.ownerGithubUrl}|${leak.ownerName}>`
          },
          {
            type: 'mrkdwn',
            text: `*作成日時:*\n${new Date(leak.createdAt).toLocaleString('ja-JP')}`
          },
          {
            type: 'mrkdwn',
            text: `*マッチパターン:*\n\`${leak.matchedPattern}\``
          }
        ]
      } as any);
    }

    if (payload.totalLeaks > 10) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_他 ${payload.totalLeaks - 10} 件の流出が検出されています_`
          }
        ]
      } as any);
    }

    const slackPayload = {
      text: message,
      blocks
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackPayload)
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
      }

      console.log('✓ Slack notification sent successfully');
    } catch (error) {
      throw new Error(`Failed to send Slack notification: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Webhook通知を送信
   */
  private static async sendWebhookNotification(
    webhookUrl: string,
    payload: NotificationPayload
  ): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook notification failed: ${response.status} ${response.statusText}`);
      }

      console.log('✓ Webhook notification sent successfully');
    } catch (error) {
      throw new Error(`Failed to send webhook notification: ${error instanceof Error ? error.message : error}`);
    }
  }
}
