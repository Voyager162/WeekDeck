import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  let origin = '';
  if (env.VITE_REMINDER_URL) {
    const url = new URL(env.VITE_REMINDER_URL);
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new Error('VITE_REMINDER_URL must be an HTTPS origin without a path.');
    origin = url.origin;
  }
  return {
    plugins: [
      react(),
      {
        name: 'reminder-csp',
        transformIndexHtml(html) {
          return origin ? html.replace("connect-src 'self'", `connect-src 'self' ${origin}`) : html;
        },
      },
    ],
    base: './',
  };
});
