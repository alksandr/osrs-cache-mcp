import { CacheManager } from '../cache/index.js';
import {
  ToolResponse,
  SearchResult,
  CrossRefEntry,
  ScriptSearchResult,
  VarbitSearchResult,
  VarbitScriptRef,
  // Phase 5: Advanced search types
  ItemAdvancedFilter,
  NpcAdvancedFilter,
  ObjectAdvancedFilter,
  EQUIPMENT_SLOTS
} from '../types.js';

function formatSearchResults(results: SearchResult[], type: string, query: string): ToolResponse {
  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `No ${type}s found matching "${query}"` }]
    };
  }

  const formatted = results.map(r => `${r.id}: ${r.name}`).join('\n');
  return {
    content: [{
      type: 'text',
      text: `Found ${results.length} ${type}(s) matching "${query}":\n${formatted}`
    }]
  };
}

function formatCrossRefResults(results: CrossRefEntry[], refType: string, id: number): ToolResponse {
  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `No entities found using ${refType} ${id}` }]
    };
  }

  const grouped: Record<string, CrossRefEntry[]> = {};
  for (const entry of results) {
    if (!grouped[entry.type]) grouped[entry.type] = [];
    grouped[entry.type].push(entry);
  }

  const lines: string[] = [`Entities using ${refType} ${id}:`];

  for (const [type, entries] of Object.entries(grouped)) {
    lines.push(`\n${type.toUpperCase()}S (${entries.length}):`);
    for (const entry of entries.slice(0, 50)) {
      lines.push(`  ${entry.id}: ${entry.name}`);
    }
    if (entries.length > 50) {
      lines.push(`  ... and ${entries.length - 50} more`);
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export function handleSearchItems(
  cache: CacheManager,
  args: { query: string; exact?: boolean; limit?: number }
): ToolResponse {
  const results = cache.searchItems(args.query, {
    exact: args.exact ?? false,
    limit: args.limit ?? 25
  });
  return formatSearchResults(results, 'item', args.query);
}

export function handleSearchNpcs(
  cache: CacheManager,
  args: { query: string; exact?: boolean; limit?: number }
): ToolResponse {
  const results = cache.searchNpcs(args.query, {
    exact: args.exact ?? false,
    limit: args.limit ?? 25
  });
  return formatSearchResults(results, 'NPC', args.query);
}

export function handleSearchObjects(
  cache: CacheManager,
  args: { query: string; exact?: boolean; limit?: number }
): ToolResponse {
  const results = cache.searchObjects(args.query, {
    exact: args.exact ?? false,
    limit: args.limit ?? 25
  });
  return formatSearchResults(results, 'object', args.query);
}

export function handleFindByModel(
  cache: CacheManager,
  args: { model_id: number }
): ToolResponse {
  const results = cache.findByModel(args.model_id);
  return formatCrossRefResults(results, 'model', args.model_id);
}

export function handleFindByAnimation(
  cache: CacheManager,
  args: { animation_id: number }
): ToolResponse {
  const results = cache.findByAnimation(args.animation_id);
  return formatCrossRefResults(results, 'animation', args.animation_id);
}

export function handleFindByInventoryModel(
  cache: CacheManager,
  args: { model_id: number }
): ToolResponse {
  const results = cache.findByInventoryModel(args.model_id);
  return formatCrossRefResults(results, 'inventory model', args.model_id);
}

function formatScriptSearchResults(results: ScriptSearchResult[], query: string): ToolResponse {
  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `No scripts found containing "${query}"` }]
    };
  }

  const lines = [`Found ${results.length} script(s) containing "${query}":`];
  for (const result of results) {
    lines.push(`  Script ${result.id} (line ${result.lineNumber}): ${result.matchLine}`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export function handleSearchScripts(
  cache: CacheManager,
  args: { query: string; limit?: number }
): ToolResponse {
  const results = cache.searchScripts(args.query, {
    limit: args.limit ?? 25
  });
  return formatScriptSearchResults(results, args.query);
}

function formatVarbitSearchResults(results: VarbitSearchResult[], query: string): ToolResponse {
  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `No varbits found matching "${query}"` }]
    };
  }

  const lines = [`Found ${results.length} varbit(s) matching "${query}":`];
  for (const result of results) {
    lines.push(`  Varbit ${result.id}: var_player[${result.index}] bits ${result.bitRange}`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export function handleSearchVarbits(
  cache: CacheManager,
  args: { query: string; limit?: number }
): ToolResponse {
  const results = cache.searchVarbits(args.query, {
    limit: args.limit ?? 25
  });
  return formatVarbitSearchResults(results, args.query);
}

export function handleFindVarbitsByIndex(
  cache: CacheManager,
  args: { index: number }
): ToolResponse {
  const results = cache.findVarbitsByIndex(args.index);

  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `No varbits found using var_player index ${args.index}` }]
    };
  }

  const lines = [
    `Found ${results.length} varbit(s) sharing var_player index ${args.index}:`,
    '',
    'Bit allocation in this var_player:'
  ];

  for (const result of results) {
    const [lsb, msb] = result.bitRange.split('-').map(Number);
    const bitCount = msb - lsb + 1;
    const maxValue = Math.pow(2, bitCount) - 1;
    lines.push(`  Varbit ${result.id}: bits ${result.bitRange} (${bitCount} bits, max value: ${maxValue})`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export function handleGetVarbitScriptRefs(
  cache: CacheManager,
  args: { varbit_id: number }
): ToolResponse {
  const refs = cache.getVarbitScriptRefs(args.varbit_id);

  if (refs.length === 0) {
    return {
      content: [{ type: 'text', text: `No script references found for varbit ${args.varbit_id}` }]
    };
  }

  const getOps = refs.filter(r => r.operation === 'get');
  const setOps = refs.filter(r => r.operation === 'set');

  const lines = [`Script references for varbit ${args.varbit_id}:`];

  if (getOps.length > 0) {
    lines.push(`\nREADS (${getOps.length}):`);
    for (const ref of getOps.slice(0, 25)) {
      lines.push(`  Script ${ref.scriptId} (line ${ref.lineNumber}): ${ref.matchLine}`);
    }
    if (getOps.length > 25) {
      lines.push(`  ... and ${getOps.length - 25} more`);
    }
  }

  if (setOps.length > 0) {
    lines.push(`\nWRITES (${setOps.length}):`);
    for (const ref of setOps.slice(0, 25)) {
      lines.push(`  Script ${ref.scriptId} (line ${ref.lineNumber}): ${ref.matchLine}`);
    }
    if (setOps.length > 25) {
      lines.push(`  ... and ${setOps.length - 25} more`);
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

// ============================================
// Phase 5: Advanced Search Handlers
// ============================================

export function handleSearchItemsAdvanced(
  cache: CacheManager,
  args: {
    name?: string;
    equipSlot?: string;
    tradeable?: boolean;
    members?: boolean;
    minValue?: number;
    maxValue?: number;
    minWeight?: number;
    maxWeight?: number;
    stackable?: boolean;
    minAttackStab?: number;
    minAttackSlash?: number;
    minAttackCrush?: number;
    minAttackMagic?: number;
    minAttackRanged?: number;
    minDefenceStab?: number;
    minDefenceSlash?: number;
    minDefenceCrush?: number;
    minDefenceMagic?: number;
    minDefenceRanged?: number;
    minMeleeStrength?: number;
    minRangedStrength?: number;
    minMagicDamage?: number;
    minPrayer?: number;
    offset?: number;
    limit?: number;
  }
): ToolResponse {
  const filter: ItemAdvancedFilter = {
    name: args.name,
    equipSlot: args.equipSlot,
    tradeable: args.tradeable,
    members: args.members,
    minValue: args.minValue,
    maxValue: args.maxValue,
    minWeight: args.minWeight,
    maxWeight: args.maxWeight,
    stackable: args.stackable,
    minAttackStab: args.minAttackStab,
    minAttackSlash: args.minAttackSlash,
    minAttackCrush: args.minAttackCrush,
    minAttackMagic: args.minAttackMagic,
    minAttackRanged: args.minAttackRanged,
    minDefenceStab: args.minDefenceStab,
    minDefenceSlash: args.minDefenceSlash,
    minDefenceCrush: args.minDefenceCrush,
    minDefenceMagic: args.minDefenceMagic,
    minDefenceRanged: args.minDefenceRanged,
    minMeleeStrength: args.minMeleeStrength,
    minRangedStrength: args.minRangedStrength,
    minMagicDamage: args.minMagicDamage,
    minPrayer: args.minPrayer
  };

  const result = cache.searchItemsAdvanced(filter, {
    offset: args.offset ?? 0,
    limit: args.limit ?? 25
  });

  if (result.results.length === 0) {
    return {
      content: [{ type: 'text', text: 'No items found matching the specified filters.' }]
    };
  }

  const lines = [
    `Found ${result.totalCount} item(s) matching filters (showing ${result.offset + 1}-${result.offset + result.results.length}):`,
    ''
  ];

  for (const item of result.results) {
    const slot = item.equipSlot ? ` [${item.equipSlot}]` : '';
    const flags = [];
    if (item.tradeable) flags.push('tradeable');
    if (item.members) flags.push('members');
    const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
    lines.push(`  ${item.id}: ${item.name}${slot}${flagStr} - ${item.cost.toLocaleString()} gp, ${(item.weight / 1000).toFixed(2)} kg`);
  }

  if (result.totalCount > result.offset + result.results.length) {
    lines.push('');
    lines.push(`Use offset=${result.offset + result.limit} to see more results.`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export function handleSearchNpcsAdvanced(
  cache: CacheManager,
  args: {
    name?: string;
    minCombatLevel?: number;
    maxCombatLevel?: number;
    hasAction?: string;
    attackable?: boolean;
    size?: number;
    interactable?: boolean;
    offset?: number;
    limit?: number;
  }
): ToolResponse {
  const filter: NpcAdvancedFilter = {
    name: args.name,
    minCombatLevel: args.minCombatLevel,
    maxCombatLevel: args.maxCombatLevel,
    hasAction: args.hasAction,
    attackable: args.attackable,
    size: args.size,
    interactable: args.interactable
  };

  const result = cache.searchNpcsAdvanced(filter, {
    offset: args.offset ?? 0,
    limit: args.limit ?? 25
  });

  if (result.results.length === 0) {
    return {
      content: [{ type: 'text', text: 'No NPCs found matching the specified filters.' }]
    };
  }

  const lines = [
    `Found ${result.totalCount} NPC(s) matching filters (showing ${result.offset + 1}-${result.offset + result.results.length}):`,
    ''
  ];

  for (const npc of result.results) {
    const lvl = npc.combatLevel > 0 ? ` (level ${npc.combatLevel})` : '';
    const actions = npc.actions.length > 0 ? ` [${npc.actions.join(', ')}]` : '';
    const sizeStr = npc.size > 1 ? ` size:${npc.size}` : '';
    lines.push(`  ${npc.id}: ${npc.name}${lvl}${sizeStr}${actions}`);
  }

  if (result.totalCount > result.offset + result.results.length) {
    lines.push('');
    lines.push(`Use offset=${result.offset + result.limit} to see more results.`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

export function handleSearchObjectsAdvanced(
  cache: CacheManager,
  args: {
    name?: string;
    hasAction?: string;
    blocksProjectile?: boolean;
    interactable?: boolean;
    minSizeX?: number;
    maxSizeX?: number;
    minSizeY?: number;
    maxSizeY?: number;
    offset?: number;
    limit?: number;
  }
): ToolResponse {
  const filter: ObjectAdvancedFilter = {
    name: args.name,
    hasAction: args.hasAction,
    blocksProjectile: args.blocksProjectile,
    interactable: args.interactable,
    minSizeX: args.minSizeX,
    maxSizeX: args.maxSizeX,
    minSizeY: args.minSizeY,
    maxSizeY: args.maxSizeY
  };

  const result = cache.searchObjectsAdvanced(filter, {
    offset: args.offset ?? 0,
    limit: args.limit ?? 25
  });

  if (result.results.length === 0) {
    return {
      content: [{ type: 'text', text: 'No objects found matching the specified filters.' }]
    };
  }

  const lines = [
    `Found ${result.totalCount} object(s) matching filters (showing ${result.offset + 1}-${result.offset + result.results.length}):`,
    ''
  ];

  for (const obj of result.results) {
    const actions = obj.actions.length > 0 ? ` [${obj.actions.join(', ')}]` : '';
    const size = obj.sizeX > 1 || obj.sizeY > 1 ? ` (${obj.sizeX}x${obj.sizeY})` : '';
    const interact = obj.interactable ? '' : ' (non-interactable)';
    lines.push(`  ${obj.id}: ${obj.name}${size}${interact}${actions}`);
  }

  if (result.totalCount > result.offset + result.results.length) {
    lines.push('');
    lines.push(`Use offset=${result.offset + result.limit} to see more results.`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}
