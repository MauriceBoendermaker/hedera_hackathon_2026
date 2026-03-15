const ANALYTICS_URL = process.env.REACT_APP_ANALYTICS_URL || 'http://localhost:5001';

export interface LinkCreatedEvent {
  slug: string;
  originalUrl: string;
  creator: string;
  type: "random" | "custom";
  txHash: string;
  timestamp: number;
}

export async function logLinkCreated(event: LinkCreatedEvent): Promise<void> {
  try {
    const res = await fetch(`${ANALYTICS_URL}/hcs/log-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      console.warn('HCS log-link failed:', res.status);
    }
  } catch (err) {
    console.warn('HCS log-link error:', err);
  }
}
