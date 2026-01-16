#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { CacheManager } from './cache/index.js';
import { getTools, handleToolCall } from './tools/index.js';

const quiet = process.env.QUIET === '1' || process.env.QUIET === 'true';
const log = (msg: string) => { if (!quiet) console.error(msg); };

async function main() {
  // Load configuration
  const config = await loadConfig();
  log(`[osrs-cache] Cache path: ${config.cachePath}`);

  // Initialize cache manager
  const cache = new CacheManager(config.cachePath);

  // Build indexes if enabled
  if (config.indexOnStartup) {
    const startTime = Date.now();
    await cache.buildIndexes(quiet);
    const elapsed = Date.now() - startTime;
    log(`[osrs-cache] Indexes built in ${elapsed}ms`);
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'osrs-cache',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getTools() };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await handleToolCall(cache, name, args ?? {});
    return result as { content: Array<{ type: string; text: string }>; isError?: boolean };
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('[osrs-cache] MCP server running');
}

main().catch((error) => {
  console.error('[osrs-cache] Fatal error:', error);
  process.exit(1);
});
