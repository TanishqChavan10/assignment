import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Load .env.local into process.env if present
if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  content.split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/engine/__tests__/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

