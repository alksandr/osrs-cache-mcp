import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CacheManager } from '../cache/index.js';
import { ToolResponse, CacheType } from '../types.js';
import {
  handleGetItem,
  handleGetNpc,
  handleGetObject,
  handleGetEnum,
  handleGetSequence,
  handleGetInterface,
  handleGetStruct,
  handleGetParam,
  handleGetVarbit,
  handleGetVarPlayer,
  handleGetSprite,
  handleGetSpriteFrame,
  handleGetSpriteGroup,
  handleSearchSprites,
  handleListSprites,
  handleGetDbrow,
  handleGetDbtable,
  handleGetMultiple,
  handleGetCacheStats,
  handleGetScript,
  handleListScripts,
  handleGetGameVal,
  handleListGameValCategories,
  handleSearchGameVals
} from './lookup.js';
import {
  handleSearchItems,
  handleSearchNpcs,
  handleSearchObjects,
  handleFindByModel,
  handleFindByAnimation,
  handleFindByInventoryModel,
  handleSearchScripts,
  handleSearchVarbits,
  handleFindVarbitsByIndex,
  handleGetVarbitScriptRefs,
  // Phase 5: Advanced search handlers
  handleSearchItemsAdvanced,
  handleSearchNpcsAdvanced,
  handleSearchObjectsAdvanced
} from './search.js';
import {
  // Phase 6: Interface handlers
  handleListInterfaces,
  handleGetInterfaceTree,
  handleSearchInterfaces,
  handleFindInterfacesByAction,
  // Phase 6.5: Interface cross-reference handlers
  handleFindInterfaceScriptRefs,
  handleFindInterfaceVarbitRefs,
  handleFindVarbitInterfaceRefs
} from './interface.js';
import {
  // Phase 7: Analysis handlers
  handleFindItemVariants,
  handleFindEquipmentSet,
  handleAnalyzeNpc,
  handleFindItemSources
} from './analysis.js';
import {
  // Phase 8: Database handlers
  handleListDbtables,
  handleGetDbtableSchema,
  handleGetTableRows,
  handleQueryDbtable,
  handleSearchDbrows
} from './database.js';
import {
  // Phase 9: Export handlers
  handleExportItemStats,
  handleExportNpcCombat,
  handleExportModelRefs
} from './export.js';
import {
  // Phase 10: Animation handlers
  handleFindRelatedAnimations,
  handleSearchSequencesAdvanced,
  handleGetNpcAnimations,
  handleFindRelativeAnimationsEnhanced
} from './animation.js';

export function getTools(): Tool[] {
  return [
    // Lookup by ID tools
    {
      name: 'get_item',
      description: 'Get OSRS item definition by ID. Returns item name, stats, models, options, and all properties.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Item ID (e.g., 4151 for Abyssal whip, 11802 for Armadyl godsword)' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_npc',
      description: 'Get OSRS NPC definition by ID. Returns NPC name, combat level, models, animations, and actions.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'NPC ID (e.g., 3127 for TzTok-Jad, 2042 for Zulrah)' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_object',
      description: 'Get OSRS object/scenery definition by ID. Returns object name, size, models, and actions.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Object ID (e.g., bank booths, doors, trees)' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_enum',
      description: 'Get OSRS enum definition by ID. Enums map keys to values (e.g., skill names, emote IDs).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Enum ID' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_sequence',
      description: 'Get OSRS animation sequence by ID. Contains frame data, timing, and sound info.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Sequence/animation ID' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_interface',
      description: 'Get OSRS interface widget definition. Interfaces use parent:child notation.',
      inputSchema: {
        type: 'object',
        properties: {
          parent: { type: 'number', description: 'Parent interface ID' },
          child: { type: 'number', description: 'Child widget ID' }
        },
        required: ['parent', 'child']
      }
    },
    {
      name: 'get_struct',
      description: 'Get OSRS struct definition by ID. Structs hold param key-value pairs.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Struct ID' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_param',
      description: 'Get OSRS param definition by ID. Params define parameter types used in items/npcs/etc.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Param ID' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_varbit',
      description: 'Get OSRS varbit definition by ID. Varbits are bit fields within player variables.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Varbit ID' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_var_player',
      description: 'Get OSRS var_player definition by ID. Var_players are containers for varbits.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'VarPlayer ID (the index used by varbits)' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_sprite',
      description: 'Get OSRS sprite by ID with base64 PNG data. Returns dimensions, path, and data URI. For sprite groups, returns the first frame.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Sprite ID (root sprite or group ID)' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_sprite_frame',
      description: 'Get a specific frame from a sprite group. Returns base64 PNG data, dimensions, and path.',
      inputSchema: {
        type: 'object',
        properties: {
          group_id: { type: 'number', description: 'Sprite group ID' },
          frame: { type: 'number', description: 'Frame index within the group (0-based)' }
        },
        required: ['group_id', 'frame']
      }
    },
    {
      name: 'get_sprite_group',
      description: 'Get all frames in a sprite group. Returns list of frame indices and paths.',
      inputSchema: {
        type: 'object',
        properties: {
          group_id: { type: 'number', description: 'Sprite group ID' }
        },
        required: ['group_id']
      }
    },
    {
      name: 'search_sprites',
      description: 'Search sprites by ID pattern. Supports wildcards (* for any chars, ? for single char).',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern (e.g., "10*" for IDs starting with 10, "*99" for ending with 99)' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['pattern']
      }
    },
    {
      name: 'list_sprites',
      description: 'List all sprite IDs and groups. Returns summary of root sprites and sprite groups.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_dbrow',
      description: 'Get OSRS database row by ID. Contains structured game data like quest info.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'DBRow ID' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_dbtable',
      description: 'Get OSRS database table schema by ID. Defines column types for dbrows.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'DBTable ID' }
        },
        required: ['id']
      }
    },
    {
      name: 'get_script',
      description: 'Get RS2ASM script by ID. Returns disassembled script code with opcodes, labels, and hash.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Script ID' }
        },
        required: ['id']
      }
    },
    {
      name: 'list_scripts',
      description: 'List all available RS2ASM script IDs. Returns script count and ID range.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },

    // Search tools
    {
      name: 'search_items',
      description: 'Search OSRS items by name. Supports partial matching. Returns matching item IDs and names.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (partial name, e.g., "dragon" or "whip")' },
          exact: { type: 'boolean', description: 'Exact match only (default: false)' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['query']
      }
    },
    {
      name: 'search_npcs',
      description: 'Search OSRS NPCs by name. Supports partial matching. Returns matching NPC IDs and names.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (partial name, e.g., "dragon" or "goblin")' },
          exact: { type: 'boolean', description: 'Exact match only (default: false)' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['query']
      }
    },
    {
      name: 'search_objects',
      description: 'Search OSRS objects by name. Supports partial matching. Returns matching object IDs and names.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (partial name, e.g., "bank" or "altar")' },
          exact: { type: 'boolean', description: 'Exact match only (default: false)' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['query']
      }
    },
    {
      name: 'search_scripts',
      description: 'Search RS2ASM scripts by content. Finds opcodes, string literals, invoke calls, and labels.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (opcode like "get_varbit", function call like "invoke", etc.)' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['query']
      }
    },
    {
      name: 'search_varbits',
      description: 'Search varbits by ID, var_player index, or bit range. Returns varbit ID, base var index, and bit allocation.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (varbit ID, var_player index number, or bit range like "0-0")' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['query']
      }
    },
    {
      name: 'find_varbits_by_index',
      description: 'Find all varbits that share the same var_player index (base variable). Shows bit allocation within the var_player.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'number', description: 'The var_player index to search for' }
        },
        required: ['index']
      }
    },
    {
      name: 'get_varbit_script_refs',
      description: 'Find all scripts that read or write a specific varbit. Shows get_varbit and set_varbit operations.',
      inputSchema: {
        type: 'object',
        properties: {
          varbit_id: { type: 'number', description: 'The varbit ID to find script references for' }
        },
        required: ['varbit_id']
      }
    },

    // Cross-reference tools
    {
      name: 'find_by_model',
      description: 'Find all items, NPCs, and objects that use a specific model ID. Useful for reverse engineering.',
      inputSchema: {
        type: 'object',
        properties: {
          model_id: { type: 'number', description: 'Model ID to search for' }
        },
        required: ['model_id']
      }
    },
    {
      name: 'find_by_animation',
      description: 'Find all NPCs and objects that use a specific animation/sequence ID.',
      inputSchema: {
        type: 'object',
        properties: {
          animation_id: { type: 'number', description: 'Animation/sequence ID to search for' }
        },
        required: ['animation_id']
      }
    },
    {
      name: 'find_by_inventory_model',
      description: 'Find all items that use a specific inventory model ID.',
      inputSchema: {
        type: 'object',
        properties: {
          model_id: { type: 'number', description: 'Inventory model ID to search for' }
        },
        required: ['model_id']
      }
    },

    // Utility tools
    {
      name: 'get_multiple',
      description: 'Get multiple cache definitions of the same type by ID array. More efficient than individual calls.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['item', 'npc', 'object', 'enum', 'sequence', 'struct', 'param', 'varbit', 'var_player', 'kit', 'spotanim', 'inventory', 'dbrow', 'dbtable'],
            description: 'Cache type to fetch'
          },
          ids: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of IDs to fetch'
          }
        },
        required: ['type', 'ids']
      }
    },
    {
      name: 'get_cache_stats',
      description: 'Get OSRS cache statistics - file counts per type, index status, and cache path.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },

    // Game value tools
    {
      name: 'get_gameval',
      description: 'Get a game value by category and ID. Game values contain entity names organized by category (items, npcs, objects, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'number',
            description: 'Category ID (0=items, 1=npcs, 2=inventories, 3=structs, 4=varbits, 6=objects, 7=sequences, 8=spotanims, 9=scripts, 10=dbtables, 11=music, 12=enums, 14=overlays, 15=vars)'
          },
          id: { type: 'number', description: 'Entry ID within the category' }
        },
        required: ['category', 'id']
      }
    },
    {
      name: 'list_gameval_categories',
      description: 'List all game value categories with entry counts. Shows available categories like items, npcs, objects, etc.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'search_gamevals',
      description: 'Search game values by name across all categories or within a specific category.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (partial name match)' },
          category: {
            type: 'number',
            description: 'Optional category to filter by (0=items, 1=npcs, 6=objects, etc.)'
          },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['query']
      }
    },

    // Phase 5: Advanced search tools
    {
      name: 'search_items_advanced',
      description: 'Advanced item search with multiple filters. Filter by equipment slot, tradeable, members, value, weight, and combat stats. Supports pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Partial name match' },
          equipSlot: {
            type: 'string',
            enum: ['head', 'cape', 'neck', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring', 'ammo'],
            description: 'Equipment slot to filter by'
          },
          tradeable: { type: 'boolean', description: 'Filter by tradeable status' },
          members: { type: 'boolean', description: 'Filter by members-only status' },
          minValue: { type: 'number', description: 'Minimum item value (cost in gp)' },
          maxValue: { type: 'number', description: 'Maximum item value (cost in gp)' },
          minWeight: { type: 'number', description: 'Minimum weight (in grams)' },
          maxWeight: { type: 'number', description: 'Maximum weight (in grams)' },
          stackable: { type: 'boolean', description: 'Filter by stackable status' },
          minAttackStab: { type: 'number', description: 'Minimum stab attack bonus' },
          minAttackSlash: { type: 'number', description: 'Minimum slash attack bonus' },
          minAttackCrush: { type: 'number', description: 'Minimum crush attack bonus' },
          minAttackMagic: { type: 'number', description: 'Minimum magic attack bonus' },
          minAttackRanged: { type: 'number', description: 'Minimum ranged attack bonus' },
          minDefenceStab: { type: 'number', description: 'Minimum stab defence bonus' },
          minDefenceSlash: { type: 'number', description: 'Minimum slash defence bonus' },
          minDefenceCrush: { type: 'number', description: 'Minimum crush defence bonus' },
          minDefenceMagic: { type: 'number', description: 'Minimum magic defence bonus' },
          minDefenceRanged: { type: 'number', description: 'Minimum ranged defence bonus' },
          minMeleeStrength: { type: 'number', description: 'Minimum melee strength bonus' },
          minRangedStrength: { type: 'number', description: 'Minimum ranged strength bonus' },
          minMagicDamage: { type: 'number', description: 'Minimum magic damage bonus' },
          minPrayer: { type: 'number', description: 'Minimum prayer bonus' },
          offset: { type: 'number', description: 'Result offset for pagination (default: 0)' },
          limit: { type: 'number', description: 'Max results per page (default: 25)' }
        }
      }
    },
    {
      name: 'search_npcs_advanced',
      description: 'Advanced NPC search with multiple filters. Filter by combat level, actions, attackable status, size, and interactability. Supports pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Partial name match' },
          minCombatLevel: { type: 'number', description: 'Minimum combat level' },
          maxCombatLevel: { type: 'number', description: 'Maximum combat level' },
          hasAction: { type: 'string', description: 'Filter NPCs with specific action (e.g., "Attack", "Talk-to", "Pickpocket")' },
          attackable: { type: 'boolean', description: 'Filter by attackable status (has Attack action)' },
          size: { type: 'number', description: 'NPC size in tiles (1, 2, 3, etc.)' },
          interactable: { type: 'boolean', description: 'Filter by interactable status' },
          offset: { type: 'number', description: 'Result offset for pagination (default: 0)' },
          limit: { type: 'number', description: 'Max results per page (default: 25)' }
        }
      }
    },
    {
      name: 'search_objects_advanced',
      description: 'Advanced object search with multiple filters. Filter by actions, size, interactability, and projectile blocking. Supports pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Partial name match' },
          hasAction: { type: 'string', description: 'Filter objects with specific action (e.g., "Open", "Mine", "Chop down", "Bank")' },
          blocksProjectile: { type: 'boolean', description: 'Filter by projectile blocking status' },
          interactable: { type: 'boolean', description: 'Filter by interactable status (interactType > 0)' },
          minSizeX: { type: 'number', description: 'Minimum X size in tiles' },
          maxSizeX: { type: 'number', description: 'Maximum X size in tiles' },
          minSizeY: { type: 'number', description: 'Minimum Y size in tiles' },
          maxSizeY: { type: 'number', description: 'Maximum Y size in tiles' },
          offset: { type: 'number', description: 'Result offset for pagination (default: 0)' },
          limit: { type: 'number', description: 'Max results per page (default: 25)' }
        }
      }
    },

    // Phase 6: Interface tools
    {
      name: 'list_interfaces',
      description: 'List all parent interface IDs with widget counts. Shows the top interfaces by size.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_interface_tree',
      description: 'Get full widget hierarchy for an interface. Shows all child widgets with their types, text, and actions.',
      inputSchema: {
        type: 'object',
        properties: {
          parent: { type: 'number', description: 'Parent interface ID' },
          include_details: { type: 'boolean', description: 'Include full widget properties like sprite IDs and model IDs (default: false, shows summary)' }
        },
        required: ['parent']
      }
    },
    {
      name: 'search_interfaces',
      description: 'Search interface widgets by text content. Find buttons, labels, and other UI elements.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (matches widget text content)' },
          type: {
            type: 'number',
            description: 'Filter by widget type (0=container, 3=rectangle, 4=text, 5=sprite, 6=model)'
          },
          has_action: { type: 'boolean', description: 'Only show widgets with actions' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['query']
      }
    },
    {
      name: 'find_interfaces_by_action',
      description: 'Find interface widgets with a specific action. Actions are right-click menu options (e.g., "Close", "Bank", "Trade").',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action to search for (case-insensitive, partial match)' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['action']
      }
    },

    // Phase 6.5: Interface cross-reference tools
    {
      name: 'find_interface_script_refs',
      description: 'Find scripts that reference a specific interface widget. Shows which scripts modify or read this interface.',
      inputSchema: {
        type: 'object',
        properties: {
          parent: { type: 'number', description: 'Parent interface ID' },
          child: { type: 'number', description: 'Child widget ID' }
        },
        required: ['parent', 'child']
      }
    },
    {
      name: 'find_interface_varbit_refs',
      description: 'Find varbits referenced by an interface widget. Shows varTransmitTriggers and clientScript VARBIT opcodes.',
      inputSchema: {
        type: 'object',
        properties: {
          parent: { type: 'number', description: 'Parent interface ID' },
          child: { type: 'number', description: 'Child widget ID' }
        },
        required: ['parent', 'child']
      }
    },
    {
      name: 'find_varbit_interface_refs',
      description: 'Find interface widgets that display or use a specific varbit. Shows which UI elements are affected by a varbit change.',
      inputSchema: {
        type: 'object',
        properties: {
          varbit_id: { type: 'number', description: 'Varbit ID to search for' }
        },
        required: ['varbit_id']
      }
    },

    // Phase 7: Analysis tools
    {
      name: 'find_item_variants',
      description: 'Find all variants of an item including noted, placeholder, bought, and items sharing the same inventory model. Useful for tracking item relationships.',
      inputSchema: {
        type: 'object',
        properties: {
          item_id: { type: 'number', description: 'Item ID to find variants for (e.g., 385 for Shark, 4151 for Abyssal whip)' }
        },
        required: ['item_id']
      }
    },
    {
      name: 'find_equipment_set',
      description: 'Find all equipment items in the same set based on name prefix (e.g., "Dragon" from "Dragon platebody"). Groups items by equipment slot.',
      inputSchema: {
        type: 'object',
        properties: {
          item_id: { type: 'number', description: 'Equipment item ID to find set for (e.g., 1127 for Rune platebody)' }
        },
        required: ['item_id']
      }
    },
    {
      name: 'analyze_npc',
      description: 'Get detailed combat analysis for an NPC including combat stats (attack, defence, strength, hitpoints, ranged, magic), size, actions, and animations.',
      inputSchema: {
        type: 'object',
        properties: {
          npc_id: { type: 'number', description: 'NPC ID to analyze (e.g., 3127 for TzTok-Jad, 2042 for Zulrah)' }
        },
        required: ['npc_id']
      }
    },
    {
      name: 'find_item_sources',
      description: 'Find where an item comes from: NPCs that drop it (from collection log data) and shops that sell it.',
      inputSchema: {
        type: 'object',
        properties: {
          item_id: { type: 'number', description: 'Item ID to find sources for (e.g., 3140 for Dragon chainbody)' }
        },
        required: ['item_id']
      }
    },

    // Phase 8: Database deep dive tools
    {
      name: 'list_dbtables',
      description: 'List all database tables with column counts, row counts, and indexed columns. Tables store structured game data like quests, achievements, combat info.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max tables to return (default: 50)' }
        }
      }
    },
    {
      name: 'get_dbtable_schema',
      description: 'Get detailed schema for a database table including column types with human-readable descriptions, default values, and indexed columns.',
      inputSchema: {
        type: 'object',
        properties: {
          table_id: { type: 'number', description: 'Database table ID' },
          include_sample: { type: 'boolean', description: 'Include a sample row to see actual data (default: false)' }
        },
        required: ['table_id']
      }
    },
    {
      name: 'get_table_rows',
      description: 'Get all rows belonging to a specific database table. Returns row IDs and summarized values with pagination support.',
      inputSchema: {
        type: 'object',
        properties: {
          table_id: { type: 'number', description: 'Database table ID' },
          offset: { type: 'number', description: 'Starting offset for pagination (default: 0)' },
          limit: { type: 'number', description: 'Max rows to return (default: 25)' }
        },
        required: ['table_id']
      }
    },
    {
      name: 'query_dbtable',
      description: 'Query database table with filters. Uses pre-built indexes for fast equality lookups on indexed columns. Supports operators: eq, neq, gt, gte, lt, lte, contains.',
      inputSchema: {
        type: 'object',
        properties: {
          table_id: { type: 'number', description: 'Database table ID' },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                column: { type: 'number', description: 'Column index to filter on' },
                operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'], description: 'Filter operator' },
                value: { type: ['string', 'number', 'boolean'], description: 'Value to filter by' }
              },
              required: ['column', 'operator', 'value']
            },
            description: 'Array of filter conditions'
          },
          offset: { type: 'number', description: 'Starting offset for pagination (default: 0)' },
          limit: { type: 'number', description: 'Max rows to return (default: 25)' }
        },
        required: ['table_id', 'filters']
      }
    },
    {
      name: 'search_dbrows',
      description: 'Full-text search across all STRING column values in database rows. Useful for finding rows containing specific text like quest names, NPC names, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text (case-insensitive partial match)' },
          table_id: { type: 'number', description: 'Optional: limit search to specific table' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' }
        },
        required: ['query']
      }
    },

    // Phase 9: Export tools
    {
      name: 'export_item_stats',
      description: 'Export bulk item combat stats. Without filters, returns summary. With filters, exports actual data in JSON or CSV format.',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'csv'],
            description: 'Output format (default: json)'
          },
          equip_slot: {
            type: 'number',
            description: 'Filter by equipment slot number (0=head, 1=cape, 2=neck, 3=weapon, 4=body, 5=shield, 7=legs, 9=hands, 10=feet, 12=ring, 13=ammo)'
          },
          combat_only: {
            type: 'boolean',
            description: 'Only export items with at least one combat stat > 0'
          }
        }
      }
    },
    {
      name: 'export_npc_combat',
      description: 'Export bulk NPC combat data (stats, combat level, size). Without filters, returns summary. With filters, exports actual data in JSON or CSV format.',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'csv'],
            description: 'Output format (default: json)'
          },
          min_combat: {
            type: 'number',
            description: 'Minimum combat level'
          },
          max_combat: {
            type: 'number',
            description: 'Maximum combat level'
          },
          attackable_only: {
            type: 'boolean',
            description: 'Only export attackable NPCs (have "Attack" action)'
          }
        }
      }
    },
    {
      name: 'export_model_refs',
      description: 'Export model usage across items, NPCs, and objects. Without filters, returns summary. With filters, exports actual data in JSON or CSV format.',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'csv'],
            description: 'Output format (default: json)'
          },
          entity_type: {
            type: 'string',
            enum: ['item', 'npc', 'object'],
            description: 'Filter models by entity type that uses them'
          },
          min_usage: {
            type: 'number',
            description: 'Minimum number of entity references (to find shared models)'
          }
        }
      }
    },

    // Phase 10: Animation & Sequence Analysis tools
    {
      name: 'find_relative_animations',
      description: 'Find animations related by shared frame group (skeleton), with linked spot animations (GFX). Accepts animation_id and/or npc_id. Scans neighboring IDs to discover animation clusters. Returns grouped results with spot anim linkage.',
      inputSchema: {
        type: 'object',
        properties: {
          animation_id: { type: 'number', description: 'Animation/sequence ID to find relatives for' },
          npc_id: { type: 'number', description: 'NPC ID - extracts all animations as seeds' },
          range: { type: 'number', description: 'ID range to scan around seeds (default: 50)' }
        }
      }
    },
    {
      name: 'search_sequences_advanced',
      description: 'Advanced animation/sequence search with multiple filters. Filter by type (skeletal/frame), duration, frame count, priority, sounds, hand items, frame group, Maya ID, or by NPC/object name. Supports pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['skeletal', 'frame'],
            description: 'Filter by animation type: "skeletal" (BA2/Maya-based, modern) or "frame" (classic frame-based)'
          },
          minDuration: { type: 'number', description: 'Minimum total duration in game ticks' },
          maxDuration: { type: 'number', description: 'Maximum total duration in game ticks' },
          minFrameCount: { type: 'number', description: 'Minimum number of frames' },
          maxFrameCount: { type: 'number', description: 'Maximum number of frames' },
          hasSounds: { type: 'boolean', description: 'Filter by whether animation has sound effects' },
          leftHandItem: { type: 'number', description: 'Filter by left hand item ID held during animation' },
          rightHandItem: { type: 'number', description: 'Filter by right hand item ID held during animation' },
          minPriority: { type: 'number', description: 'Minimum forced priority' },
          maxPriority: { type: 'number', description: 'Maximum forced priority' },
          frameGroup: { type: 'number', description: 'Filter by frame archive group ID (frame-based animations only)' },
          animMayaID: { type: 'number', description: 'Filter by exact Maya animation ID (skeletal animations only)' },
          usedByNpc: { type: 'string', description: 'Filter by NPC name (partial match) - shows only animations used by matching NPCs' },
          usedByObject: { type: 'string', description: 'Filter by object name (partial match) - shows only animations used by matching objects' },
          offset: { type: 'number', description: 'Result offset for pagination (default: 0)' },
          limit: { type: 'number', description: 'Max results per page (default: 25)' }
        }
      }
    },
    {
      name: 'get_npc_animations',
      description: 'Get comprehensive animation information for an NPC. Shows all defined animations (idle, walk, run, rotate, crawl) with sequence details (type, duration, priority, sounds). Also shows transform/morph variant animations if the NPC has multiple forms.',
      inputSchema: {
        type: 'object',
        properties: {
          npc_id: { type: 'number', description: 'NPC ID to get animations for (e.g., 3127 for TzTok-Jad, 6611 for Vet\'ion)' }
        },
        required: ['npc_id']
      }
    }
  ];
}

export async function handleToolCall(
  cache: CacheManager,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  switch (toolName) {
    // Lookup tools
    case 'get_item':
      return handleGetItem(cache, args as { id: number });
    case 'get_npc':
      return handleGetNpc(cache, args as { id: number });
    case 'get_object':
      return handleGetObject(cache, args as { id: number });
    case 'get_enum':
      return handleGetEnum(cache, args as { id: number });
    case 'get_sequence':
      return handleGetSequence(cache, args as { id: number });
    case 'get_interface':
      return handleGetInterface(cache, args as { parent: number; child: number });
    case 'get_struct':
      return handleGetStruct(cache, args as { id: number });
    case 'get_param':
      return handleGetParam(cache, args as { id: number });
    case 'get_varbit':
      return handleGetVarbit(cache, args as { id: number });
    case 'get_var_player':
      return handleGetVarPlayer(cache, args as { id: number });
    case 'get_sprite':
      return handleGetSprite(cache, args as { id: number });
    case 'get_sprite_frame':
      return handleGetSpriteFrame(cache, args as { group_id: number; frame: number });
    case 'get_sprite_group':
      return handleGetSpriteGroup(cache, args as { group_id: number });
    case 'search_sprites':
      return handleSearchSprites(cache, args as { pattern: string; limit?: number });
    case 'list_sprites':
      return handleListSprites(cache);
    case 'get_dbrow':
      return handleGetDbrow(cache, args as { id: number });
    case 'get_dbtable':
      return handleGetDbtable(cache, args as { id: number });
    case 'get_script':
      return handleGetScript(cache, args as { id: number });
    case 'list_scripts':
      return handleListScripts(cache);

    // Search tools
    case 'search_items':
      return handleSearchItems(cache, args as { query: string; exact?: boolean; limit?: number });
    case 'search_npcs':
      return handleSearchNpcs(cache, args as { query: string; exact?: boolean; limit?: number });
    case 'search_objects':
      return handleSearchObjects(cache, args as { query: string; exact?: boolean; limit?: number });
    case 'search_scripts':
      return handleSearchScripts(cache, args as { query: string; limit?: number });
    case 'search_varbits':
      return handleSearchVarbits(cache, args as { query: string; limit?: number });
    case 'find_varbits_by_index':
      return handleFindVarbitsByIndex(cache, args as { index: number });
    case 'get_varbit_script_refs':
      return handleGetVarbitScriptRefs(cache, args as { varbit_id: number });

    // Cross-reference tools
    case 'find_by_model':
      return handleFindByModel(cache, args as { model_id: number });
    case 'find_by_animation':
      return handleFindByAnimation(cache, args as { animation_id: number });
    case 'find_by_inventory_model':
      return handleFindByInventoryModel(cache, args as { model_id: number });

    // Utility tools
    case 'get_multiple':
      return handleGetMultiple(cache, args as { type: CacheType; ids: number[] });
    case 'get_cache_stats':
      return handleGetCacheStats(cache);

    // Game value tools
    case 'get_gameval':
      return handleGetGameVal(cache, args as { category: number; id: number });
    case 'list_gameval_categories':
      return handleListGameValCategories(cache);
    case 'search_gamevals':
      return handleSearchGameVals(cache, args as { query: string; category?: number; limit?: number });

    // Phase 5: Advanced search tools
    case 'search_items_advanced':
      return handleSearchItemsAdvanced(cache, args as {
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
      });
    case 'search_npcs_advanced':
      return handleSearchNpcsAdvanced(cache, args as {
        name?: string;
        minCombatLevel?: number;
        maxCombatLevel?: number;
        hasAction?: string;
        attackable?: boolean;
        size?: number;
        interactable?: boolean;
        offset?: number;
        limit?: number;
      });
    case 'search_objects_advanced':
      return handleSearchObjectsAdvanced(cache, args as {
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
      });

    // Phase 6: Interface tools
    case 'list_interfaces':
      return handleListInterfaces(cache);
    case 'get_interface_tree':
      return handleGetInterfaceTree(cache, args as { parent: number; include_details?: boolean });
    case 'search_interfaces':
      return handleSearchInterfaces(cache, args as { query: string; type?: number; has_action?: boolean; limit?: number });
    case 'find_interfaces_by_action':
      return handleFindInterfacesByAction(cache, args as { action: string; limit?: number });

    // Phase 6.5: Interface cross-reference tools
    case 'find_interface_script_refs':
      return handleFindInterfaceScriptRefs(cache, args as { parent: number; child: number });
    case 'find_interface_varbit_refs':
      return handleFindInterfaceVarbitRefs(cache, args as { parent: number; child: number });
    case 'find_varbit_interface_refs':
      return handleFindVarbitInterfaceRefs(cache, args as { varbit_id: number });

    // Phase 7: Analysis tools
    case 'find_item_variants':
      return handleFindItemVariants(cache, args as { item_id: number });
    case 'find_equipment_set':
      return handleFindEquipmentSet(cache, args as { item_id: number });
    case 'analyze_npc':
      return handleAnalyzeNpc(cache, args as { npc_id: number });
    case 'find_item_sources':
      return handleFindItemSources(cache, args as { item_id: number });

    // Phase 8: Database deep dive tools
    case 'list_dbtables':
      return handleListDbtables(cache, args as { limit?: number });
    case 'get_dbtable_schema':
      return handleGetDbtableSchema(cache, args as { table_id: number; include_sample?: boolean });
    case 'get_table_rows':
      return handleGetTableRows(cache, args as { table_id: number; offset?: number; limit?: number });
    case 'query_dbtable':
      return handleQueryDbtable(cache, args as {
        table_id: number;
        filters: Array<{ column: number; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'; value: string | number | boolean }>;
        offset?: number;
        limit?: number;
      });
    case 'search_dbrows':
      return handleSearchDbrows(cache, args as { query: string; table_id?: number; limit?: number });

    // Phase 9: Export tools
    case 'export_item_stats':
      return handleExportItemStats(cache, args as {
        format?: 'json' | 'csv';
        equip_slot?: number;
        combat_only?: boolean;
      });
    case 'export_npc_combat':
      return handleExportNpcCombat(cache, args as {
        format?: 'json' | 'csv';
        min_combat?: number;
        max_combat?: number;
        attackable_only?: boolean;
      });
    case 'export_model_refs':
      return handleExportModelRefs(cache, args as {
        format?: 'json' | 'csv';
        entity_type?: 'item' | 'npc' | 'object';
        min_usage?: number;
      });

    // Phase 10: Animation & Sequence Analysis tools
    case 'find_related_animations':
      return handleFindRelatedAnimations(cache, args as { animation_id: number });
    case 'find_relative_animations':
      return handleFindRelativeAnimationsEnhanced(cache, args as { animation_id?: number; npc_id?: number; range?: number });
    case 'search_sequences_advanced':
      return handleSearchSequencesAdvanced(cache, args as {
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
      });
    case 'get_npc_animations':
      return handleGetNpcAnimations(cache, args as { npc_id: number });

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true
      };
  }
}
