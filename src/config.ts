import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Config } from './types.js';

const quiet = process.env.QUIET === '1' || process.env.QUIET === 'true';
const log = (msg: string) => { if (!quiet) console.error(msg); };

const DEFAULT_CONFIG: Config = {
  cachePath: './osrs-235-unpacked',
  indexOnStartup: true,
  maxSearchResults: 50
};

export async function loadConfig(): Promise<Config> {
  let config = { ...DEFAULT_CONFIG };

  // Check config file locations
  const locations = [
    path.join(process.cwd(), 'osrs-cache.config.json'),
    path.join(os.homedir(), '.osrs-cache', 'config.json')
  ];

  for (const loc of locations) {
    try {
      const content = await fs.readFile(loc, 'utf-8');
      const userConfig = JSON.parse(content);
      log(`[osrs-cache] Loaded config from ${loc}`);
      config = { ...config, ...userConfig };
      break;
    } catch {
      // Try next location
    }
  }

  // Environment variable overrides config file (Docker-friendly)
  if (process.env.OSRS_CACHE_PATH) {
    log('[osrs-cache] Using OSRS_CACHE_PATH environment variable');
    config.cachePath = process.env.OSRS_CACHE_PATH;
  }

  return config;
}
