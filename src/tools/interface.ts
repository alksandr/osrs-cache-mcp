import { CacheManager } from '../cache/index.js';
import {
  ToolResponse,
  InterfaceSearchResult,
  InterfaceTreeNode,
  INTERFACE_TYPES,
  InterfaceScriptRef,
  InterfaceVarbitRef
} from '../types.js';

/**
 * Handle list_interfaces - List all parent interface IDs
 */
export async function handleListInterfaces(
  cache: CacheManager
): Promise<ToolResponse> {
  const parents = await cache.listInterfaceParents();

  if (parents.length === 0) {
    return {
      content: [{ type: 'text', text: 'No interfaces found in cache.' }]
    };
  }

  const totalChildren = parents.reduce((sum, p) => sum + p.childCount, 0);
  const minId = parents[0].parentId;
  const maxId = parents[parents.length - 1].parentId;

  const lines = [
    `Found ${parents.length} parent interfaces (IDs ${minId}-${maxId}) with ${totalChildren} total widgets.`,
    '',
    'Top 25 interfaces by child count:'
  ];

  // Sort by child count and show top 25
  const sorted = [...parents].sort((a, b) => b.childCount - a.childCount);
  for (const parent of sorted.slice(0, 25)) {
    lines.push(`  Interface ${parent.parentId}: ${parent.childCount} widgets`);
  }

  if (parents.length > 25) {
    lines.push('');
    lines.push(`Use get_interface_tree with a parent ID to explore a specific interface.`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Handle get_interface_tree - Get full widget hierarchy for an interface
 */
export async function handleGetInterfaceTree(
  cache: CacheManager,
  args: { parent: number; include_details?: boolean }
): Promise<ToolResponse> {
  const tree = await cache.getInterfaceTree(args.parent);

  if (!tree) {
    return {
      content: [{ type: 'text', text: `Interface ${args.parent} not found or has no children.` }]
    };
  }

  const lines = [`Interface ${args.parent} - ${tree.children.length} widgets:`];
  lines.push('');

  // Group by type for summary
  const byType: Record<number, InterfaceTreeNode[]> = {};
  for (const child of tree.children) {
    if (!byType[child.type]) byType[child.type] = [];
    byType[child.type].push(child);
  }

  // Show type summary
  lines.push('Widget types:');
  for (const [typeStr, widgets] of Object.entries(byType)) {
    const type = parseInt(typeStr);
    const typeName = INTERFACE_TYPES[type] || `type_${type}`;
    lines.push(`  ${typeName} (${type}): ${widgets.length}`);
  }
  lines.push('');

  // Show widgets with text or actions
  const interesting = tree.children.filter(c => c.text || (c.actions && c.actions.length > 0));
  if (interesting.length > 0) {
    lines.push('Widgets with text or actions:');
    for (const widget of interesting.slice(0, 50)) {
      const typeName = INTERFACE_TYPES[widget.type] || `type_${widget.type}`;
      let desc = `  ${args.parent}:${widget.childId} [${typeName}]`;
      if (widget.text) {
        desc += ` "${widget.text.substring(0, 50)}${widget.text.length > 50 ? '...' : ''}"`;
      }
      if (widget.actions && widget.actions.length > 0) {
        desc += ` actions=[${widget.actions.join(', ')}]`;
      }
      lines.push(desc);
    }
    if (interesting.length > 50) {
      lines.push(`  ... and ${interesting.length - 50} more`);
    }
  }

  // Show detailed list if requested
  if (args.include_details) {
    lines.push('');
    lines.push('All widgets:');
    for (const widget of tree.children.slice(0, 100)) {
      const typeName = INTERFACE_TYPES[widget.type] || `type_${widget.type}`;
      let desc = `  ${args.parent}:${widget.childId} [${typeName}]`;
      if (widget.text) desc += ` text="${widget.text.substring(0, 30)}"`;
      if (widget.spriteId !== undefined && widget.spriteId >= 0) desc += ` sprite=${widget.spriteId}`;
      if (widget.modelId !== undefined && widget.modelId >= 0) desc += ` model=${widget.modelId}`;
      if (widget.actions && widget.actions.length > 0) desc += ` actions=[${widget.actions.join(', ')}]`;
      lines.push(desc);
    }
    if (tree.children.length > 100) {
      lines.push(`  ... and ${tree.children.length - 100} more`);
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Handle search_interfaces - Search by text content
 */
export function handleSearchInterfaces(
  cache: CacheManager,
  args: { query: string; type?: number; has_action?: boolean; limit?: number }
): ToolResponse {
  const results = cache.searchInterfaces(args.query, {
    limit: args.limit ?? 25,
    type: args.type,
    hasAction: args.has_action
  });

  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `No interfaces found with text containing "${args.query}"` }]
    };
  }

  const lines = [`Found ${results.length} interface(s) with text containing "${args.query}":`];
  lines.push('');

  for (const result of results) {
    let desc = `  ${result.parentId}:${result.childId} [${result.typeName}]`;
    desc += ` "${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}"`;
    if (result.actions.length > 0) {
      desc += ` actions=[${result.actions.join(', ')}]`;
    }
    lines.push(desc);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Handle find_interfaces_by_action - Find widgets with specific action
 */
export function handleFindInterfacesByAction(
  cache: CacheManager,
  args: { action: string; limit?: number }
): ToolResponse {
  const results = cache.findInterfacesByAction(args.action, args.limit ?? 25);

  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `No interfaces found with action containing "${args.action}"` }]
    };
  }

  const lines = [`Found ${results.length} interface(s) with action containing "${args.action}":`];
  lines.push('');

  for (const result of results) {
    let desc = `  ${result.parentId}:${result.childId} [${result.typeName}]`;
    if (result.text) {
      desc += ` "${result.text.substring(0, 30)}${result.text.length > 30 ? '...' : ''}"`;
    }
    desc += ` actions=[${result.actions.join(', ')}]`;
    lines.push(desc);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

// ============================================
// Phase 6.5: Interface Cross-Reference Handlers
// ============================================

/**
 * Handle find_interface_script_refs - Find scripts that reference an interface widget
 */
export function handleFindInterfaceScriptRefs(
  cache: CacheManager,
  args: { parent: number; child: number }
): ToolResponse {
  const refs = cache.getInterfaceScriptRefs(args.parent, args.child);

  if (refs.length === 0) {
    return {
      content: [{ type: 'text', text: `No scripts found that reference interface ${args.parent}:${args.child}` }]
    };
  }

  const fullId = args.parent * 65536 + args.child;
  const lines = [`Found ${refs.length} script reference(s) to interface ${args.parent}:${args.child} (fullId: ${fullId}):`];
  lines.push('');

  // Group by script ID
  const byScript = new Map<number, InterfaceScriptRef[]>();
  for (const ref of refs) {
    const existing = byScript.get(ref.scriptId);
    if (existing) {
      existing.push(ref);
    } else {
      byScript.set(ref.scriptId, [ref]);
    }
  }

  for (const [scriptId, scriptRefs] of byScript) {
    lines.push(`Script ${scriptId}:`);
    for (const ref of scriptRefs) {
      lines.push(`  Line ${ref.lineNumber}: ${ref.opcode} - ${ref.matchLine}`);
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Handle find_interface_varbit_refs - Find varbits referenced by an interface widget
 */
export function handleFindInterfaceVarbitRefs(
  cache: CacheManager,
  args: { parent: number; child: number }
): ToolResponse {
  const refs = cache.getInterfaceVarbitRefs(args.parent, args.child);

  if (refs.length === 0) {
    return {
      content: [{ type: 'text', text: `No varbits found in interface ${args.parent}:${args.child}` }]
    };
  }

  const fullId = args.parent * 65536 + args.child;
  const lines = [`Found ${refs.length} varbit reference(s) in interface ${args.parent}:${args.child} (fullId: ${fullId}):`];
  lines.push('');

  // Group by field name
  const byField = new Map<string, InterfaceVarbitRef[]>();
  for (const ref of refs) {
    const existing = byField.get(ref.fieldName);
    if (existing) {
      existing.push(ref);
    } else {
      byField.set(ref.fieldName, [ref]);
    }
  }

  for (const [fieldName, fieldRefs] of byField) {
    const varbitIds = [...new Set(fieldRefs.map(r => r.varbitId))].sort((a, b) => a - b);
    lines.push(`${fieldName}: [${varbitIds.join(', ')}]`);
  }

  lines.push('');
  lines.push('Use get_varbit to look up each varbit definition.');

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Handle find_varbit_interface_refs - Find interfaces that reference a varbit
 */
export function handleFindVarbitInterfaceRefs(
  cache: CacheManager,
  args: { varbit_id: number }
): ToolResponse {
  const refs = cache.getVarbitInterfaceRefs(args.varbit_id);

  if (refs.length === 0) {
    return {
      content: [{ type: 'text', text: `No interfaces found that reference varbit ${args.varbit_id}` }]
    };
  }

  const lines = [`Found ${refs.length} interface widget(s) that reference varbit ${args.varbit_id}:`];
  lines.push('');

  // Group by interface
  const byInterface = new Map<number, InterfaceVarbitRef[]>();
  for (const ref of refs) {
    const existing = byInterface.get(ref.fullId);
    if (existing) {
      existing.push(ref);
    } else {
      byInterface.set(ref.fullId, [ref]);
    }
  }

  for (const [fullId, interfaceRefs] of byInterface) {
    const first = interfaceRefs[0];
    const fields = [...new Set(interfaceRefs.map(r => r.fieldName))];
    lines.push(`  ${first.parentId}:${first.childId} - ${fields.join(', ')}`);
  }

  lines.push('');
  lines.push('Use get_interface to look up each interface widget definition.');

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}
