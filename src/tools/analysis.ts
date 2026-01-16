import { CacheManager } from '../cache/index.js';
import { ToolResponse, NpcCombatAnalysis, EQUIPMENT_SLOTS, ItemSourcesResult } from '../types.js';

/**
 * Handle find_item_variants tool
 * Find noted/placeholder/bought variants and items sharing the same inventory model
 */
export async function handleFindItemVariants(
  cache: CacheManager,
  args: { item_id: number }
): Promise<ToolResponse> {
  const result = cache.getItemVariants(args.item_id);

  if (!result) {
    return {
      content: [{
        type: 'text',
        text: `Item ${args.item_id} not found or no variant data available.`
      }],
      isError: true
    };
  }

  if (result.variants.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `Item ${args.item_id} (${result.baseItem.name}) has no known variants.`
      }]
    };
  }

  // Group variants by relationship type
  const byType: Record<string, Array<{ id: number; name: string }>> = {};
  for (const variant of result.variants) {
    if (!byType[variant.relationship]) {
      byType[variant.relationship] = [];
    }
    byType[variant.relationship].push({ id: variant.id, name: variant.name });
  }

  // Format output
  const lines: string[] = [
    `Item Variants for ${result.baseItem.name} (ID: ${result.baseItem.id})`,
    '─'.repeat(50)
  ];

  const relationshipLabels: Record<string, string> = {
    noted: 'Noted Version',
    unnoted: 'Unnoted Version',
    placeholder: 'Placeholder Version',
    bought: 'Bought/GE Version',
    same_model: 'Same Inventory Model'
  };

  for (const [relationship, items] of Object.entries(byType)) {
    lines.push(`\n${relationshipLabels[relationship] || relationship}:`);
    for (const item of items) {
      lines.push(`  • ${item.name} (ID: ${item.id})`);
    }
  }

  lines.push(`\nTotal variants: ${result.variants.length}`);

  return {
    content: [{
      type: 'text',
      text: lines.join('\n')
    }]
  };
}

/**
 * Handle find_equipment_set tool
 * Find items with matching name prefix in the same equipment category
 */
export async function handleFindEquipmentSet(
  cache: CacheManager,
  args: { item_id: number }
): Promise<ToolResponse> {
  // First, get the item to extract its prefix
  const item = await cache.getById('item', args.item_id) as {
    id: number;
    name: string;
    wearPos1?: number;
  } | null;

  if (!item) {
    return {
      content: [{
        type: 'text',
        text: `Item ${args.item_id} not found.`
      }],
      isError: true
    };
  }

  // Check if item is equippable
  if (!item.wearPos1 || item.wearPos1 < 0) {
    return {
      content: [{
        type: 'text',
        text: `Item ${args.item_id} (${item.name}) is not equippable.`
      }],
      isError: true
    };
  }

  // Extract prefix from item name
  const prefix = cache.extractItemPrefix(item.name);
  if (!prefix) {
    return {
      content: [{
        type: 'text',
        text: `Could not extract equipment set prefix from "${item.name}". Try searching manually with search_items_advanced.`
      }],
      isError: true
    };
  }

  // Find all equipment with this prefix
  const result = cache.findEquipmentByPrefix(prefix);
  if (!result || result.setItems.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No equipment set found for prefix "${prefix}".`
      }]
    };
  }

  // Group by slot
  const bySlot: Record<string, Array<{ id: number; name: string }>> = {};
  for (const setItem of result.setItems) {
    if (!bySlot[setItem.slot]) {
      bySlot[setItem.slot] = [];
    }
    bySlot[setItem.slot].push({ id: setItem.id, name: setItem.name });
  }

  // Format output
  const lines: string[] = [
    `Equipment Set: "${prefix}"`,
    `Based on: ${item.name} (ID: ${item.id})`,
    '─'.repeat(50)
  ];

  // Define slot order for display
  const slotOrder = ['head', 'cape', 'neck', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring', 'ammo'];

  for (const slot of slotOrder) {
    const items = bySlot[slot];
    if (items && items.length > 0) {
      lines.push(`\n${slot.charAt(0).toUpperCase() + slot.slice(1)}:`);
      for (const item of items) {
        lines.push(`  • ${item.name} (ID: ${item.id})`);
      }
    }
  }

  // Any remaining slots not in the predefined order
  for (const [slot, items] of Object.entries(bySlot)) {
    if (!slotOrder.includes(slot)) {
      lines.push(`\n${slot}:`);
      for (const item of items) {
        lines.push(`  • ${item.name} (ID: ${item.id})`);
      }
    }
  }

  lines.push(`\nTotal items in set: ${result.setItems.length}`);

  return {
    content: [{
      type: 'text',
      text: lines.join('\n')
    }]
  };
}

/**
 * Handle analyze_npc tool
 * Get detailed combat stats, attack info, and stat breakdown
 */
export async function handleAnalyzeNpc(
  cache: CacheManager,
  args: { npc_id: number }
): Promise<ToolResponse> {
  const npc = await cache.getById('npc', args.npc_id) as {
    id: number;
    name: string;
    combatLevel?: number;
    stats?: number[];
    actions?: (string | null)[];
    size?: number;
    standingAnimation?: number;
    walkingAnimation?: number;
    attackAnimation?: number;
    deathAnimation?: number;
    models?: number[];
    params?: Record<string, number>;
  } | null;

  if (!npc) {
    return {
      content: [{
        type: 'text',
        text: `NPC ${args.npc_id} not found.`
      }],
      isError: true
    };
  }

  // Parse combat stats
  // Stats array: [Attack, Defence, Strength, Hitpoints, Ranged, Magic]
  const stats = npc.stats || [];
  const combatStats = {
    attack: stats[0] ?? 0,
    defence: stats[1] ?? 0,
    strength: stats[2] ?? 0,
    hitpoints: stats[3] ?? 0,
    ranged: stats[4] ?? 0,
    magic: stats[5] ?? 0
  };

  // Check if attackable
  const actions: string[] = (npc.actions || []).filter((a): a is string => a !== null && a !== 'null');
  const isAttackable = actions.some(a => a.toLowerCase() === 'attack');

  // Build analysis object
  const analysis: NpcCombatAnalysis = {
    id: npc.id,
    name: npc.name,
    combatLevel: npc.combatLevel ?? 0,
    stats: combatStats,
    attackable: isAttackable,
    size: npc.size ?? 1,
    animations: {},
    actions
  };

  // Add animations if present
  if (npc.standingAnimation && npc.standingAnimation > 0) {
    analysis.animations.standing = npc.standingAnimation;
  }
  if (npc.walkingAnimation && npc.walkingAnimation > 0) {
    analysis.animations.walking = npc.walkingAnimation;
  }
  // Check for attack animation in params (param 50 often contains attack anim)
  if (npc.params && npc.params['50']) {
    analysis.animations.attack = npc.params['50'];
  }
  // Check for death animation in params (param 3 often contains death anim)
  if (npc.params && npc.params['3']) {
    analysis.animations.death = npc.params['3'];
  }

  // Format output
  const lines: string[] = [
    `NPC Analysis: ${analysis.name}`,
    '─'.repeat(50),
    '',
    `ID: ${analysis.id}`,
    `Combat Level: ${analysis.combatLevel || 'None'}`,
    `Size: ${analysis.size} tile${analysis.size > 1 ? 's' : ''}`,
    `Attackable: ${analysis.attackable ? 'Yes' : 'No'}`,
    ''
  ];

  // Add combat stats if any are non-zero
  const hasStats = Object.values(combatStats).some(v => v > 0);
  if (hasStats) {
    lines.push('Combat Stats:');
    lines.push(`  Attack:    ${combatStats.attack}`);
    lines.push(`  Strength:  ${combatStats.strength}`);
    lines.push(`  Defence:   ${combatStats.defence}`);
    lines.push(`  Hitpoints: ${combatStats.hitpoints}`);
    lines.push(`  Ranged:    ${combatStats.ranged}`);
    lines.push(`  Magic:     ${combatStats.magic}`);
    lines.push('');
  }

  // Add actions
  if (actions.length > 0) {
    lines.push('Actions:');
    for (const action of actions) {
      lines.push(`  • ${action}`);
    }
    lines.push('');
  }

  // Add animations
  const animKeys = Object.keys(analysis.animations) as (keyof typeof analysis.animations)[];
  if (animKeys.length > 0) {
    lines.push('Animations:');
    for (const key of animKeys) {
      const animId = analysis.animations[key];
      if (animId) {
        lines.push(`  ${key}: ${animId}`);
      }
    }
  }

  return {
    content: [{
      type: 'text',
      text: lines.join('\n')
    }]
  };
}

/**
 * Handle find_item_sources tool
 * Find where items come from: NPCs that drop them and shops that sell them
 */
export async function handleFindItemSources(
  cache: CacheManager,
  args: { item_id: number }
): Promise<ToolResponse> {
  const result = await cache.findItemSources(args.item_id);

  if (!result) {
    return {
      content: [{
        type: 'text',
        text: `Error: Could not find item sources. Item ID ${args.item_id} may not exist or indexes not ready.`
      }],
      isError: true
    };
  }

  const lines: string[] = [];
  const divider = '─'.repeat(50);

  lines.push(`Item Sources: ${result.item.name} (ID: ${result.item.id})`);
  lines.push(divider);
  lines.push('');

  // NPC Drops
  lines.push(`NPC Drops (${result.sources.npcDrops.length}):`);
  if (result.sources.npcDrops.length === 0) {
    lines.push('  (none)');
  } else {
    for (const drop of result.sources.npcDrops) {
      lines.push(`  • ${drop.npcName} (ID: ${drop.npcId})`);
      if (drop.description) {
        lines.push(`    ${drop.description}`);
      }
    }
  }

  lines.push('');

  // Shops
  lines.push(`Shops (${result.sources.shops.length}):`);
  if (result.sources.shops.length === 0) {
    lines.push('  (none)');
  } else {
    for (const shop of result.sources.shops) {
      const stockStr = shop.stock > 0 ? ` (stock: ${shop.stock})` : '';
      lines.push(`  • ${shop.price.toLocaleString()} ${shop.currency}${stockStr}`);
    }
  }

  lines.push('');
  lines.push(`Total sources: ${result.totalSources}`);

  return {
    content: [{
      type: 'text',
      text: lines.join('\n')
    }]
  };
}
