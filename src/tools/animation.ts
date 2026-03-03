import { CacheManager } from '../cache/index.js';
import {
  ToolResponse,
  SequenceAdvancedFilter,
  AnimationRoleEntry,
  RelativeAnimationResult
} from '../types.js';

/**
 * Handle find_related_animations tool
 * Find all animations related to a given animation:
 * - Other animations used by the same NPCs/objects (with proper role resolution)
 * - Animations sharing the same frame group
 */
export async function handleFindRelatedAnimations(
  cache: CacheManager,
  args: { animation_id: number }
): Promise<ToolResponse> {
  const result = cache.findRelatedAnimations(args.animation_id);

  if (!result) {
    return {
      content: [{
        type: 'text',
        text: `Animation ${args.animation_id} not found in sequence index.`
      }],
      isError: true
    };
  }

  const lines: string[] = [
    `Related Animations for ${args.animation_id}`,
    '─'.repeat(50),
    '',
    `Source: ID ${result.sourceAnimation.id} (${result.sourceAnimation.type}, ${result.sourceAnimation.frameCount} frames, ${result.sourceAnimation.totalDuration} ticks)`
  ];

  const allRelatedIds = new Set<number>();

  // Entity-based relationships - read actual NPC/object defs for proper role resolution
  if (result.byEntity.length > 0) {
    lines.push('');
    lines.push(`Used by ${result.byEntity.length} entity/entities:`);

    for (const entity of result.byEntity) {
      lines.push(`\n  ${entity.entityType.toUpperCase()} ${entity.entityId}: ${entity.entityName}`);

      if (entity.entityType === 'npc') {
        // Read the full NPC def to get proper animation roles
        const npcDef = await cache.getById('npc', entity.entityId) as Record<string, unknown> | null;
        if (npcDef) {
          const anims = cache.getNpcAnimationEntries(npcDef);
          for (const anim of anims) {
            const typeStr = anim.sequence ? ` (${anim.sequence.type}, ${anim.sequence.frameCount}f, ${anim.sequence.totalDuration}t)` : '';
            const marker = anim.animationId === args.animation_id ? ' <-- this' : '';
            lines.push(`    ${anim.role}: ${anim.animationId}${typeStr}${marker}`);
            if (anim.animationId !== args.animation_id) {
              allRelatedIds.add(anim.animationId);
            }
          }
          if (anims.length === 0) {
            lines.push('    (no animations defined)');
          }
        }
      } else if (entity.entityType === 'object') {
        // Objects only have one animation field
        const objDef = await cache.getById('object', entity.entityId) as Record<string, unknown> | null;
        if (objDef) {
          const animId = objDef.animationID as number | undefined;
          if (animId && animId > 0) {
            const seq = cache.getSequenceEntry(animId);
            const typeStr = seq ? ` (${seq.type}, ${seq.frameCount}f, ${seq.totalDuration}t)` : '';
            const marker = animId === args.animation_id ? ' <-- this' : '';
            lines.push(`    object: ${animId}${typeStr}${marker}`);
            if (animId !== args.animation_id) {
              allRelatedIds.add(animId);
            }
          }
        }
      }
    }
  } else {
    lines.push('');
    lines.push('No NPCs or objects use this animation directly.');
  }

  // Frame group / skeleton relationships
  if (result.bySkeleton.length > 0) {
    lines.push('');
    lines.push(`Same frame group (${result.bySkeleton.length} animations):`);
    for (const seq of result.bySkeleton.slice(0, 50)) {
      lines.push(`  ${seq.id} (${seq.type}, ${seq.frameCount} frames, ${seq.totalDuration} ticks)`);
      allRelatedIds.add(seq.id);
    }
    if (result.bySkeleton.length > 50) {
      lines.push(`  ... and ${result.bySkeleton.length - 50} more`);
    }
  }

  // Summary
  const sortedIds = [...allRelatedIds].sort((a, b) => a - b);
  lines.push('');
  lines.push(`Total related animation IDs: ${sortedIds.length}`);
  if (sortedIds.length > 0 && sortedIds.length <= 30) {
    lines.push(`IDs: ${sortedIds.join(', ')}`);
  }

  return {
    content: [{
      type: 'text',
      text: lines.join('\n')
    }]
  };
}

/**
 * Handle search_sequences_advanced tool
 * Search animations by type, duration, priority, entity usage, etc.
 */
export function handleSearchSequencesAdvanced(
  cache: CacheManager,
  args: {
    type?: 'skeletal' | 'frame';
    minDuration?: number;
    maxDuration?: number;
    minFrameCount?: number;
    maxFrameCount?: number;
    hasSounds?: boolean;
    leftHandItem?: number;
    rightHandItem?: number;
    minPriority?: number;
    maxPriority?: number;
    frameGroup?: number;
    animMayaID?: number;
    usedByNpc?: string;
    usedByObject?: string;
    offset?: number;
    limit?: number;
  }
): ToolResponse {
  const filter: SequenceAdvancedFilter = {
    type: args.type,
    minDuration: args.minDuration,
    maxDuration: args.maxDuration,
    minFrameCount: args.minFrameCount,
    maxFrameCount: args.maxFrameCount,
    hasSounds: args.hasSounds,
    leftHandItem: args.leftHandItem,
    rightHandItem: args.rightHandItem,
    minPriority: args.minPriority,
    maxPriority: args.maxPriority,
    frameGroup: args.frameGroup,
    animMayaID: args.animMayaID,
    usedByNpc: args.usedByNpc,
    usedByObject: args.usedByObject
  };

  const result = cache.searchSequencesAdvanced(filter, {
    offset: args.offset ?? 0,
    limit: args.limit ?? 25
  });

  if (result.results.length === 0) {
    return {
      content: [{ type: 'text', text: 'No animations found matching the specified filters.' }]
    };
  }

  const lines = [
    `Found ${result.totalCount} animation(s) matching filters (showing ${result.offset + 1}-${result.offset + result.results.length}):`,
    ''
  ];

  for (const seq of result.results) {
    const parts = [`${seq.id}: ${seq.type}`];
    parts.push(`${seq.frameCount}f`);
    parts.push(`${seq.totalDuration}t`);
    parts.push(`p${seq.forcedPriority}`);
    if (seq.hasSounds) parts.push('SFX');
    if (seq.leftHandItem >= 0) parts.push(`LH:${seq.leftHandItem}`);
    if (seq.rightHandItem >= 0) parts.push(`RH:${seq.rightHandItem}`);
    if (seq.animMayaID) parts.push(`maya:${seq.animMayaID}`);
    if (seq.frameGroup != null && seq.frameGroup >= 0) parts.push(`grp:${seq.frameGroup}`);

    let entityStr = '';
    if (seq.usedBy && seq.usedBy.length > 0) {
      const entityNames = seq.usedBy.slice(0, 3).map(e => `${e.name}(${e.entityType})`);
      entityStr = ` [${entityNames.join(', ')}${seq.usedBy.length > 3 ? '...' : ''}]`;
    }

    lines.push(`  ${parts.join(', ')}${entityStr}`);
  }

  if (result.totalCount > result.offset + result.results.length) {
    lines.push('');
    lines.push(`Use offset=${result.offset + result.limit} to see more results.`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Handle get_npc_animations tool
 * Get comprehensive animation information for an NPC
 */
export async function handleGetNpcAnimations(
  cache: CacheManager,
  args: { npc_id: number }
): Promise<ToolResponse> {
  const npc = await cache.getById('npc', args.npc_id) as Record<string, unknown> | null;

  if (!npc) {
    return {
      content: [{
        type: 'text',
        text: `NPC ${args.npc_id} not found.`
      }],
      isError: true
    };
  }

  const lines: string[] = [
    `NPC Animations: ${npc.name as string}`,
    '─'.repeat(50),
    '',
    `ID: ${npc.id}`,
    `Combat Level: ${(npc.combatLevel as number) || 'None'}`,
    `Size: ${(npc.size as number) || 1}`,
    ''
  ];

  // Get all animations from definition
  const animations = cache.getNpcAnimationEntries(npc);

  if (animations.length === 0) {
    lines.push('No animations defined.');
  } else {
    lines.push('Defined Animations:');
    for (const anim of animations) {
      const seqStr = anim.sequence
        ? ` (${anim.sequence.type}, ${anim.sequence.frameCount}f, ${anim.sequence.totalDuration}t, p${anim.sequence.forcedPriority}${anim.sequence.hasSounds ? ', SFX' : ''})`
        : '';
      lines.push(`  ${anim.role}: ${anim.animationId}${seqStr}`);
    }
  }

  // Check for transform/morph variants
  const varbitId = npc.varbitId as number | undefined;
  const varpIndex = npc.varpIndex as number | undefined;
  const transforms = npc.transforms as number[] | undefined;

  if (transforms && transforms.length > 0) {
    const validTransforms = transforms.filter((id: number) => id > 0 && id !== (npc.id as number));
    if (validTransforms.length > 0) {
      lines.push('');
      lines.push(`Transform Variants (${validTransforms.length}, varbit: ${varbitId ?? -1}, varp: ${varpIndex ?? -1}):`);

      // Load a few transform NPCs to show their animations
      const toShow = validTransforms.slice(0, 5);
      for (const childId of toShow) {
        const childNpc = await cache.getById('npc', childId) as Record<string, unknown> | null;
        if (childNpc) {
          const childAnims = cache.getNpcAnimationEntries(childNpc);
          lines.push(`\n  NPC ${childId}: ${childNpc.name as string}`);
          if (childAnims.length === 0) {
            lines.push('    (no animations)');
          } else {
            for (const anim of childAnims) {
              const seqStr = anim.sequence
                ? ` (${anim.sequence.type}, ${anim.sequence.frameCount}f, ${anim.sequence.totalDuration}t)`
                : '';
              lines.push(`    ${anim.role}: ${anim.animationId}${seqStr}`);
            }
          }
        }
      }
      if (validTransforms.length > 5) {
        lines.push(`\n  ... and ${validTransforms.length - 5} more transforms`);
      }
    }
  }

  // Summary: all unique animation IDs
  const allAnimIds = new Set<number>();
  for (const anim of animations) {
    allAnimIds.add(anim.animationId);
  }
  if (allAnimIds.size > 0) {
    lines.push('');
    lines.push(`All animation IDs: ${[...allAnimIds].sort((a, b) => a - b).join(', ')}`);
  }

  return {
    content: [{
      type: 'text',
      text: lines.join('\n')
    }]
  };
}

/**
 * Handle find_relative_animations tool (enhanced version)
 * Accepts animation_id and/or npc_id, scans neighboring IDs,
 * groups by frameGroup, includes spot animations
 */
export async function handleFindRelativeAnimationsEnhanced(
  cache: CacheManager,
  args: { animation_id?: number; npc_id?: number; range?: number }
): Promise<ToolResponse> {
  if (args.animation_id == null && args.npc_id == null) {
    return {
      content: [{ type: 'text', text: 'At least one of animation_id or npc_id is required.' }],
      isError: true
    };
  }

  const result = await cache.findRelativeAnimationsEnhanced(args);

  if (!result) {
    return {
      content: [{ type: 'text', text: 'No animations found. Check the provided animation_id or npc_id.' }],
      isError: true
    };
  }

  const lines: string[] = [
    'Relative Animations',
    '─'.repeat(50),
    ''
  ];

  // NPC context
  if (result.npc) {
    lines.push(`NPC: ${result.npc.name} (ID: ${result.npc.id}, Combat: ${result.npc.combatLevel})`);
    lines.push('');
  }

  lines.push(`Seed animation IDs: ${result.seedAnimations.join(', ')}`);
  lines.push(`Range scanned: ±${args.range ?? 50}`);
  lines.push('');

  // Clusters
  let totalAnims = 0;
  let totalSpotAnims = 0;

  if (result.clusters.length === 0) {
    lines.push('No animation clusters found (no shared frame groups in range).');
  } else {
    for (const cluster of result.clusters) {
      lines.push(`Frame Group ${cluster.frameGroup} (${cluster.animations.length} animations):`);
      for (const anim of cluster.animations) {
        const marker = anim.isSource ? ' ★' : '';
        const spotStr = anim.spotAnims.length > 0 ? ` [spotanims: ${anim.spotAnims.join(', ')}]` : '';
        const roleStrs = anim.roles.length > 0
          ? ` (${anim.roles.map(r => `${r.entityName}`).slice(0, 3).join(', ')}${anim.roles.length > 3 ? '...' : ''})`
          : '';
        lines.push(`  ${anim.id}: ${anim.type}, ${anim.frameCount}f, ${anim.duration}t${roleStrs}${spotStr}${marker}`);
        totalAnims++;
        totalSpotAnims += anim.spotAnims.length;
      }
      lines.push('');
    }
  }

  // Summary
  lines.push('─'.repeat(50));
  lines.push(`Summary: ${result.clusters.length} cluster(s), ${totalAnims} animation(s), ${totalSpotAnims} linked spot anim(s)`);

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Handle get_spotanim tool — fetch a spot animation definition by ID
 */
export async function handleGetSpotAnim(
  cache: CacheManager,
  args: { id: number }
): Promise<ToolResponse> {
  const spotAnim = await cache.getSpotAnim(args.id);

  if (!spotAnim) {
    return {
      content: [{ type: 'text', text: `Spot animation ${args.id} not found.` }],
      isError: true
    };
  }

  const lines: string[] = [
    `Spot Animation ${args.id}`,
    '─'.repeat(40)
  ];

  const fieldLabels: Record<string, string> = {
    animationId: 'Animation ID',
    modelId:     'Model ID',
    resizeX:     'Resize X',
    resizeY:     'Resize Y',
    rotaton:     'Rotation',
    ambient:     'Ambient',
    contrast:    'Contrast'
  };

  for (const [key, label] of Object.entries(fieldLabels)) {
    if (spotAnim[key] != null) {
      lines.push(`${label}: ${spotAnim[key]}`);
    }
  }

  // Recolor pairs
  const toFind = spotAnim.recolorToFind as number[] | undefined;
  const toReplace = spotAnim.recolorToReplace as number[] | undefined;
  if (toFind?.length) {
    lines.push('');
    lines.push('Recolors:');
    for (let i = 0; i < toFind.length; i++) {
      lines.push(`  ${toFind[i]} → ${toReplace?.[i] ?? '?'}`);
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}
