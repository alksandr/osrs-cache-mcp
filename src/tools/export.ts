import { CacheManager } from '../cache/index.js';
import { ToolResponse, EQUIPMENT_SLOTS, ItemStatsExport, NpcCombatExport, ModelRefExport } from '../types.js';

/**
 * Convert array of objects to CSV string
 */
function toCSV<T>(data: T[], columns: (keyof T)[]): string {
  const header = columns.map(c => String(c)).join(',');
  const rows = data.map(item =>
    columns.map(col => {
      const val = item[col];
      if (Array.isArray(val)) {
        // Quote arrays and escape internal quotes
        return `"${val.join(';').replace(/"/g, '""')}"`;
      }
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val ?? '');
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Handle export_item_stats tool
 * Export all item combat stats. Returns summary without filters, actual data with filters.
 */
export async function handleExportItemStats(
  cache: CacheManager,
  args: {
    format?: 'json' | 'csv';
    equip_slot?: number;
    combat_only?: boolean;
  }
): Promise<ToolResponse> {
  const allItems = cache.getItemStatsExport();

  if (allItems.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No item data available. Index may not be ready.'
      }],
      isError: true
    };
  }

  const hasFilters = args.equip_slot !== undefined || args.combat_only !== undefined;

  // Summary mode (no filters)
  if (!hasFilters) {
    // Count items with any combat stat > 0
    const combatItems = allItems.filter(item =>
      item.attackStab > 0 || item.attackSlash > 0 || item.attackCrush > 0 ||
      item.attackMagic > 0 || item.attackRanged > 0 ||
      item.defenceStab > 0 || item.defenceSlash > 0 || item.defenceCrush > 0 ||
      item.defenceMagic > 0 || item.defenceRanged > 0 ||
      item.meleeStrength > 0 || item.rangedStrength > 0 ||
      item.magicDamage > 0 || item.prayer > 0
    );

    // Count by equipment slot
    const bySlot: Record<string, number> = {};
    for (const item of allItems) {
      if (item.equipSlot >= 0) {
        const slotName = EQUIPMENT_SLOTS[item.equipSlot] || `slot_${item.equipSlot}`;
        bySlot[slotName] = (bySlot[slotName] || 0) + 1;
      }
    }

    const equipItems = allItems.filter(item => item.equipSlot >= 0);

    const lines: string[] = [
      'Item Stats Summary',
      '──────────────────',
      `Total items: ${allItems.length.toLocaleString()}`,
      `Equipment items: ${equipItems.length.toLocaleString()}`,
      `Combat items (any stat > 0): ${combatItems.length.toLocaleString()}`,
      '',
      'By slot:'
    ];

    // Sort slots by count
    const sortedSlots = Object.entries(bySlot).sort((a, b) => b[1] - a[1]);
    for (const [slot, count] of sortedSlots) {
      lines.push(`  ${slot}: ${count.toLocaleString()}`);
    }

    lines.push('');
    lines.push('Use filters to export actual data:');
    lines.push('  equip_slot: Filter by equipment slot number (0=head, 3=weapon, 4=body, etc.)');
    lines.push('  combat_only: true to get only items with combat stats');
    lines.push('  format: \'json\' or \'csv\'');
    lines.push('');
    lines.push('Slot numbers: 0=head, 1=cape, 2=neck, 3=weapon, 4=body, 5=shield, 7=legs, 9=hands, 10=feet, 12=ring, 13=ammo');

    return {
      content: [{
        type: 'text',
        text: lines.join('\n')
      }]
    };
  }

  // Export mode (with filters)
  let filtered = allItems;

  if (args.equip_slot !== undefined) {
    filtered = filtered.filter(item => item.equipSlot === args.equip_slot);
  }

  if (args.combat_only) {
    filtered = filtered.filter(item =>
      item.attackStab > 0 || item.attackSlash > 0 || item.attackCrush > 0 ||
      item.attackMagic > 0 || item.attackRanged > 0 ||
      item.defenceStab > 0 || item.defenceSlash > 0 || item.defenceCrush > 0 ||
      item.defenceMagic > 0 || item.defenceRanged > 0 ||
      item.meleeStrength > 0 || item.rangedStrength > 0 ||
      item.magicDamage > 0 || item.prayer > 0
    );
  }

  if (filtered.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No items match the specified filters.'
      }]
    };
  }

  const format = args.format || 'json';
  const filters: Record<string, unknown> = {};
  if (args.equip_slot !== undefined) filters.equip_slot = args.equip_slot;
  if (args.combat_only !== undefined) filters.combat_only = args.combat_only;

  if (format === 'csv') {
    const columns: (keyof ItemStatsExport)[] = [
      'id', 'name', 'equipSlot', 'tradeable', 'members', 'cost', 'weight', 'stackable',
      'attackStab', 'attackSlash', 'attackCrush', 'attackMagic', 'attackRanged',
      'defenceStab', 'defenceSlash', 'defenceCrush', 'defenceMagic', 'defenceRanged',
      'meleeStrength', 'rangedStrength', 'magicDamage', 'prayer'
    ];
    const csv = toCSV(filtered, columns);

    return {
      content: [{
        type: 'text',
        text: csv
      }]
    };
  }

  // JSON format
  const result = {
    exportType: 'item_stats',
    totalCount: filtered.length,
    filters,
    data: filtered
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}

/**
 * Handle export_npc_combat tool
 * Export all NPC combat data. Returns summary without filters, actual data with filters.
 */
export async function handleExportNpcCombat(
  cache: CacheManager,
  args: {
    format?: 'json' | 'csv';
    min_combat?: number;
    max_combat?: number;
    attackable_only?: boolean;
  }
): Promise<ToolResponse> {
  const allNpcs = await cache.getNpcCombatExport();

  if (allNpcs.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No NPC data available. Index may not be ready.'
      }],
      isError: true
    };
  }

  const hasFilters = args.min_combat !== undefined || args.max_combat !== undefined || args.attackable_only !== undefined;

  // Summary mode (no filters)
  if (!hasFilters) {
    // Count NPCs with combat level > 0
    const combatNpcs = allNpcs.filter(npc => npc.combatLevel > 0);
    const attackableNpcs = allNpcs.filter(npc => npc.attackable);

    // Group by combat level ranges
    const ranges: Record<string, number> = {
      '1-50': 0,
      '51-100': 0,
      '101-200': 0,
      '201-300': 0,
      '301-400': 0,
      '400+': 0
    };

    for (const npc of combatNpcs) {
      if (npc.combatLevel <= 50) ranges['1-50']++;
      else if (npc.combatLevel <= 100) ranges['51-100']++;
      else if (npc.combatLevel <= 200) ranges['101-200']++;
      else if (npc.combatLevel <= 300) ranges['201-300']++;
      else if (npc.combatLevel <= 400) ranges['301-400']++;
      else ranges['400+']++;
    }

    const lines: string[] = [
      'NPC Combat Summary',
      '──────────────────',
      `Total NPCs: ${allNpcs.length.toLocaleString()}`,
      `NPCs with combat level: ${combatNpcs.length.toLocaleString()}`,
      `Attackable NPCs: ${attackableNpcs.length.toLocaleString()}`,
      '',
      'By combat level:'
    ];

    for (const [range, count] of Object.entries(ranges)) {
      if (count > 0) {
        lines.push(`  ${range}: ${count.toLocaleString()}`);
      }
    }

    lines.push('');
    lines.push('Use filters to export actual data:');
    lines.push('  min_combat: Minimum combat level');
    lines.push('  max_combat: Maximum combat level');
    lines.push('  attackable_only: true to get only attackable NPCs');
    lines.push('  format: \'json\' or \'csv\'');

    return {
      content: [{
        type: 'text',
        text: lines.join('\n')
      }]
    };
  }

  // Export mode (with filters)
  let filtered = allNpcs;

  if (args.min_combat !== undefined) {
    filtered = filtered.filter(npc => npc.combatLevel >= args.min_combat!);
  }

  if (args.max_combat !== undefined) {
    filtered = filtered.filter(npc => npc.combatLevel <= args.max_combat!);
  }

  if (args.attackable_only) {
    filtered = filtered.filter(npc => npc.attackable);
  }

  if (filtered.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No NPCs match the specified filters.'
      }]
    };
  }

  const format = args.format || 'json';
  const filters: Record<string, unknown> = {};
  if (args.min_combat !== undefined) filters.min_combat = args.min_combat;
  if (args.max_combat !== undefined) filters.max_combat = args.max_combat;
  if (args.attackable_only !== undefined) filters.attackable_only = args.attackable_only;

  if (format === 'csv') {
    const columns: (keyof NpcCombatExport)[] = [
      'id', 'name', 'combatLevel', 'attack', 'defence', 'strength',
      'hitpoints', 'ranged', 'magic', 'size', 'attackable', 'actions'
    ];
    const csv = toCSV(filtered, columns);

    return {
      content: [{
        type: 'text',
        text: csv
      }]
    };
  }

  // JSON format
  const result = {
    exportType: 'npc_combat',
    totalCount: filtered.length,
    filters,
    data: filtered
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}

/**
 * Handle export_model_refs tool
 * Export all model references. Returns summary without filters, actual data with filters.
 */
export async function handleExportModelRefs(
  cache: CacheManager,
  args: {
    format?: 'json' | 'csv';
    entity_type?: 'item' | 'npc' | 'object';
    min_usage?: number;
  }
): Promise<ToolResponse> {
  const allRefs = cache.getModelRefsExport();

  if (allRefs.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No model reference data available. Index may not be ready.'
      }],
      isError: true
    };
  }

  const hasFilters = args.entity_type !== undefined || args.min_usage !== undefined;

  // Summary mode (no filters)
  if (!hasFilters) {
    // Calculate statistics
    let totalUsage = 0;
    let modelsWithItems = 0;
    let modelsWithNpcs = 0;
    let modelsWithObjects = 0;
    let sharedModels = 0; // Models used by more than one entity

    for (const ref of allRefs) {
      totalUsage += ref.usageCount;
      if (ref.items.length > 0) modelsWithItems++;
      if (ref.npcs.length > 0) modelsWithNpcs++;
      if (ref.objects.length > 0) modelsWithObjects++;
      if (ref.usageCount > 1) sharedModels++;
    }

    // Find most shared models
    const topShared = [...allRefs]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    const lines: string[] = [
      'Model References Summary',
      '────────────────────────',
      `Total models: ${allRefs.length.toLocaleString()}`,
      `Total references: ${totalUsage.toLocaleString()}`,
      `Shared models (>1 use): ${sharedModels.toLocaleString()}`,
      '',
      'Models by entity type:',
      `  With items: ${modelsWithItems.toLocaleString()}`,
      `  With NPCs: ${modelsWithNpcs.toLocaleString()}`,
      `  With objects: ${modelsWithObjects.toLocaleString()}`,
      '',
      'Top 5 most shared models:'
    ];

    for (const ref of topShared) {
      const types: string[] = [];
      if (ref.items.length > 0) types.push(`${ref.items.length} items`);
      if (ref.npcs.length > 0) types.push(`${ref.npcs.length} npcs`);
      if (ref.objects.length > 0) types.push(`${ref.objects.length} objects`);
      lines.push(`  Model ${ref.modelId}: ${ref.usageCount} uses (${types.join(', ')})`);
    }

    lines.push('');
    lines.push('Use filters to export actual data:');
    lines.push('  entity_type: \'item\', \'npc\', or \'object\' to filter by entity type');
    lines.push('  min_usage: Minimum number of entity references');
    lines.push('  format: \'json\' or \'csv\'');

    return {
      content: [{
        type: 'text',
        text: lines.join('\n')
      }]
    };
  }

  // Export mode (with filters)
  let filtered = allRefs;

  if (args.entity_type !== undefined) {
    filtered = filtered.filter(ref => {
      switch (args.entity_type) {
        case 'item':
          return ref.items.length > 0;
        case 'npc':
          return ref.npcs.length > 0;
        case 'object':
          return ref.objects.length > 0;
        default:
          return true;
      }
    });
  }

  if (args.min_usage !== undefined) {
    filtered = filtered.filter(ref => ref.usageCount >= args.min_usage!);
  }

  if (filtered.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No model references match the specified filters.'
      }]
    };
  }

  const format = args.format || 'json';
  const filters: Record<string, unknown> = {};
  if (args.entity_type !== undefined) filters.entity_type = args.entity_type;
  if (args.min_usage !== undefined) filters.min_usage = args.min_usage;

  if (format === 'csv') {
    // Flatten the nested structure for CSV
    interface FlatModelRef {
      modelId: number;
      usageCount: number;
      itemCount: number;
      npcCount: number;
      objectCount: number;
      itemIds: string;
      npcIds: string;
      objectIds: string;
    }

    const flatData: FlatModelRef[] = filtered.map(ref => ({
      modelId: ref.modelId,
      usageCount: ref.usageCount,
      itemCount: ref.items.length,
      npcCount: ref.npcs.length,
      objectCount: ref.objects.length,
      itemIds: ref.items.map(i => i.id).join(';'),
      npcIds: ref.npcs.map(n => n.id).join(';'),
      objectIds: ref.objects.map(o => o.id).join(';')
    }));

    const columns: (keyof FlatModelRef)[] = [
      'modelId', 'usageCount', 'itemCount', 'npcCount', 'objectCount',
      'itemIds', 'npcIds', 'objectIds'
    ];
    const csv = toCSV(flatData, columns);

    return {
      content: [{
        type: 'text',
        text: csv
      }]
    };
  }

  // JSON format
  const result = {
    exportType: 'model_refs',
    totalCount: filtered.length,
    filters,
    data: filtered
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}
