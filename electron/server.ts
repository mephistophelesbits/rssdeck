import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export function buildServerUrl(port = 3001): string {
  return `http://localhost:${port}`;
}

export async function waitForServer(
  url: string,
  intervalMs = 500,
  maxAttempts = 60
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Server did not start within ${(intervalMs * maxAttempts) / 1000}s`);
}

export function spawnNextServer(appRoot: string): ChildProcess {
  const isDev = process.env.ELECTRON_IS_DEV === '1';

  let command: string;
  let args: string[];
  let cwd: string;

  if (isDev) {
    command = process.execPath;
    args = [path.join(appRoot, 'node_modules/.bin/next'), 'dev', '-p', '3001'];
    cwd = appRoot;
  } else {
    // In production, use the standalone server built by next build
    command = process.execPath;
    args = [path.join(appRoot, '.next/standalone/server.js')];
    cwd = appRoot;
  }

  const serverProcess = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: isDev ? 'development' : 'production',
      PORT: '3001',
      HOSTNAME: 'localhost',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log('[next-server]', data.toString().trim());
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error('[next-server]', data.toString().trim());
  });

  serverProcess.on('error', (err) => {
    console.error('[next-server] Failed to spawn process:', err);
  });

  return serverProcess;
}
