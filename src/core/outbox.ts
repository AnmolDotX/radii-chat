import { OutboxItem, NetworkMode, Message } from './types';

class OutboxManager {
  private queue: OutboxItem[] = [];
  private listeners: Set<(items: OutboxItem[]) => void> = new Set();

  public getItems(): OutboxItem[] {
    return [...this.queue];
  }

  public enqueue(
    message: Omit<Message, 'id' | 'timestamp' | 'status'>,
    allowedModes: NetworkMode[] = ['offline', 'lan'],
    reason: OutboxItem['reason'] = 'peer_out_of_radio_range'
  ): OutboxItem {
    const item: OutboxItem = {
      id: `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      recipientId: message.conversationId,
      recipientName: message.senderName,
      payload: message.text,
      queuedAt: Date.now(),
      allowedModes,
      reason,
      retryCount: 0,
    };

    this.queue.push(item);
    this.notify();
    return item;
  }

  public dequeue(id: string): void {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.notify();
  }

  public clear(): void {
    this.queue = [];
    this.notify();
  }

  public subscribe(listener: (items: OutboxItem[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.queue]);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const current = [...this.queue];
    this.listeners.forEach((listener) => listener(current));
  }
}

export const outbox = new OutboxManager();
