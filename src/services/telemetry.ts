export interface TelemetryEvent {
  type: 'chat_start' | 'action_executed' | 'error' | 'model_used';
  provider?: string;
  model?: string;
  tier?: string;
  tokensUsed?: number;
  latencyMs?: number;
  success?: boolean;
}

class TelemetryService {
  private events: TelemetryEvent[] = [];

  track(event: TelemetryEvent) {
    const ev = { ...event, timestamp: Date.now() };
    this.events.push(ev);
    console.log(`[TELEMETRY] ${JSON.stringify(ev)}`);
  }

  getStats() {
    const stats = {
      totalTokens: this.events.reduce((acc, e) => acc + (e.tokensUsed || 0), 0),
      byProvider: {} as Record<string, number>,
      byTier: {} as Record<string, number>,
      avgLatency: this.events.filter(e => e.latencyMs).reduce((acc, e) => acc + e.latencyMs!, 0) / (this.events.filter(e => e.latencyMs).length || 1)
    };

    for (const e of this.events) {
      if (e.provider) stats.byProvider[e.provider] = (stats.byProvider[e.provider] || 0) + 1;
      if (e.tier) stats.byTier[e.tier] = (stats.byTier[e.tier] || 0) + 1;
    }

    return stats;
  }
}

export const telemetry = new TelemetryService();
