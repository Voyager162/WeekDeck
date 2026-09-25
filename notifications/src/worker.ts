import { DurableObject } from 'cloudflare:workers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';
import {
  blockEvents,
  weeklyEvents,
  nextOccurrence,
  validSubscription,
  validTimezone,
  HORIZON,
  STALE_AFTER,
  type Event,
  type Settings,
} from './plan';
import { readPlan } from './firestore';

interface Env {
  REMINDERS: DurableObjectNamespace<ReminderAccount>;
  FIREBASE_PROJECT_ID: string;
  APP_ORIGIN: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}
type Device = {
  subscription: PushSubscription;
  timezone: string;
  weekly: Event[];
  delivered: Record<string, number>;
  expires: number;
  lastTest?: number;
};
type State = {
  devices: Device[];
  events: Event[];
  settings?: Settings;
  refreshed: number;
  revision: number;
};
const KEYS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);
const empty = (): State => ({ devices: [], events: [], refreshed: 0, revision: 0 });
const json = (body: unknown, status = 200) => Response.json(body, { status });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = [env.APP_ORIGIN, 'timeblocker://app'];
    const headers = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : env.APP_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    };
    const finish = (response: Response) => {
      const result = new Response(response.body, response);
      for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
      return result;
    };
    if (origin && !allowed.includes(origin))
      return finish(json({ error: 'Origin not allowed' }, 403));
    if (request.method === 'OPTIONS') return finish(new Response(null, { status: 204 }));
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === '/config')
      return finish(
        json({
          publicKey: env.VAPID_PUBLIC_KEY ?? null,
          ready: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
        }),
      );
    if (!['/subscribe', '/sync', '/test', '/device', '/account'].includes(path))
      return finish(json({ error: 'Not found' }, 404));
    const method = ['/device', '/account'].includes(path) ? 'DELETE' : 'POST';
    if (request.method !== method) return finish(json({ error: 'Method not allowed' }, 405));
    const token = request.headers.get('Authorization');
    if (!token?.startsWith('Bearer ')) return finish(json({ error: 'Sign in required' }, 401));
    let uid: string;
    try {
      const { payload } = await jwtVerify(token.slice(7), KEYS, {
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        audience: env.FIREBASE_PROJECT_ID,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'iat', 'exp'],
      });
      if (!payload.sub || payload.sub.length > 128) throw new Error('Invalid account');
      uid = payload.sub;
    } catch {
      return finish(json({ error: 'Sign in required' }, 401));
    }
    // Keep bodies bounded even when Content-Length is omitted or misleading.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 4096) {
          await reader.cancel();
          return finish(json({ error: 'Request too large' }, 413));
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const internal = new Request(request.url, {
      method,
      headers: { Authorization: token, 'X-Account': uid, 'Content-Type': 'application/json' },
      body: length ? bytes : '{}',
    });
    try {
      return finish(await env.REMINDERS.get(env.REMINDERS.idFromName(uid)).fetch(internal));
    } catch {
      return finish(json({ error: 'Reminder service unavailable. Try again.' }, 503));
    }
  },
} satisfies ExportedHandler<Env>;

export class ReminderAccount extends DurableObject<Env> {
  private queue: Promise<unknown> = Promise.resolve();
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => {}).then(work);
    this.queue = next.then(
      () => {},
      () => {},
    );
    return next;
  }
  async fetch(request: Request) {
    // Serialize canonical Firebase reads with alarm delivery and deletion.
    return this.exclusive(async () => {
      const path = new URL(request.url).pathname;
      if (path === '/account') {
        await this.ctx.storage.deleteAlarm();
        await this.ctx.storage.deleteAll();
        return json({ ok: true });
      }
      const state = (await this.ctx.storage.get<State>('state')) ?? empty();
      let body: { endpoint?: string; subscription?: unknown; timezone?: unknown };
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid request' }, 400);
      }
      if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);
      if (path === '/device') {
        state.devices = state.devices.filter((d) => d.subscription.endpoint !== body.endpoint);
        await this.save(state);
        return json({ ok: true });
      }
      if (path === '/test') {
        const device = state.devices.find((d) => d.subscription.endpoint === body.endpoint);
        if (!device) return json({ error: 'Enable this device first' }, 404);
        if (Date.now() - (device.lastTest ?? 0) < 60_000)
          return json({ error: 'Wait a minute before testing again' }, 429);
        device.lastTest = Date.now();
        await this.save(state);
        const result = await this.send(device, {
          key: 'test',
          at: Date.now(),
          title: 'Weekdeck',
          body: 'Notifications are ready on this device.',
        });
        if (result === 'gone') {
          state.devices = state.devices.filter((d) => d !== device);
          await this.save(state);
        }
        return result === 'sent'
          ? json({ ok: true })
          : json({ error: 'Delivery failed. Enable this device again.' }, 503);
      }
      if (path === '/subscribe') {
        if (!validSubscription(body.subscription) || !validTimezone(body.timezone))
          return json({ error: 'Invalid subscription' }, 400);
        const subscription = body.subscription;
        const existing = state.devices.find(
          (d) => d.subscription.endpoint === subscription.endpoint,
        );
        if (!existing && state.devices.length >= 5)
          return json({ error: 'Five devices are already enabled. Disable one first.' }, 409);
        if (existing) {
          if (existing.timezone !== body.timezone) existing.weekly = [];
          existing.timezone = body.timezone;
          existing.expires = Date.now() + 90 * 86400_000;
        } else
          state.devices.push({
            subscription,
            timezone: body.timezone,
            weekly: [],
            delivered: {},
            expires: Date.now() + 90 * 86400_000,
          });
      } else if (!state.devices.length) return json({ ok: true, devices: 0 });
      if (path === '/sync' && Date.now() - state.refreshed < 1500)
        return json({ error: 'Sync again shortly' }, 429);
      const now = Date.now();
      let plan;
      try {
        plan = await readPlan(
          this.env.FIREBASE_PROJECT_ID,
          request.headers.get('X-Account')!,
          request.headers.get('Authorization')!,
          now,
        );
      } catch {
        return json({ error: 'Could not read the saved planner. Reconnect and try again.' }, 503);
      }
      state.events = blockEvents(plan.blocks, plan.settings, now, now - STALE_AFTER);
      state.settings = plan.settings;
      state.refreshed = now;
      state.revision++;
      for (const device of state.devices) {
        const previous = device.weekly;
        device.weekly = weeklyEvents(plan.settings, device.timezone, now).map((event) => {
          const due = previous.find(
            (old) =>
              old.cron === event.cron &&
              old.at <= now &&
              old.at >= now - STALE_AFTER &&
              !device.delivered[`${old.key}:${old.at}`],
          );
          return due ?? event;
        });
      }
      await this.save(state);
      return json({ ok: true, devices: state.devices.length, through: now + HORIZON });
    });
  }
  private async save(state: State) {
    const now = Date.now();
    state.devices = state.devices.filter((d) => d.expires > now);
    state.events = state.events.filter((e) => e.at >= now - STALE_AFTER);
    for (const device of state.devices)
      for (const [key, at] of Object.entries(device.delivered))
        if (at < now - STALE_AFTER) delete device.delivered[key];
    if (!state.devices.length) {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      return;
    }
    let next = Math.min(...state.devices.map((d) => d.expires));
    for (const device of state.devices)
      for (const event of [...state.events, ...device.weekly])
        if (!device.delivered[`${event.key}:${event.at}`]) next = Math.min(next, event.at);
    await this.ctx.storage.put('state', state);
    await this.ctx.storage.setAlarm(Math.max(now + 1000, next));
  }
  async alarm() {
    return this.exclusive(async () => {
      const state = await this.ctx.storage.get<State>('state');
      if (!state) return;
      const now = Date.now();
      let retry = false;
      let sent = 0;
      devices: for (const device of state.devices) {
        if (device.expires <= now) continue;
        for (const event of [...state.events, ...device.weekly]) {
          if (event.at > now) continue;
          const tag = `${event.key}:${event.at}`;
          if (!device.delivered[tag] && event.at >= now - STALE_AFTER) {
            if (sent++ >= 5) break devices;
            const result = await this.send(device, event).catch(() => 'retry' as const);
            if (result === 'retry') {
              retry = true;
              continue;
            }
            if (result === 'gone') {
              device.expires = 0;
              break;
            }
            device.delivered[tag] = event.at;
            // Persist after each accepted delivery. Retried sends use the same notification tag.
            await this.ctx.storage.put('state', state);
          }
          if (event.cron) event.at = nextOccurrence(event.cron, device.timezone, now);
        }
      }
      await this.save(state);
      if (retry) await this.ctx.storage.setAlarm(Date.now() + 30_000);
    });
  }
  private async send(device: Device, event: Event): Promise<'sent' | 'gone' | 'retry'> {
    const payload = await buildPushPayload(
      {
        data: JSON.stringify({
          title: event.title,
          body: event.body,
          tag: `${event.key}:${event.at}`,
        }),
        options: { ttl: 300 },
      },
      device.subscription,
      {
        subject: this.env.VAPID_SUBJECT,
        publicKey: this.env.VAPID_PUBLIC_KEY,
        privateKey: this.env.VAPID_PRIVATE_KEY,
      },
    );
    const response = await fetch(device.subscription.endpoint, {
      ...payload,
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
    });
    await response.body?.cancel();
    if (response.ok) return 'sent';
    if (response.status === 404 || response.status === 410) return 'gone';
    return 'retry';
  }
}
