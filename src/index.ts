#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import { loadConfig } from './config.js';
import { CacheManager } from './cache/index.js';
import { getTools, handleToolCall } from './tools/index.js';

const quiet = process.env.QUIET === '1' || process.env.QUIET === 'true';
const log = (msg: string) => { if (!quiet) console.error(msg); };

function createServer(cache: CacheManager): Server {
  const server = new Server(
    { name: 'osrs-cache', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getTools() };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await handleToolCall(cache, name, args ?? {});
    return result as { content: Array<{ type: string; text: string }>; isError?: boolean };
  });

  return server;
}

async function main() {
  const config = await loadConfig();
  log(`[osrs-cache] Cache path: ${config.cachePath}`);

  const cache = new CacheManager(config.cachePath);

  if (config.indexOnStartup) {
    const startTime = Date.now();
    await cache.buildIndexes(quiet);
    log(`[osrs-cache] Indexes built in ${Date.now() - startTime}ms`);
  }

  const mode = process.env.MCP_TRANSPORT ?? 'stdio';

  if (mode === 'sse') {
    const port = parseInt(process.env.PORT ?? '3000', 10);
    const transports: Record<string, SSEServerTransport> = {};

    const httpServer = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === '/sse' && req.method === 'GET') {
        const transport = new SSEServerTransport('/message', res);
        transports[transport.sessionId] = transport;
        res.on('close', () => { delete transports[transport.sessionId]; });
        const server = createServer(cache);
        await server.connect(transport);
        return;
      }

      if (req.url?.startsWith('/message') && req.method === 'POST') {
        const url = new URL(req.url, `http://localhost:${port}`);
        const sessionId = url.searchParams.get('sessionId') ?? '';
        const transport = transports[sessionId];
        if (!transport) {
          res.writeHead(404);
          res.end('Session not found');
          return;
        }
        await transport.handlePostMessage(req, res);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    httpServer.listen(port, () => {
      log(`[osrs-cache] MCP SSE server listening on port ${port}`);
      log(`[osrs-cache] SSE endpoint: http://localhost:${port}/sse`);
    });
  } else {
    const server = createServer(cache);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('[osrs-cache] MCP server running (stdio)');
  }
}

main().catch((error) => {
  console.error('[osrs-cache] Fatal error:', error);
  process.exit(1);
});
