// Configuration types
export interface Config {
  cachePath: string;
  indexOnStartup: boolean;
  maxSearchResults: number;
}

// Cache type mapping
export type CacheType =
  | 'item'
  | 'npc'
  | 'object'
  | 'enum'
  | 'sequence'
  | 'struct'
  | 'param'
  | 'varbit'
  | 'var_player'
  | 'kit'
  | 'spotanim'
  | 'inventory'
  | 'dbrow'
  | 'dbtable'
  | 'overlay'
  | 'underlay'
  | 'script';

// Directory mapping for each cache type
export const TYPE_TO_DIR: Record<CacheType, string> = {
  item: 'item_defs',
  npc: 'npc_defs',
  object: 'object_defs',
  enum: 'enums',
  sequence: 'sequences',
  struct: 'structs',
  param: 'param_defs',
  varbit: 'var_bits',
  var_player: 'var_players',
  kit: 'kits',
  spotanim: 'spotanims',
  inventory: 'inventories',
  dbrow: 'dbrow',
  dbtable: 'dbtable',
  overlay: 'overlays',
  underlay: 'underlays',
  script: 'rs2asm'
};

// Index types for name search
export interface NameIndexEntry {
  id: number;
  name: string;
  nameLower: string;
}

export interface NameIndex {
  byNameLower: Map<string, number>;
  entries: NameIndexEntry[];
}

// Cross-reference index types
export interface CrossRefEntry {
  id: number;
  name: string;
  type: 'item' | 'npc' | 'object';
}

export interface CrossRefIndex {
  modelToEntities: Map<number, CrossRefEntry[]>;
  animationToEntities: Map<number, CrossRefEntry[]>;
  inventoryModelToItems: Map<number, CrossRefEntry[]>;
}

// Search options
export interface SearchOptions {
  exact?: boolean;
  limit?: number;
}

// Search result
export interface SearchResult {
  id: number;
  name: string;
}

// Script index entry for content search
export interface ScriptIndexEntry {
  id: number;
  content: string;
  contentLower: string;
  intArgCount: number;
  objArgCount: number;
}

// Script search result with context
export interface ScriptSearchResult {
  id: number;
  matchLine: string;
  lineNumber: number;
}

// Sprite data with base64 content and metadata
export interface SpriteData {
  id: number;
  width: number;
  height: number;
  dataUri: string;
  path: string;
  groupId?: number;
  frameIndex?: number;
}

// Sprite group entry for grouped sprites
export interface SpriteGroupEntry {
  id: number;
  frameIndex: number;
  path: string;
}

// Sprite search result
export interface SpriteSearchResult {
  id: number;
  path: string;
  isGroup: boolean;
  frameCount?: number;
}

// Tool response - matches MCP SDK CallToolResult
export interface ToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

// Cache definitions (partial - common fields)
export interface ItemDef {
  id: number;
  name: string;
  examine?: string;
  inventoryModel?: number;
  maleModel0?: number;
  maleModel1?: number;
  femaleModel0?: number;
  femaleModel1?: number;
  stackable?: number;
  cost?: number;
  weight?: number;
  options?: string[];
  isTradeable?: boolean;
  [key: string]: unknown;
}

export interface NpcDef {
  id: number;
  name: string;
  models?: number[];
  chatheadModels?: number[];
  standingAnimation?: number;
  walkingAnimation?: number;
  rotateLeftAnimation?: number;
  rotateRightAnimation?: number;
  actions?: string[];
  combatLevel?: number;
  [key: string]: unknown;
}

export interface ObjectDef {
  id: number;
  name: string;
  models?: number[];
  modelTypes?: number[];
  sizeX?: number;
  sizeY?: number;
  animationID?: number;
  actions?: (string | null)[];
  [key: string]: unknown;
}

// Varbit definition - bit fields within player variables
export interface VarbitDef {
  id: number;
  index: number;  // The var_player index this varbit is stored in
  leastSignificantBit: number;
  mostSignificantBit: number;
  [key: string]: unknown;
}

// Var_player definition - player variable container
export interface VarPlayerDef {
  id: number;
  configType: number;
  [key: string]: unknown;
}

// Varbit index entry for search
export interface VarbitIndexEntry {
  id: number;
  index: number;
  lsb: number;
  msb: number;
}

// Varbit search result
export interface VarbitSearchResult {
  id: number;
  index: number;
  bitRange: string;
}

// Varbit cross-reference (script that uses a varbit)
export interface VarbitScriptRef {
  scriptId: number;
  lineNumber: number;
  operation: 'get' | 'set';
  matchLine: string;
}

// Game value category mapping
// Categories: 0=items, 1=npcs, 2=inventories, 3=structs, 4=varbits, 6=objects,
// 7=sequences, 8=spotanims, 9=scripts, 10=dbtables, 11=music, 12=enums, 14=overlays, 15=varbits2
export const GAMEVAL_CATEGORIES: Record<number, string> = {
  0: 'items',
  1: 'npcs',
  2: 'inventories',
  3: 'structs',
  4: 'varbits',
  6: 'objects',
  7: 'sequences',
  8: 'spotanims',
  9: 'scripts',
  10: 'dbtables',
  11: 'music',
  12: 'enums',
  14: 'overlays',
  15: 'vars'
};

// Game value definition
export interface GameValDef {
  gameValId: number;  // Category ID
  id: number;         // Entry ID within category
  name: string;       // Entity name (snake_case)
  files: Record<string, string>;  // Field definitions (mostly empty)
}

// Game value index entry for search
export interface GameValIndexEntry {
  category: number;
  id: number;
  name: string;
  nameLower: string;
  hasFields: boolean;  // Whether files object is populated
}

// Game value search result
export interface GameValSearchResult {
  category: number;
  categoryName: string;
  id: number;
  name: string;
  hasFields: boolean;
}

// Game value category info
export interface GameValCategoryInfo {
  category: number;
  name: string;
  count: number;
}

// ============================================
// Phase 5: Advanced Search & Filtering Types
// ============================================

// Equipment slot mapping (wearPos1 values)
export const EQUIPMENT_SLOTS: Record<number, string> = {
  0: 'head',
  1: 'cape',
  2: 'neck',
  3: 'weapon',
  4: 'body',
  5: 'shield',
  7: 'legs',
  9: 'hands',
  10: 'feet',
  12: 'ring',
  13: 'ammo'
};

// Reverse mapping for filtering by slot name
export const SLOT_TO_WEARPOS: Record<string, number> = {
  head: 0,
  cape: 1,
  neck: 2,
  weapon: 3,
  body: 4,
  shield: 5,
  legs: 7,
  hands: 9,
  feet: 10,
  ring: 12,
  ammo: 13
};

// Combat stat param IDs (based on observed patterns)
// These are the param keys used in item definitions
export const ITEM_STAT_PARAMS: Record<string, number> = {
  attackStab: 0,
  attackSlash: 1,
  attackCrush: 2,
  attackMagic: 3,
  attackRanged: 4,
  defenceStab: 5,
  defenceSlash: 6,
  defenceCrush: 7,
  defenceMagic: 8,
  defenceRanged: 9,
  meleeStrength: 10,
  rangedStrength: 11,
  magicDamage: 12,
  prayer: 13,
  attackSpeed: 14
};

// Item filter options for advanced search
export interface ItemAdvancedFilter {
  // Name search (partial match)
  name?: string;
  // Equipment slot filter (by slot name: head, body, weapon, etc.)
  equipSlot?: string;
  // Tradeable filter
  tradeable?: boolean;
  // Members-only filter
  members?: boolean;
  // Value range (cost field)
  minValue?: number;
  maxValue?: number;
  // Weight range (in grams, weight field)
  minWeight?: number;
  maxWeight?: number;
  // Stackable filter
  stackable?: boolean;
  // Stat filters (attack bonuses, defence, strength, prayer)
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
}

// NPC filter options for advanced search
export interface NpcAdvancedFilter {
  // Name search (partial match)
  name?: string;
  // Combat level range
  minCombatLevel?: number;
  maxCombatLevel?: number;
  // Has specific action (Attack, Talk-to, etc.)
  hasAction?: string;
  // Is attackable (has "Attack" action)
  attackable?: boolean;
  // Size filter
  size?: number;
  // Is interactable
  interactable?: boolean;
}

// Object filter options for advanced search
export interface ObjectAdvancedFilter {
  // Name search (partial match)
  name?: string;
  // Has specific action (e.g., "Open", "Mine", "Chop")
  hasAction?: string;
  // Blocks projectiles
  blocksProjectile?: boolean;
  // Is interactable (interactType > 0)
  interactable?: boolean;
  // Size range
  minSizeX?: number;
  maxSizeX?: number;
  minSizeY?: number;
  maxSizeY?: number;
}

// Enhanced item index entry for advanced filtering
export interface ItemIndexEntry {
  id: number;
  name: string;
  nameLower: string;
  // Filterable fields
  equipSlot: number;       // wearPos1 (-1 if not equippable)
  tradeable: boolean;
  members: boolean;
  cost: number;
  weight: number;
  stackable: boolean;
  // Combat stats (from params)
  attackStab: number;
  attackSlash: number;
  attackCrush: number;
  attackMagic: number;
  attackRanged: number;
  defenceStab: number;
  defenceSlash: number;
  defenceCrush: number;
  defenceMagic: number;
  defenceRanged: number;
  meleeStrength: number;
  rangedStrength: number;
  magicDamage: number;
  prayer: number;
}

// Enhanced NPC index entry for advanced filtering
export interface NpcIndexEntry {
  id: number;
  name: string;
  nameLower: string;
  combatLevel: number;
  actions: string[];      // Non-null actions
  size: number;
  interactable: boolean;
}

// Enhanced object index entry for advanced filtering
export interface ObjectIndexEntry {
  id: number;
  name: string;
  nameLower: string;
  actions: string[];      // Non-null actions
  interactType: number;   // 0=none, 1=scenery, 2=interactable
  blocksProjectile: boolean;
  sizeX: number;
  sizeY: number;
}

// Advanced search result with pagination info
export interface AdvancedSearchResult<T> {
  results: T[];
  totalCount: number;
  offset: number;
  limit: number;
}

// Item advanced search result
export interface ItemAdvancedResult {
  id: number;
  name: string;
  equipSlot: string | null;  // Slot name or null if not equippable
  tradeable: boolean;
  members: boolean;
  cost: number;
  weight: number;            // In grams
}

// NPC advanced search result
export interface NpcAdvancedResult {
  id: number;
  name: string;
  combatLevel: number;
  actions: string[];
  size: number;
}

// Object advanced search result
export interface ObjectAdvancedResult {
  id: number;
  name: string;
  actions: string[];
  interactable: boolean;
  sizeX: number;
  sizeY: number;
}

// ============================================
// Phase 8: Database Deep Dive Types
// ============================================

// Database column type
export type DBColumnType =
  | 'INTEGER' | 'STRING' | 'BOOLEAN' | 'COORDGRID'
  | 'NPC' | 'LOC' | 'MAPELEMENT' | 'GRAPHIC'
  | 'OBJ' | 'STAT' | 'DBROW' | 'STRUCT';

// Human-readable descriptions for DB column types
export const DB_TYPE_DESCRIPTIONS: Record<string, string> = {
  INTEGER: 'Integer number',
  STRING: 'Text string',
  BOOLEAN: 'True/False',
  COORDGRID: 'Map coordinate',
  NPC: 'NPC ID reference',
  LOC: 'Object/Location ID reference',
  MAPELEMENT: 'Map element reference',
  GRAPHIC: 'Graphic/SpotAnim ID',
  OBJ: 'Item ID reference',
  STAT: 'Skill ID reference',
  DBROW: 'Database row reference',
  STRUCT: 'Struct reference'
};

// DB search index entry for full-text search
export interface DBRowIndexEntry {
  id: number;
  tableId: number;
  searchText: string;
  searchTextLower: string;
}

// Table summary for list_dbtables
export interface DBTableSummary {
  id: number;
  columnCount: number;
  rowCount: number;
  indexedColumns: number[];
}

// DBTable index data from pre-built index files
export interface DBTableIndexData {
  tableId: number;
  columnId: number;
  tupleTypes: string[];
  tupleIndexes: Array<Record<string, number[]>>;
}

// Query filter for query_dbtable
export interface DBQueryFilter {
  column: number;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: string | number | boolean;
}

// ============================================
// Phase 6: Interface Deep Dive Types
// ============================================

// Interface type mapping
export const INTERFACE_TYPES: Record<number, string> = {
  0: 'container',
  3: 'rectangle',
  4: 'text',
  5: 'sprite',
  6: 'model',
  8: 'line',
  9: 'arc'
};

// Interface index entry for searching
export interface InterfaceIndexEntry {
  parentId: number;
  childId: number;
  fullId: number;           // parent * 65536 + child
  type: number;
  text: string;
  textLower: string;
  actions: string[];        // Non-null actions
  spriteId: number;         // -1 if none
  modelId: number;          // -1 if none
  hasListener: boolean;
}

// Interface search result
export interface InterfaceSearchResult {
  parentId: number;
  childId: number;
  type: number;
  typeName: string;
  text: string;
  actions: string[];
}

// Interface tree node for hierarchy display
export interface InterfaceTreeNode {
  parentId: number;
  childId: number;
  type: number;
  typeName: string;
  text?: string;
  actions?: string[];
  spriteId?: number;
  modelId?: number;
  children: InterfaceTreeNode[];
}

// Summary info for list_interfaces
export interface InterfaceParentInfo {
  parentId: number;
  childCount: number;
}

// ============================================
// Phase 6.5: Interface Cross-References Types
// ============================================

// Script reference to an interface widget
export interface InterfaceScriptRef {
  scriptId: number;
  lineNumber: number;
  opcode: string;        // e.g., "if_settext", "if_sethide", "if_find"
  matchLine: string;     // The actual code line
  fullId: number;        // parent * 65536 + child
  parentId: number;
  childId: number;
}

// Interface reference to a varbit
export interface InterfaceVarbitRef {
  parentId: number;
  childId: number;
  fullId: number;
  fieldName: string;     // "varTransmitTriggers" or "clientScripts"
  varbitId: number;
}

// ============================================
// Phase 7: Relationship & Analysis Types
// ============================================

// Item variant relationship
export interface ItemVariant {
  id: number;
  name: string;
  relationship: 'noted' | 'unnoted' | 'placeholder' | 'bought' | 'same_model';
}

// Item variants result
export interface ItemVariantsResult {
  baseItem: {
    id: number;
    name: string;
  };
  variants: ItemVariant[];
}

// Equipment set match
export interface EquipmentSetMatch {
  id: number;
  name: string;
  slot: string;      // "head", "body", "legs", etc.
  matchType: 'prefix' | 'category';
}

// Equipment set result
export interface EquipmentSetResult {
  baseItem: {
    id: number;
    name: string;
    slot: string;
    prefix: string;
  };
  setItems: EquipmentSetMatch[];
}

// NPC combat analysis
export interface NpcCombatAnalysis {
  id: number;
  name: string;
  combatLevel: number;
  stats: {
    attack: number;
    defence: number;
    strength: number;
    hitpoints: number;
    ranged: number;
    magic: number;
  };
  attackable: boolean;
  size: number;
  animations: {
    standing?: number;
    walking?: number;
    attack?: number;
    death?: number;
  };
  actions: string[];
}

// Item source types for find_item_sources tool
export interface NpcDropSource {
  npcId: number;
  npcName: string;
  description: string;
}

export interface ShopSource {
  itemId: number;
  price: number;
  currency: string;
  stock: number;
}

export interface ItemSourcesResult {
  item: { id: number; name: string };
  sources: {
    npcDrops: NpcDropSource[];
    shops: ShopSource[];
  };
  totalSources: number;
}

// ============================================
// Phase 9: Export & Visualization Types
// ============================================

export type ExportFormat = 'json' | 'csv';

// Item stats export structure
export interface ItemStatsExport {
  id: number;
  name: string;
  equipSlot: number;      // Raw slot number (-1 if not equippable)
  tradeable: boolean;
  members: boolean;
  cost: number;
  weight: number;
  stackable: boolean;
  // Combat stats
  attackStab: number;
  attackSlash: number;
  attackCrush: number;
  attackMagic: number;
  attackRanged: number;
  defenceStab: number;
  defenceSlash: number;
  defenceCrush: number;
  defenceMagic: number;
  defenceRanged: number;
  meleeStrength: number;
  rangedStrength: number;
  magicDamage: number;
  prayer: number;
}

// NPC combat export structure
export interface NpcCombatExport {
  id: number;
  name: string;
  combatLevel: number;
  attack: number;
  defence: number;
  strength: number;
  hitpoints: number;
  ranged: number;
  magic: number;
  size: number;
  attackable: boolean;
  actions: string[];
}

// Model reference export structure
export interface ModelRefExport {
  modelId: number;
  usageCount: number;
  items: { id: number; name: string }[];
  npcs: { id: number; name: string }[];
  objects: { id: number; name: string }[];
}

// ============================================
// Phase 10: Animation & Sequence Analysis Types
// ============================================

// Animation type classification
export type SequenceType = 'skeletal' | 'frame';

// Sequence index entry for advanced filtering and search
export interface SequenceIndexEntry {
  id: number;
  type: SequenceType;          // 'skeletal' if animMayaID > 0, else 'frame'
  frameCount: number;          // Length of frameIDs array (frame-based) or maya frame range
  totalDuration: number;       // Sum of frameLengths (ticks) or mayaEnd - mayaStart
  forcedPriority: number;
  priority: number;
  leftHandItem: number;        // -1 if none
  rightHandItem: number;       // -1 if none
  hasSounds: boolean;          // frameSounds is non-empty
  maxLoops: number;
  replyMode: number;
  stretches: boolean;
  // Skeletal-specific fields
  animMayaID: number;          // -1 if frame-based
  animMayaStart: number;
  animMayaEnd: number;
  // Frame-based specific fields
  frameGroup: number;          // High 16 bits of first frameID (archive ID), -1 if skeletal
}

// Filter options for search_sequences_advanced
export interface SequenceAdvancedFilter {
  type?: SequenceType;                // Filter by animation type
  minDuration?: number;               // Minimum total duration in ticks
  maxDuration?: number;               // Maximum total duration in ticks
  minFrameCount?: number;             // Minimum frame count
  maxFrameCount?: number;             // Maximum frame count
  hasSounds?: boolean;                // Has sound effects
  leftHandItem?: number;              // Specific left hand item
  rightHandItem?: number;             // Specific right hand item
  minPriority?: number;               // Minimum forced priority
  maxPriority?: number;               // Maximum forced priority
  frameGroup?: number;                // Specific frame group (archive ID)
  animMayaID?: number;                // Specific Maya animation ID
  usedByNpc?: string;                 // NPC name partial match
  usedByObject?: string;              // Object name partial match
}

// Result for search_sequences_advanced
export interface SequenceAdvancedResult {
  id: number;
  type: SequenceType;
  frameCount: number;
  totalDuration: number;
  forcedPriority: number;
  hasSounds: boolean;
  leftHandItem: number;
  rightHandItem: number;
  // Skeletal fields (only if skeletal)
  animMayaID?: number;
  // Frame fields (only if frame-based)
  frameGroup?: number;
  // Entity associations
  usedBy?: { id: number; name: string; entityType: string }[];
}

// Animation role in an NPC/object definition
export type AnimationRole =
  | 'standing' | 'walking' | 'running'
  | 'rotate180' | 'rotateLeft' | 'rotateRight'
  | 'idleRotateLeft' | 'idleRotateRight'
  | 'runRotate180' | 'runRotateLeft' | 'runRotateRight'
  | 'crawl' | 'crawlRotate180' | 'crawlRotateLeft' | 'crawlRotateRight'
  | 'object';

// Animation entry with role info for NPC/object animation listing
export interface AnimationRoleEntry {
  role: AnimationRole;
  animationId: number;
  sequence?: {
    type: SequenceType;
    frameCount: number;
    totalDuration: number;
    forcedPriority: number;
    hasSounds: boolean;
  };
}

// Result for find_related_animations
export interface RelatedAnimationsResult {
  sourceAnimation: {
    id: number;
    type: SequenceType;
    frameCount: number;
    totalDuration: number;
  };
  // Animations used by the same entities (grouped by entity)
  byEntity: Array<{
    entityId: number;
    entityName: string;
    entityType: 'npc' | 'object';
    animations: AnimationRoleEntry[];
  }>;
  // All unique related animation IDs (excluding the source)
  allRelatedIds: number[];
  // Animations sharing the same frame group or Maya skeleton
  bySkeleton: Array<{
    id: number;
    type: SequenceType;
    frameCount: number;
    totalDuration: number;
  }>;
}

// Result for get_npc_animations
export interface NpcAnimationsResult {
  npc: {
    id: number;
    name: string;
    combatLevel: number;
    size: number;
  };
  animations: AnimationRoleEntry[];
  // Morph/transform variants (if NPC has children)
  transformAnimations?: Array<{
    childNpcId: number;
    childNpcName: string;
    animations: AnimationRoleEntry[];
  }>;
}
