import worker, { ReminderAccount } from '../src/worker';
export default worker;
// Test-only entrypoint. Wrangler deploys src/worker.ts, never this module.
export class TestReminderAccount extends ReminderAccount {
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    if (path === '/__state') {
      if (request.method === 'PUT') await this.ctx.storage.put('state', await request.json());
      return Response.json((await this.ctx.storage.get('state')) ?? null);
    }
    if (path === '/__alarm') {
      await this.alarm();
      return Response.json({ ok: true });
    }
    try {
      return await super.fetch(request);
    } catch (error) {
      return Response.json(
        { error: String(error), stack: error instanceof Error ? error.stack : '' },
        { status: 500 },
      );
    }
  }
}
