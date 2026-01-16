import { CacheManager } from '../cache/index.js';
import { CacheType, ToolResponse, GAMEVAL_CATEGORIES } from '../types.js';

function formatResponse(data: object | null, type: string, id: number | string): ToolResponse {
  if (!data) {
    return {
      content: [{ type: 'text', text: `${type} ${id} not found` }],
      isError: true
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  };
}

export async function handleGetItem(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('item', args.id);
  return formatResponse(data, 'Item', args.id);
}

export async function handleGetNpc(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('npc', args.id);
  return formatResponse(data, 'NPC', args.id);
}

export async function handleGetObject(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('object', args.id);
  return formatResponse(data, 'Object', args.id);
}

export async function handleGetEnum(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('enum', args.id);
  return formatResponse(data, 'Enum', args.id);
}

export async function handleGetSequence(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('sequence', args.id);
  return formatResponse(data, 'Sequence', args.id);
}

export async function handleGetInterface(
  cache: CacheManager,
  args: { parent: number; child: number }
): Promise<ToolResponse> {
  const data = await cache.getInterface(args.parent, args.child);
  return formatResponse(data, 'Interface', `${args.parent}:${args.child}`);
}

export async function handleGetStruct(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('struct', args.id);
  return formatResponse(data, 'Struct', args.id);
}

export async function handleGetParam(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('param', args.id);
  return formatResponse(data, 'Param', args.id);
}

export async function handleGetVarbit(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('varbit', args.id);
  return formatResponse(data, 'Varbit', args.id);
}

export async function handleGetVarPlayer(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('var_player', args.id);
  return formatResponse(data, 'VarPlayer', args.id);
}

export async function handleGetSprite(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const spriteData = await cache.getSpriteData(args.id);
  if (!spriteData) {
    return {
      content: [{ type: 'text', text: `Sprite ${args.id} not found` }],
      isError: true
    };
  }

  const lines = [
    `Sprite ${args.id}`,
    `Dimensions: ${spriteData.width}x${spriteData.height}`,
    `Path: ${spriteData.path}`
  ];

  if (spriteData.groupId !== undefined) {
    lines.push(`Group: ${spriteData.groupId} (frame ${spriteData.frameIndex})`);
  }

  lines.push('', 'Data URI:', spriteData.dataUri);

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export async function handleGetSpriteFrame(
  cache: CacheManager,
  args: { group_id: number; frame: number }
): Promise<ToolResponse> {
  const spriteData = await cache.getSpriteFrame(args.group_id, args.frame);
  if (!spriteData) {
    return {
      content: [{ type: 'text', text: `Sprite group ${args.group_id} frame ${args.frame} not found` }],
      isError: true
    };
  }

  const lines = [
    `Sprite Group ${args.group_id} - Frame ${args.frame}`,
    `Dimensions: ${spriteData.width}x${spriteData.height}`,
    `Path: ${spriteData.path}`,
    '',
    'Data URI:',
    spriteData.dataUri
  ];

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export async function handleGetSpriteGroup(
  cache: CacheManager,
  args: { group_id: number }
): Promise<ToolResponse> {
  const frames = await cache.getSpriteGroup(args.group_id);
  if (frames.length === 0) {
    return {
      content: [{ type: 'text', text: `Sprite group ${args.group_id} not found or is empty` }],
      isError: true
    };
  }

  const lines = [
    `Sprite Group ${args.group_id}`,
    `Total frames: ${frames.length}`,
    '',
    'Frames:'
  ];

  for (const frame of frames) {
    lines.push(`  ${frame.frameIndex}: ${frame.path}`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export async function handleSearchSprites(
  cache: CacheManager,
  args: { pattern: string; limit?: number }
): Promise<ToolResponse> {
  const results = await cache.searchSprites(args.pattern, args.limit ?? 25);

  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `No sprites found matching pattern "${args.pattern}"` }]
    };
  }

  const lines = [`Found ${results.length} sprite(s) matching "${args.pattern}":`];

  for (const result of results) {
    if (result.isGroup) {
      lines.push(`  ${result.id} (group, ${result.frameCount} frames)`);
    } else {
      lines.push(`  ${result.id}.png`);
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export async function handleListSprites(cache: CacheManager): Promise<ToolResponse> {
  const { rootSprites, groups } = await cache.listSpriteIds();

  const lines = [
    'OSRS Sprite Summary',
    '==================',
    `Root sprites: ${rootSprites.length.toLocaleString()}`,
    `Sprite groups: ${groups.length}`,
    '',
    'First 20 root sprite IDs:',
    rootSprites.slice(0, 20).join(', '),
    '',
    'Sprite groups:',
    groups.join(', ')
  ];

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export async function handleGetDbrow(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('dbrow', args.id);
  return formatResponse(data, 'DBRow', args.id);
}

export async function handleGetDbtable(cache: CacheManager, args: { id: number }): Promise<ToolResponse> {
  const data = await cache.getById('dbtable', args.id);
  return formatResponse(data, 'DBTable', args.id);
}

export async function handleGetMultiple(
  cache: CacheManager,
  args: { type: CacheType; ids: number[] }
): Promise<ToolResponse> {
  const results = await cache.getMultiple(args.type, args.ids);

  if (results.size === 0) {
    return {
      content: [{ type: 'text', text: `No ${args.type}s found for the provided IDs` }],
      isError: true
    };
  }

  const output: Record<number, object> = {};
  results.forEach((value, key) => {
    output[key] = value;
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(output, null, 2) }]
  };
}

export async function handleGetScript(
  cache: CacheManager,
  args: { id: number }
): Promise<ToolResponse> {
  const [script, hash] = await Promise.all([
    cache.getScript(args.id),
    cache.getScriptHash(args.id)
  ]);

  if (!script) {
    return {
      content: [{ type: 'text', text: `Script ${args.id} not found` }],
      isError: true
    };
  }

  const output = [
    `Script ${args.id}`,
    `Hash: ${hash || 'N/A'}`,
    '---',
    script
  ].join('\n');

  return {
    content: [{ type: 'text', text: output }]
  };
}

export async function handleListScripts(cache: CacheManager): Promise<ToolResponse> {
  const ids = await cache.listScriptIds();

  if (ids.length === 0) {
    return {
      content: [{ type: 'text', text: 'No scripts found' }],
      isError: true
    };
  }

  const lines = [
    `Found ${ids.length.toLocaleString()} scripts`,
    '',
    'ID Range:',
    `  First: ${ids[0]}`,
    `  Last: ${ids[ids.length - 1]}`,
    '',
    'First 50 IDs:',
    ids.slice(0, 50).join(', ')
  ];

  if (ids.length > 50) {
    lines.push(`... and ${ids.length - 50} more`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export async function handleGetCacheStats(cache: CacheManager): Promise<ToolResponse> {
  const stats = await cache.getStats();
  const indexStatus = cache.isReady ? 'Ready' : 'Not built';

  const lines = [
    'OSRS Cache Statistics',
    '=====================',
    `Index Status: ${indexStatus}`,
    '',
    'File counts by type:'
  ];

  for (const [type, count] of Object.entries(stats)) {
    lines.push(`  ${type}: ${count.toLocaleString()}`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

// ============================================
// Game Value Handlers
// ============================================

export async function handleGetGameVal(
  cache: CacheManager,
  args: { category: number; id: number }
): Promise<ToolResponse> {
  const data = await cache.getGameVal(args.category, args.id);
  const categoryName = GAMEVAL_CATEGORIES[args.category] || `unknown_${args.category}`;

  if (!data) {
    return {
      content: [{ type: 'text', text: `GameVal ${categoryName}/${args.id} not found` }],
      isError: true
    };
  }

  const lines = [
    `GameVal: ${categoryName}/${args.id}`,
    `Name: ${data.name}`,
    `Category ID: ${data.gameValId}`,
    ''
  ];

  const fieldKeys = Object.keys(data.files);
  if (fieldKeys.length > 0) {
    lines.push('Fields:');
    for (const [key, value] of Object.entries(data.files)) {
      lines.push(`  ${key}: ${value}`);
    }
  } else {
    lines.push('Fields: (none)');
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export async function handleListGameValCategories(cache: CacheManager): Promise<ToolResponse> {
  const categories = await cache.listGameValCategories();

  if (categories.length === 0) {
    return {
      content: [{ type: 'text', text: 'No gameval categories found' }],
      isError: true
    };
  }

  let total = 0;
  const lines = [
    'Game Value Categories',
    '====================',
    ''
  ];

  for (const cat of categories) {
    lines.push(`  ${cat.category}: ${cat.name} (${cat.count.toLocaleString()} entries)`);
    total += cat.count;
  }

  lines.push('', `Total: ${total.toLocaleString()} game values`);

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export async function handleSearchGameVals(
  cache: CacheManager,
  args: { query: string; category?: number; limit?: number }
): Promise<ToolResponse> {
  const results = cache.searchGameVals(args.query, {
    category: args.category,
    limit: args.limit ?? 25
  });

  if (results.length === 0) {
    const categoryFilter = args.category !== undefined
      ? ` in category ${GAMEVAL_CATEGORIES[args.category] || args.category}`
      : '';
    return {
      content: [{ type: 'text', text: `No game values found matching "${args.query}"${categoryFilter}` }]
    };
  }

  const lines = [`Found ${results.length} game value(s) matching "${args.query}":`];

  for (const result of results) {
    const fields = result.hasFields ? ' (has fields)' : '';
    lines.push(`  ${result.categoryName}/${result.id}: ${result.name}${fields}`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}
