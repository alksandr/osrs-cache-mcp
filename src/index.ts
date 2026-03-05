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
    const apiKey = process.env.API_KEY;

    // Rate limiting: track requests per IP
    const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.RATE_LIMIT ?? '60', 10);
    const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS ?? '60000', 10);
    const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

    function isRateLimited(ip: string): boolean {
      const now = Date.now();
      const entry = rateLimitMap.get(ip);
      if (!entry || now >= entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
      }
      entry.count++;
      return entry.count > MAX_REQUESTS_PER_WINDOW;
    }

    // Clean up stale rate limit entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [ip, entry] of rateLimitMap) {
        if (now >= entry.resetAt) rateLimitMap.delete(ip);
      }
    }, 300_000);

    // Max concurrent sessions
    const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS ?? '5', 10);

    // Max request body size (1 MB)
    const MAX_BODY_SIZE = parseInt(process.env.MAX_BODY_SIZE ?? '1048576', 10);

    const httpServer = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // API key check
      if (apiKey) {
        const auth = req.headers['authorization'];
        if (auth !== `Bearer ${apiKey}`) {
          res.writeHead(401);
          res.end('Unauthorized');
          return;
        }
      }

      // Rate limiting
      const ip = req.headers['cf-connecting-ip'] as string
        ?? req.headers['x-forwarded-for'] as string
        ?? req.socket.remoteAddress
        ?? 'unknown';
      if (isRateLimited(ip)) {
        res.writeHead(429);
        res.end('Too many requests');
        return;
      }

      if (req.url === '/sse' && req.method === 'GET') {
        // Max concurrent sessions check
        if (Object.keys(transports).length >= MAX_SESSIONS) {
          res.writeHead(503);
          res.end('Too many sessions');
          return;
        }
        const transport = new SSEServerTransport('/message', res);
        transports[transport.sessionId] = transport;
        res.on('close', () => { delete transports[transport.sessionId]; });
        const server = createServer(cache);
        await server.connect(transport);
        return;
      }

      if (req.url?.startsWith('/message') && req.method === 'POST') {
        // Request body size check
        const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
        if (contentLength > MAX_BODY_SIZE) {
          res.writeHead(413);
          res.end('Request too large');
          return;
        }

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

    // Enforce body size at the socket level
    httpServer.maxHeadersCount = 50;

    httpServer.listen(port, () => {
      log(`[osrs-cache] MCP SSE server listening on port ${port}`);
      log(`[osrs-cache] SSE endpoint: http://localhost:${port}/sse`);
      log(`[osrs-cache] Rate limit: ${MAX_REQUESTS_PER_WINDOW} req/${RATE_WINDOW_MS}ms, max sessions: ${MAX_SESSIONS}, max body: ${MAX_BODY_SIZE}B`);
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
