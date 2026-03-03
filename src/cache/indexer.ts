import * as fs from 'fs/promises';
import * as path from 'path';
import {
  NameIndex,
  NameIndexEntry,
  CrossRefIndex,
  CrossRefEntry,
  SearchOptions,
  SearchResult,
  ItemDef,
  NpcDef,
  ObjectDef,
  ScriptIndexEntry,
  ScriptSearchResult,
  VarbitIndexEntry,
  VarbitSearchResult,
  VarbitScriptRef,
  GameValIndexEntry,
  GameValSearchResult,
  GAMEVAL_CATEGORIES,
  // Phase 5: Advanced search types
  ItemIndexEntry,
  NpcIndexEntry,
  ObjectIndexEntry,
  ItemAdvancedFilter,
  NpcAdvancedFilter,
  ObjectAdvancedFilter,
  ItemAdvancedResult,
  NpcAdvancedResult,
  ObjectAdvancedResult,
  AdvancedSearchResult,
  EQUIPMENT_SLOTS,
  SLOT_TO_WEARPOS,
  ITEM_STAT_PARAMS,
  // Phase 6: Interface types
  InterfaceIndexEntry,
  InterfaceSearchResult,
  INTERFACE_TYPES,
  // Phase 6.5: Interface cross-reference types
  InterfaceScriptRef,
  InterfaceVarbitRef,
  // Phase 7: Analysis types
  ItemVariant,
  ItemVariantsResult,
  EquipmentSetMatch,
  EquipmentSetResult,
  NpcCombatAnalysis,
  // Phase 8: Database types
  DBRowIndexEntry,
  // Phase 7.5: Item sources types
  NpcDropSource,
  ShopSource,
  ItemSourcesResult,
  // Phase 9: Export types
  ItemStatsExport,
  NpcCombatExport,
  ModelRefExport,
  // Phase 10: Animation types
  SequenceIndexEntry,
  SequenceType,
  SequenceAdvancedFilter,
  SequenceAdvancedResult,
  RelatedAnimationsResult,
  AnimationRoleEntry,
  AnimationRole,
  RelativeAnimationResult,
  AnimationCluster
} from '../types.js';

const BATCH_SIZE = 500;
const INDEX_VERSION = 12; // Bump this to invalidate cached indexes (spot anim index)

// Item variant index entry (for quick lookup)
interface ItemVariantIndexEntry {
  id: number;
  name: string;
  notedID: number;
  notedTemplate: number;
  placeholderId: number;
  placeholderTemplateId: number;
  boughtId: number;
  boughtTemplateId: number;
  inventoryModel: number;
}

interface PersistedIndex {
  version: number;
  timestamp: number;
  items: NameIndexEntry[];
  npcs: NameIndexEntry[];
  objects: NameIndexEntry[];
  modelToEntities: [number, CrossRefEntry[]][];
  animationToEntities: [number, CrossRefEntry[]][];
  inventoryModelToItems: [number, CrossRefEntry[]][];
  scripts: ScriptIndexEntry[];
  varbits: VarbitIndexEntry[];
  varbitsByIndex: [number, number[]][];  // var_player index -> varbit IDs
  varbitScriptRefs: [number, VarbitScriptRef[]][];  // varbit ID -> script refs
  gamevals: GameValIndexEntry[];
  // Phase 5: Enhanced indexes for advanced filtering
  itemsAdvanced: ItemIndexEntry[];
  npcsAdvanced: NpcIndexEntry[];
  objectsAdvanced: ObjectIndexEntry[];
  // Phase 6: Interface index
  interfaces: InterfaceIndexEntry[];
  // Phase 6.5: Interface cross-reference indexes
  interfaceScriptRefs: [number, InterfaceScriptRef[]][];  // fullId -> refs
  interfaceVarbitRefs: [number, InterfaceVarbitRef[]][];  // fullId -> refs
  varbitInterfaceRefs: [number, InterfaceVarbitRef[]][];  // varbitId -> refs
  // Phase 7: Item variant index
  itemVariants: ItemVariantIndexEntry[];
  // Phase 8: Database indexes
  dbrowIndex: DBRowIndexEntry[];
  dbtableMetadata: [number, { rowCount: number; indexedCols: number[] }][];
  // Phase 7.5: Item sources index
  itemSourceIndex: [number, { npcDropRows: number[]; shopRows: number[] }][];
  // Phase 10: Sequence index
  sequences: SequenceIndexEntry[];
  // Spot anim reverse index: animationId → spotanim IDs
  spotAnimIndex: [number, number[]][];
}

export class CacheIndexer {
  private itemIndex: NameIndex | null = null;
  private npcIndex: NameIndex | null = null;
  private objectIndex: NameIndex | null = null;
  private crossRefIndex: CrossRefIndex | null = null;
  private scriptIndex: ScriptIndexEntry[] | null = null;
  private varbitIndex: VarbitIndexEntry[] | null = null;
  private varbitsByIndex: Map<number, number[]> | null = null;  // var_player index -> varbit IDs
  private varbitScriptRefs: Map<number, VarbitScriptRef[]> | null = null;  // varbit ID -> script refs
  private gamevalIndex: GameValIndexEntry[] | null = null;
  // Phase 5: Enhanced indexes for advanced filtering
  private itemAdvancedIndex: ItemIndexEntry[] | null = null;
  private npcAdvancedIndex: NpcIndexEntry[] | null = null;
  private objectAdvancedIndex: ObjectIndexEntry[] | null = null;
  // Phase 6: Interface index
  private interfaceIndex: InterfaceIndexEntry[] | null = null;
  // Phase 6.5: Interface cross-reference indexes
  private interfaceScriptRefs: Map<number, InterfaceScriptRef[]> | null = null;  // fullId -> refs
  private interfaceVarbitRefs: Map<number, InterfaceVarbitRef[]> | null = null;  // fullId -> refs
  private varbitInterfaceRefs: Map<number, InterfaceVarbitRef[]> | null = null;  // varbitId -> refs
  // Phase 7: Item variant index
  private itemVariantIndex: ItemVariantIndexEntry[] | null = null;
  // Phase 8: Database indexes
  private dbrowIndex: DBRowIndexEntry[] | null = null;
  private dbtableMetadata: Map<number, { rowCount: number; indexedCols: number[] }> | null = null;
  // Phase 7.5: Item sources index
  private itemSourceIndex: Map<number, { npcDropRows: number[]; shopRows: number[] }> | null = null;
  // Phase 10: Sequence index
  private sequenceIndex: SequenceIndexEntry[] | null = null;
  // Spot anim reverse index: animationId → spotanim IDs
  private spotAnimIndex: Map<number, number[]> | null = null;

  constructor(private cachePath: string) {}

  get isReady(): boolean {
    return this.itemIndex !== null && this.npcIndex !== null && this.objectIndex !== null &&
           this.scriptIndex !== null && this.varbitIndex !== null && this.gamevalIndex !== null &&
           this.itemAdvancedIndex !== null && this.npcAdvancedIndex !== null && this.objectAdvancedIndex !== null &&
           this.interfaceIndex !== null &&
           this.interfaceScriptRefs !== null && this.interfaceVarbitRefs !== null && this.varbitInterfaceRefs !== null &&
           this.itemVariantIndex !== null &&
           this.dbrowIndex !== null && this.dbtableMetadata !== null &&
           this.itemSourceIndex !== null &&
           this.sequenceIndex !== null &&
           this.spotAnimIndex !== null;
  }

  private get indexFilePath(): string {
    return path.join(this.cachePath, '.index-cache.json');
  }

  /**
   * Try to load indexes from disk cache
   */
  private async loadFromDisk(log: (msg: string) => void): Promise<boolean> {
    try {
      const content = await fs.readFile(this.indexFilePath, 'utf-8');
      const data: PersistedIndex = JSON.parse(content);

      // Check version
      if (data.version !== INDEX_VERSION) {
        log('[osrs-cache] Index cache version mismatch, rebuilding...');
        return false;
      }

      // Restore name indexes
      this.itemIndex = this.restoreNameIndex(data.items);
      this.npcIndex = this.restoreNameIndex(data.npcs);
      this.objectIndex = this.restoreNameIndex(data.objects);

      // Restore cross-ref indexes
      this.crossRefIndex = {
        modelToEntities: new Map(data.modelToEntities),
        animationToEntities: new Map(data.animationToEntities),
        inventoryModelToItems: new Map(data.inventoryModelToItems)
      };

      // Restore script index
      this.scriptIndex = data.scripts || [];

      // Restore varbit indexes
      this.varbitIndex = data.varbits || [];
      this.varbitsByIndex = new Map(data.varbitsByIndex || []);
      this.varbitScriptRefs = new Map(data.varbitScriptRefs || []);

      // Restore gameval index
      this.gamevalIndex = data.gamevals || [];

      // Restore Phase 5 advanced indexes
      this.itemAdvancedIndex = data.itemsAdvanced || [];
      this.npcAdvancedIndex = data.npcsAdvanced || [];
      this.objectAdvancedIndex = data.objectsAdvanced || [];

      // Restore Phase 6 interface index
      this.interfaceIndex = data.interfaces || [];

      // Restore Phase 6.5 interface cross-reference indexes
      this.interfaceScriptRefs = new Map(data.interfaceScriptRefs || []);
      this.interfaceVarbitRefs = new Map(data.interfaceVarbitRefs || []);
      this.varbitInterfaceRefs = new Map(data.varbitInterfaceRefs || []);

      // Restore Phase 7 item variant index
      this.itemVariantIndex = data.itemVariants || [];

      // Restore Phase 8 database indexes
      this.dbrowIndex = data.dbrowIndex || [];
      this.dbtableMetadata = new Map(data.dbtableMetadata || []);

      // Restore Phase 7.5 item sources index
      this.itemSourceIndex = new Map(data.itemSourceIndex || []);

      // Restore Phase 10 sequence index
      this.sequenceIndex = data.sequences || [];

      // Restore spot anim index
      this.spotAnimIndex = new Map(data.spotAnimIndex || []);

      log(`[osrs-cache] Loaded indexes from cache (${data.items.length} items, ${data.npcs.length} npcs, ${data.objects.length} objects, ${this.scriptIndex.length} scripts, ${this.varbitIndex.length} varbits, ${this.gamevalIndex.length} gamevals, ${this.interfaceIndex.length} interfaces, ${this.interfaceScriptRefs.size} interface script refs, ${this.itemVariantIndex.length} item variants, ${this.dbrowIndex.length} dbrows, ${this.itemSourceIndex.size} item sources, ${this.sequenceIndex.length} sequences)`);
      return true;
    } catch {
      return false;
    }
  }

  private restoreNameIndex(entries: NameIndexEntry[]): NameIndex {
    const index: NameIndex = {
      byNameLower: new Map(),
      entries: entries
    };
    for (const entry of entries) {
      index.byNameLower.set(entry.nameLower, entry.id);
    }
    return index;
  }

  /**
   * Save indexes to disk cache
   */
  private async saveToDisk(log: (msg: string) => void): Promise<void> {
    if (!this.itemIndex || !this.npcIndex || !this.objectIndex || !this.crossRefIndex ||
        !this.scriptIndex || !this.varbitIndex || !this.gamevalIndex ||
        !this.itemAdvancedIndex || !this.npcAdvancedIndex || !this.objectAdvancedIndex ||
        !this.interfaceIndex ||
        !this.interfaceScriptRefs || !this.interfaceVarbitRefs || !this.varbitInterfaceRefs ||
        !this.itemVariantIndex ||
        !this.dbrowIndex || !this.dbtableMetadata ||
        !this.itemSourceIndex ||
        !this.sequenceIndex ||
        !this.spotAnimIndex) {
      return;
    }

    const data: PersistedIndex = {
      version: INDEX_VERSION,
      timestamp: Date.now(),
      items: this.itemIndex.entries,
      npcs: this.npcIndex.entries,
      objects: this.objectIndex.entries,
      modelToEntities: [...this.crossRefIndex.modelToEntities.entries()],
      animationToEntities: [...this.crossRefIndex.animationToEntities.entries()],
      inventoryModelToItems: [...this.crossRefIndex.inventoryModelToItems.entries()],
      scripts: this.scriptIndex,
      varbits: this.varbitIndex,
      varbitsByIndex: [...(this.varbitsByIndex?.entries() || [])],
      varbitScriptRefs: [...(this.varbitScriptRefs?.entries() || [])],
      gamevals: this.gamevalIndex,
      // Phase 5: Advanced indexes
      itemsAdvanced: this.itemAdvancedIndex,
      npcsAdvanced: this.npcAdvancedIndex,
      objectsAdvanced: this.objectAdvancedIndex,
      // Phase 6: Interface index
      interfaces: this.interfaceIndex,
      // Phase 6.5: Interface cross-reference indexes
      interfaceScriptRefs: [...this.interfaceScriptRefs.entries()],
      interfaceVarbitRefs: [...this.interfaceVarbitRefs.entries()],
      varbitInterfaceRefs: [...this.varbitInterfaceRefs.entries()],
      // Phase 7: Item variant index
      itemVariants: this.itemVariantIndex,
      // Phase 8: Database indexes
      dbrowIndex: this.dbrowIndex,
      dbtableMetadata: [...this.dbtableMetadata.entries()],
      // Phase 7.5: Item sources index
      itemSourceIndex: [...this.itemSourceIndex.entries()],
      // Phase 10: Sequence index
      sequences: this.sequenceIndex,
      // Spot anim index
      spotAnimIndex: [...this.spotAnimIndex!.entries()]
    };

    try {
      await fs.writeFile(this.indexFilePath, JSON.stringify(data));
      log('[osrs-cache] Saved indexes to cache');
    } catch (err) {
      log(`[osrs-cache] Failed to save index cache: ${err}`);
    }
  }

  /**
   * Build all indexes on startup
   */
  async buildIndexes(quiet = false): Promise<void> {
    const log = (msg: string) => { if (!quiet) console.error(msg); };

    // Try loading from disk cache first
    if (await this.loadFromDisk(log)) {
      return;
    }

    log('[osrs-cache] Building name indexes...');

    // Build name indexes in parallel
    const [items, npcs, objects] = await Promise.all([
      this.buildNameIndex('item_defs'),
      this.buildNameIndex('npc_defs'),
      this.buildNameIndex('object_defs')
    ]);

    this.itemIndex = items;
    this.npcIndex = npcs;
    this.objectIndex = objects;

    log(
      `[osrs-cache] Name indexes built: ${items.entries.length} items, ${npcs.entries.length} npcs, ${objects.entries.length} objects`
    );

    // Build cross-reference indexes
    log('[osrs-cache] Building cross-reference indexes...');
    this.crossRefIndex = await this.buildCrossRefIndex();
    log(
      `[osrs-cache] Cross-ref indexes built: ${this.crossRefIndex.modelToEntities.size} models, ${this.crossRefIndex.animationToEntities.size} animations`
    );

    // Build script index
    log('[osrs-cache] Building script index...');
    this.scriptIndex = await this.buildScriptIndex();
    log(`[osrs-cache] Script index built: ${this.scriptIndex.length} scripts`);

    // Build varbit index
    log('[osrs-cache] Building varbit index...');
    const varbitResult = await this.buildVarbitIndex();
    this.varbitIndex = varbitResult.entries;
    this.varbitsByIndex = varbitResult.byIndex;
    log(`[osrs-cache] Varbit index built: ${this.varbitIndex.length} varbits, ${this.varbitsByIndex.size} unique var_player indexes`);

    // Build varbit cross-references from scripts
    log('[osrs-cache] Building varbit cross-references...');
    this.varbitScriptRefs = this.buildVarbitScriptRefs();
    log(`[osrs-cache] Varbit cross-refs built: ${this.varbitScriptRefs.size} varbits with script refs`);

    // Build gameval index
    log('[osrs-cache] Building gameval index...');
    this.gamevalIndex = await this.buildGameValIndex();
    log(`[osrs-cache] Gameval index built: ${this.gamevalIndex.length} gamevals`);

    // Phase 5: Build advanced indexes for filtering
    log('[osrs-cache] Building advanced item index...');
    this.itemAdvancedIndex = await this.buildItemAdvancedIndex();
    log(`[osrs-cache] Advanced item index built: ${this.itemAdvancedIndex.length} items`);

    log('[osrs-cache] Building advanced NPC index...');
    this.npcAdvancedIndex = await this.buildNpcAdvancedIndex();
    log(`[osrs-cache] Advanced NPC index built: ${this.npcAdvancedIndex.length} npcs`);

    log('[osrs-cache] Building advanced object index...');
    this.objectAdvancedIndex = await this.buildObjectAdvancedIndex();
    log(`[osrs-cache] Advanced object index built: ${this.objectAdvancedIndex.length} objects`);

    // Phase 6: Build interface index
    log('[osrs-cache] Building interface index...');
    this.interfaceIndex = await this.buildInterfaceIndex();
    log(`[osrs-cache] Interface index built: ${this.interfaceIndex.length} interfaces`);

    // Phase 6.5: Build interface cross-reference indexes
    log('[osrs-cache] Building interface-script cross-references...');
    this.interfaceScriptRefs = this.buildInterfaceScriptRefs();
    log(`[osrs-cache] Interface-script cross-refs built: ${this.interfaceScriptRefs.size} interfaces with script refs`);

    log('[osrs-cache] Building interface-varbit cross-references...');
    const varbitRefResult = await this.buildInterfaceVarbitRefs();
    this.interfaceVarbitRefs = varbitRefResult.byInterface;
    this.varbitInterfaceRefs = varbitRefResult.byVarbit;
    log(`[osrs-cache] Interface-varbit cross-refs built: ${this.interfaceVarbitRefs.size} interfaces with varbit refs, ${this.varbitInterfaceRefs.size} varbits with interface refs`);

    // Phase 7: Build item variant index
    log('[osrs-cache] Building item variant index...');
    this.itemVariantIndex = await this.buildItemVariantIndex();
    log(`[osrs-cache] Item variant index built: ${this.itemVariantIndex.length} items`);

    // Phase 8: Build database indexes
    log('[osrs-cache] Building dbrow search index...');
    this.dbrowIndex = await this.buildDBRowIndex();
    log(`[osrs-cache] DBRow index built: ${this.dbrowIndex.length} rows`);

    log('[osrs-cache] Building dbtable metadata index...');
    this.dbtableMetadata = await this.buildDBTableMetadata();
    log(`[osrs-cache] DBTable metadata built: ${this.dbtableMetadata.size} tables`);

    // Phase 7.5: Build item sources index
    log('[osrs-cache] Building item sources index...');
    this.itemSourceIndex = await this.buildItemSourceIndex();
    log(`[osrs-cache] Item sources index built: ${this.itemSourceIndex.size} items with sources`);

    // Phase 10: Build sequence index
    log('[osrs-cache] Building sequence index...');
    this.sequenceIndex = await this.buildSequenceIndex();
    log(`[osrs-cache] Sequence index built: ${this.sequenceIndex.length} sequences`);

    // Build spot anim reverse index
    log('[osrs-cache] Building spot anim index...');
    this.spotAnimIndex = await this.buildSpotAnimIndex();
    log(`[osrs-cache] Spot anim index built: ${this.spotAnimIndex.size} animations with spot anims`);

    // Save to disk for next time
    await this.saveToDisk(log);
  }

  /**
   * Build a name index for a cache directory
   */
  private async buildNameIndex(dir: string): Promise<NameIndex> {
    const index: NameIndex = {
      byNameLower: new Map(),
      entries: []
    };

    const dirPath = path.join(this.cachePath, dir);
    let files: string[];

    try {
      files = await fs.readdir(dirPath);
    } catch {
      return index;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Process in batches for performance
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          const id = parseInt(file.replace('.json', ''));
          try {
            const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
            const data = JSON.parse(content);
            return { id, name: data.name as string | null };
          } catch {
            return { id, name: null };
          }
        })
      );

      for (const { id, name } of results) {
        if (name && name !== 'null' && name.trim()) {
          const nameLower = name.toLowerCase();
          index.byNameLower.set(nameLower, id);
          index.entries.push({ id, name, nameLower });
        }
      }
    }

    return index;
  }

  /**
   * Build cross-reference indexes for models and animations
   */
  private async buildCrossRefIndex(): Promise<CrossRefIndex> {
    const index: CrossRefIndex = {
      modelToEntities: new Map(),
      animationToEntities: new Map(),
      inventoryModelToItems: new Map()
    };

    // Index items
    const itemsDir = path.join(this.cachePath, 'item_defs');
    try {
      const files = await fs.readdir(itemsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batch = jsonFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (file) => {
            try {
              const content = await fs.readFile(path.join(itemsDir, file), 'utf-8');
              const item = JSON.parse(content) as ItemDef;
              const entry: CrossRefEntry = { id: item.id, name: item.name || 'Unknown', type: 'item' };

              // Index inventory model
              if (item.inventoryModel && item.inventoryModel > 0) {
                this.addToCrossRef(index.inventoryModelToItems, item.inventoryModel, entry);
                this.addToCrossRef(index.modelToEntities, item.inventoryModel, entry);
              }

              // Index worn models
              for (const modelKey of ['maleModel0', 'maleModel1', 'femaleModel0', 'femaleModel1']) {
                const modelId = item[modelKey as keyof ItemDef] as number;
                if (modelId && modelId > 0) {
                  this.addToCrossRef(index.modelToEntities, modelId, entry);
                }
              }
            } catch {
              // Skip invalid files
            }
          })
        );
      }
    } catch {
      // Directory doesn't exist
    }

    // Index NPCs
    const npcsDir = path.join(this.cachePath, 'npc_defs');
    try {
      const files = await fs.readdir(npcsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batch = jsonFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (file) => {
            try {
              const content = await fs.readFile(path.join(npcsDir, file), 'utf-8');
              const npc = JSON.parse(content) as NpcDef;
              const entry: CrossRefEntry = { id: npc.id, name: npc.name || 'Unknown', type: 'npc' };

              // Index models
              if (npc.models) {
                for (const modelId of npc.models) {
                  if (modelId > 0) {
                    this.addToCrossRef(index.modelToEntities, modelId, entry);
                  }
                }
              }

              // Index animations (all 15 NPC animation fields)
              for (const animKey of [
                'standingAnimation', 'walkingAnimation', 'runAnimation',
                'rotate180Animation', 'rotateLeftAnimation', 'rotateRightAnimation',
                'idleRotateLeftAnimation', 'idleRotateRightAnimation',
                'runRotate180Animation', 'runRotateLeftAnimation', 'runRotateRightAnimation',
                'crawlAnimation', 'crawlRotate180Animation', 'crawlRotateLeftAnimation', 'crawlRotateRightAnimation'
              ]) {
                const animId = npc[animKey as keyof NpcDef] as number;
                if (animId && animId > 0) {
                  this.addToCrossRef(index.animationToEntities, animId, entry);
                }
              }
            } catch {
              // Skip invalid files
            }
          })
        );
      }
    } catch {
      // Directory doesn't exist
    }

    // Index Objects
    const objectsDir = path.join(this.cachePath, 'object_defs');
    try {
      const files = await fs.readdir(objectsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batch = jsonFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (file) => {
            try {
              const content = await fs.readFile(path.join(objectsDir, file), 'utf-8');
              const obj = JSON.parse(content) as ObjectDef;
              const entry: CrossRefEntry = { id: obj.id, name: obj.name || 'Unknown', type: 'object' };

              // Index models
              if (obj.models) {
                for (const modelId of obj.models) {
                  if (modelId > 0) {
                    this.addToCrossRef(index.modelToEntities, modelId, entry);
                  }
                }
              }

              // Index animation
              if (obj.animationID && obj.animationID > 0) {
                this.addToCrossRef(index.animationToEntities, obj.animationID, entry);
              }
            } catch {
              // Skip invalid files
            }
          })
        );
      }
    } catch {
      // Directory doesn't exist
    }

    return index;
  }

  private addToCrossRef(map: Map<number, CrossRefEntry[]>, key: number, entry: CrossRefEntry): void {
    const existing = map.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }

  /**
   * Build script content index for full-text search
   */
  private async buildScriptIndex(): Promise<ScriptIndexEntry[]> {
    const entries: ScriptIndexEntry[] = [];
    const dirPath = path.join(this.cachePath, 'rs2asm');

    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      return entries;
    }

    const scriptFiles = files.filter(f => f.endsWith('.rs2asm'));

    // Process in batches for performance
    for (let i = 0; i < scriptFiles.length; i += BATCH_SIZE) {
      const batch = scriptFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          const id = parseInt(file.replace('.rs2asm', ''));
          try {
            const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
            const { intArgCount, objArgCount } = this.parseScriptHeader(content);
            return {
              id,
              content,
              contentLower: content.toLowerCase(),
              intArgCount,
              objArgCount
            };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (result) {
          entries.push(result);
        }
      }
    }

    return entries;
  }

  /**
   * Parse script header to extract argument counts
   */
  private parseScriptHeader(content: string): { intArgCount: number; objArgCount: number } {
    let intArgCount = 0;
    let objArgCount = 0;

    const lines = content.split('\n');
    for (const line of lines.slice(0, 5)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('.int_arg_count')) {
        intArgCount = parseInt(trimmed.split(/\s+/)[1]) || 0;
      } else if (trimmed.startsWith('.obj_arg_count')) {
        objArgCount = parseInt(trimmed.split(/\s+/)[1]) || 0;
      }
    }

    return { intArgCount, objArgCount };
  }

  /**
   * Build varbit index with lookup by var_player index
   */
  private async buildVarbitIndex(): Promise<{ entries: VarbitIndexEntry[]; byIndex: Map<number, number[]> }> {
    const entries: VarbitIndexEntry[] = [];
    const byIndex = new Map<number, number[]>();
    const dirPath = path.join(this.cachePath, 'var_bits');

    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      return { entries, byIndex };
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Process in batches for performance
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          const id = parseInt(file.replace('.json', ''));
          try {
            const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
            const data = JSON.parse(content);
            return {
              id,
              index: data.index as number,
              lsb: data.leastSignificantBit as number,
              msb: data.mostSignificantBit as number
            };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (result) {
          entries.push(result);
          // Add to byIndex map
          const existing = byIndex.get(result.index);
          if (existing) {
            existing.push(result.id);
          } else {
            byIndex.set(result.index, [result.id]);
          }
        }
      }
    }

    return { entries, byIndex };
  }

  /**
   * Build varbit cross-references from scripts (get_varbit/set_varbit usage)
   */
  private buildVarbitScriptRefs(): Map<number, VarbitScriptRef[]> {
    const refs = new Map<number, VarbitScriptRef[]>();

    if (!this.scriptIndex) return refs;

    // Patterns for varbit operations in RS2ASM
    const getVarbitPattern = /get_varbit\s+(\d+)/g;
    const setVarbitPattern = /set_varbit\s+(\d+)/g;

    for (const script of this.scriptIndex) {
      const lines = script.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Find get_varbit references
        let match;
        getVarbitPattern.lastIndex = 0;
        while ((match = getVarbitPattern.exec(line)) !== null) {
          const varbitId = parseInt(match[1]);
          const ref: VarbitScriptRef = {
            scriptId: script.id,
            lineNumber: i + 1,
            operation: 'get',
            matchLine: line.trim()
          };
          const existing = refs.get(varbitId);
          if (existing) {
            existing.push(ref);
          } else {
            refs.set(varbitId, [ref]);
          }
        }

        // Find set_varbit references
        setVarbitPattern.lastIndex = 0;
        while ((match = setVarbitPattern.exec(line)) !== null) {
          const varbitId = parseInt(match[1]);
          const ref: VarbitScriptRef = {
            scriptId: script.id,
            lineNumber: i + 1,
            operation: 'set',
            matchLine: line.trim()
          };
          const existing = refs.get(varbitId);
          if (existing) {
            existing.push(ref);
          } else {
            refs.set(varbitId, [ref]);
          }
        }
      }
    }

    return refs;
  }

  /**
   * Search items by name
   */
  searchItems(query: string, options: SearchOptions = {}): SearchResult[] {
    if (!this.itemIndex) return [];
    return this.searchIndex(this.itemIndex, query, options);
  }

  /**
   * Search NPCs by name
   */
  searchNpcs(query: string, options: SearchOptions = {}): SearchResult[] {
    if (!this.npcIndex) return [];
    return this.searchIndex(this.npcIndex, query, options);
  }

  /**
   * Search objects by name
   */
  searchObjects(query: string, options: SearchOptions = {}): SearchResult[] {
    if (!this.objectIndex) return [];
    return this.searchIndex(this.objectIndex, query, options);
  }

  private searchIndex(index: NameIndex, query: string, options: SearchOptions): SearchResult[] {
    const queryLower = query.toLowerCase();
    const limit = options.limit ?? 25;
    const results: SearchResult[] = [];

    // Exact match first
    if (options.exact) {
      const id = index.byNameLower.get(queryLower);
      if (id !== undefined) {
        const entry = index.entries.find(e => e.id === id);
        return entry ? [{ id: entry.id, name: entry.name }] : [];
      }
      return [];
    }

    // Partial match
    for (const entry of index.entries) {
      if (entry.nameLower.includes(queryLower)) {
        results.push({ id: entry.id, name: entry.name });
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Find entities by model ID
   */
  findByModel(modelId: number): CrossRefEntry[] {
    if (!this.crossRefIndex) return [];
    return this.crossRefIndex.modelToEntities.get(modelId) ?? [];
  }

  /**
   * Find entities by animation ID
   */
  findByAnimation(animationId: number): CrossRefEntry[] {
    if (!this.crossRefIndex) return [];
    return this.crossRefIndex.animationToEntities.get(animationId) ?? [];
  }

  /**
   * Find items by inventory model ID
   */
  findByInventoryModel(modelId: number): CrossRefEntry[] {
    if (!this.crossRefIndex) return [];
    return this.crossRefIndex.inventoryModelToItems.get(modelId) ?? [];
  }

  /**
   * Search scripts by content (opcodes, string literals, etc.)
   */
  searchScripts(query: string, options: SearchOptions = {}): ScriptSearchResult[] {
    if (!this.scriptIndex) return [];

    const queryLower = query.toLowerCase();
    const limit = options.limit ?? 25;
    const results: ScriptSearchResult[] = [];

    for (const entry of this.scriptIndex) {
      const lines = entry.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          results.push({
            id: entry.id,
            matchLine: lines[i].trim(),
            lineNumber: i + 1
          });
          break; // Only one match per script
        }
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Get all script IDs
   */
  listScriptIds(): number[] {
    if (!this.scriptIndex) return [];
    return this.scriptIndex.map(e => e.id).sort((a, b) => a - b);
  }

  /**
   * Get script count
   */
  getScriptCount(): number {
    return this.scriptIndex?.length ?? 0;
  }

  /**
   * Search varbits by ID or index
   * Query can be a varbit ID, var_player index, or bit range pattern
   */
  searchVarbits(query: string, options: SearchOptions = {}): VarbitSearchResult[] {
    if (!this.varbitIndex) return [];

    const limit = options.limit ?? 25;
    const results: VarbitSearchResult[] = [];
    const queryNum = parseInt(query);

    // If query is a number, search by ID or index
    if (!isNaN(queryNum)) {
      for (const entry of this.varbitIndex) {
        if (entry.id === queryNum || entry.index === queryNum) {
          results.push({
            id: entry.id,
            index: entry.index,
            bitRange: `${entry.lsb}-${entry.msb}`
          });
          if (results.length >= limit) break;
        }
      }
    } else {
      // Search by bit range pattern (e.g., "0-0" or "8-11")
      const queryLower = query.toLowerCase();
      for (const entry of this.varbitIndex) {
        const bitRange = `${entry.lsb}-${entry.msb}`;
        if (bitRange.includes(queryLower)) {
          results.push({
            id: entry.id,
            index: entry.index,
            bitRange
          });
          if (results.length >= limit) break;
        }
      }
    }

    return results;
  }

  /**
   * Find all varbits that share the same var_player index
   */
  findVarbitsByIndex(index: number): VarbitSearchResult[] {
    if (!this.varbitsByIndex || !this.varbitIndex) return [];

    const varbitIds = this.varbitsByIndex.get(index);
    if (!varbitIds) return [];

    const results: VarbitSearchResult[] = [];
    for (const id of varbitIds) {
      const entry = this.varbitIndex.find(e => e.id === id);
      if (entry) {
        results.push({
          id: entry.id,
          index: entry.index,
          bitRange: `${entry.lsb}-${entry.msb}`
        });
      }
    }

    // Sort by least significant bit
    return results.sort((a, b) => {
      const aLsb = parseInt(a.bitRange.split('-')[0]);
      const bLsb = parseInt(b.bitRange.split('-')[0]);
      return aLsb - bLsb;
    });
  }

  /**
   * Get script references for a varbit (which scripts get/set this varbit)
   */
  getVarbitScriptRefs(varbitId: number): VarbitScriptRef[] {
    if (!this.varbitScriptRefs) return [];
    return this.varbitScriptRefs.get(varbitId) ?? [];
  }

  /**
   * Get varbit count
   */
  getVarbitCount(): number {
    return this.varbitIndex?.length ?? 0;
  }

  /**
   * Get unique var_player index count (number of base vars with varbits)
   */
  getVarbitIndexCount(): number {
    return this.varbitsByIndex?.size ?? 0;
  }

  // ============================================
  // Game Values Methods
  // ============================================

  /**
   * Build gameval index for full-text search across all categories
   */
  private async buildGameValIndex(): Promise<GameValIndexEntry[]> {
    const entries: GameValIndexEntry[] = [];
    const gamevalsDir = path.join(this.cachePath, 'gamevals');

    let categoryDirs: string[];
    try {
      const dirs = await fs.readdir(gamevalsDir, { withFileTypes: true });
      categoryDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);
    } catch {
      return entries;
    }

    // Process each category
    for (const categoryDir of categoryDirs) {
      const category = parseInt(categoryDir);
      if (isNaN(category)) continue;

      const categoryPath = path.join(gamevalsDir, categoryDir);
      let files: string[];
      try {
        files = await fs.readdir(categoryPath);
      } catch {
        continue;
      }

      // Process in batches for performance
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (file) => {
            const id = parseInt(file);
            if (isNaN(id)) return null;
            try {
              const content = await fs.readFile(path.join(categoryPath, file), 'utf-8');
              const data = JSON.parse(content);
              const name = data.name as string;
              if (!name || name === 'null') return null;
              return {
                category,
                id,
                name,
                nameLower: name.toLowerCase(),
                hasFields: Object.keys(data.files || {}).length > 0
              };
            } catch {
              return null;
            }
          })
        );

        for (const result of results) {
          if (result) {
            entries.push(result);
          }
        }
      }
    }

    return entries;
  }

  /**
   * Search game values by name across all categories
   */
  searchGameVals(query: string, options: SearchOptions & { category?: number } = {}): GameValSearchResult[] {
    if (!this.gamevalIndex) return [];

    const queryLower = query.toLowerCase();
    const limit = options.limit ?? 25;
    const results: GameValSearchResult[] = [];

    for (const entry of this.gamevalIndex) {
      // Filter by category if specified
      if (options.category !== undefined && entry.category !== options.category) {
        continue;
      }

      // Match by name
      if (entry.nameLower.includes(queryLower)) {
        results.push({
          category: entry.category,
          categoryName: GAMEVAL_CATEGORIES[entry.category] || `unknown_${entry.category}`,
          id: entry.id,
          name: entry.name,
          hasFields: entry.hasFields
        });
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Get gameval count
   */
  getGameValCount(): number {
    return this.gamevalIndex?.length ?? 0;
  }

  /**
   * Get gameval count per category
   */
  getGameValCategoryCounts(): Map<number, number> {
    const counts = new Map<number, number>();
    if (!this.gamevalIndex) return counts;

    for (const entry of this.gamevalIndex) {
      const current = counts.get(entry.category) || 0;
      counts.set(entry.category, current + 1);
    }

    return counts;
  }

  // ============================================
  // Phase 5: Advanced Search Methods
  // ============================================

  /**
   * Build enhanced item index with all filterable fields
   */
  private async buildItemAdvancedIndex(): Promise<ItemIndexEntry[]> {
    const entries: ItemIndexEntry[] = [];
    const dirPath = path.join(this.cachePath, 'item_defs');

    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      return entries;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Process in batches for performance
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
            const item = JSON.parse(content) as ItemDef & {
              wearPos1?: number;
              params?: Record<string, number>;
            };

            // Skip items with null or empty names
            if (!item.name || item.name === 'null' || !item.name.trim()) {
              return null;
            }

            const params = item.params || {};

            return {
              id: item.id,
              name: item.name,
              nameLower: item.name.toLowerCase(),
              equipSlot: item.wearPos1 ?? -1,
              tradeable: item.isTradeable ?? false,
              members: (item as ItemDef & { members?: boolean }).members ?? false,
              cost: item.cost ?? 0,
              weight: item.weight ?? 0,
              stackable: item.stackable === 1,
              // Combat stats from params
              attackStab: params[ITEM_STAT_PARAMS.attackStab] ?? 0,
              attackSlash: params[ITEM_STAT_PARAMS.attackSlash] ?? 0,
              attackCrush: params[ITEM_STAT_PARAMS.attackCrush] ?? 0,
              attackMagic: params[ITEM_STAT_PARAMS.attackMagic] ?? 0,
              attackRanged: params[ITEM_STAT_PARAMS.attackRanged] ?? 0,
              defenceStab: params[ITEM_STAT_PARAMS.defenceStab] ?? 0,
              defenceSlash: params[ITEM_STAT_PARAMS.defenceSlash] ?? 0,
              defenceCrush: params[ITEM_STAT_PARAMS.defenceCrush] ?? 0,
              defenceMagic: params[ITEM_STAT_PARAMS.defenceMagic] ?? 0,
              defenceRanged: params[ITEM_STAT_PARAMS.defenceRanged] ?? 0,
              meleeStrength: params[ITEM_STAT_PARAMS.meleeStrength] ?? 0,
              rangedStrength: params[ITEM_STAT_PARAMS.rangedStrength] ?? 0,
              magicDamage: params[ITEM_STAT_PARAMS.magicDamage] ?? 0,
              prayer: params[ITEM_STAT_PARAMS.prayer] ?? 0
            };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (result) {
          entries.push(result);
        }
      }
    }

    return entries;
  }

  /**
   * Build enhanced NPC index with all filterable fields
   */
  private async buildNpcAdvancedIndex(): Promise<NpcIndexEntry[]> {
    const entries: NpcIndexEntry[] = [];
    const dirPath = path.join(this.cachePath, 'npc_defs');

    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      return entries;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Process in batches for performance
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
            const npc = JSON.parse(content) as NpcDef & {
              size?: number;
              isInteractable?: boolean;
            };

            // Skip NPCs with null or empty names
            if (!npc.name || npc.name === 'null' || !npc.name.trim()) {
              return null;
            }

            // Extract non-null actions
            const actions: string[] = [];
            if (npc.actions) {
              for (const action of npc.actions) {
                if (action && action !== 'null') {
                  actions.push(action);
                }
              }
            }

            return {
              id: npc.id,
              name: npc.name,
              nameLower: npc.name.toLowerCase(),
              combatLevel: npc.combatLevel ?? 0,
              actions,
              size: npc.size ?? 1,
              interactable: npc.isInteractable ?? true
            };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (result) {
          entries.push(result);
        }
      }
    }

    return entries;
  }

  /**
   * Build enhanced object index with all filterable fields
   */
  private async buildObjectAdvancedIndex(): Promise<ObjectIndexEntry[]> {
    const entries: ObjectIndexEntry[] = [];
    const dirPath = path.join(this.cachePath, 'object_defs');

    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      return entries;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Process in batches for performance
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
            const obj = JSON.parse(content) as ObjectDef & {
              interactType?: number;
              blocksProjectile?: boolean;
              sizeX?: number;
              sizeY?: number;
            };

            // Skip objects with null or empty names
            if (!obj.name || obj.name === 'null' || !obj.name.trim()) {
              return null;
            }

            // Extract non-null actions
            const actions: string[] = [];
            if (obj.actions) {
              for (const action of obj.actions) {
                if (action && action !== 'null') {
                  actions.push(action);
                }
              }
            }

            return {
              id: obj.id,
              name: obj.name,
              nameLower: obj.name.toLowerCase(),
              actions,
              interactType: obj.interactType ?? 0,
              blocksProjectile: obj.blocksProjectile ?? false,
              sizeX: obj.sizeX ?? 1,
              sizeY: obj.sizeY ?? 1
            };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (result) {
          entries.push(result);
        }
      }
    }

    return entries;
  }

  /**
   * Advanced item search with filters
   */
  searchItemsAdvanced(
    filter: ItemAdvancedFilter,
    options: { offset?: number; limit?: number } = {}
  ): AdvancedSearchResult<ItemAdvancedResult> {
    if (!this.itemAdvancedIndex) {
      return { results: [], totalCount: 0, offset: 0, limit: 25 };
    }

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 25;
    const nameLower = filter.name?.toLowerCase();
    const equipSlotNum = filter.equipSlot ? SLOT_TO_WEARPOS[filter.equipSlot.toLowerCase()] : undefined;

    // Filter the index
    const filtered: ItemIndexEntry[] = [];

    for (const item of this.itemAdvancedIndex) {
      // Name filter
      if (nameLower && !item.nameLower.includes(nameLower)) continue;

      // Equipment slot filter
      if (equipSlotNum !== undefined && item.equipSlot !== equipSlotNum) continue;

      // Boolean filters
      if (filter.tradeable !== undefined && item.tradeable !== filter.tradeable) continue;
      if (filter.members !== undefined && item.members !== filter.members) continue;
      if (filter.stackable !== undefined && item.stackable !== filter.stackable) continue;

      // Range filters
      if (filter.minValue !== undefined && item.cost < filter.minValue) continue;
      if (filter.maxValue !== undefined && item.cost > filter.maxValue) continue;
      if (filter.minWeight !== undefined && item.weight < filter.minWeight) continue;
      if (filter.maxWeight !== undefined && item.weight > filter.maxWeight) continue;

      // Stat filters
      if (filter.minAttackStab !== undefined && item.attackStab < filter.minAttackStab) continue;
      if (filter.minAttackSlash !== undefined && item.attackSlash < filter.minAttackSlash) continue;
      if (filter.minAttackCrush !== undefined && item.attackCrush < filter.minAttackCrush) continue;
      if (filter.minAttackMagic !== undefined && item.attackMagic < filter.minAttackMagic) continue;
      if (filter.minAttackRanged !== undefined && item.attackRanged < filter.minAttackRanged) continue;
      if (filter.minDefenceStab !== undefined && item.defenceStab < filter.minDefenceStab) continue;
      if (filter.minDefenceSlash !== undefined && item.defenceSlash < filter.minDefenceSlash) continue;
      if (filter.minDefenceCrush !== undefined && item.defenceCrush < filter.minDefenceCrush) continue;
      if (filter.minDefenceMagic !== undefined && item.defenceMagic < filter.minDefenceMagic) continue;
      if (filter.minDefenceRanged !== undefined && item.defenceRanged < filter.minDefenceRanged) continue;
      if (filter.minMeleeStrength !== undefined && item.meleeStrength < filter.minMeleeStrength) continue;
      if (filter.minRangedStrength !== undefined && item.rangedStrength < filter.minRangedStrength) continue;
      if (filter.minMagicDamage !== undefined && item.magicDamage < filter.minMagicDamage) continue;
      if (filter.minPrayer !== undefined && item.prayer < filter.minPrayer) continue;

      filtered.push(item);
    }

    // Apply pagination
    const totalCount = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    // Convert to result format
    const results: ItemAdvancedResult[] = paged.map(item => ({
      id: item.id,
      name: item.name,
      equipSlot: item.equipSlot >= 0 ? (EQUIPMENT_SLOTS[item.equipSlot] || null) : null,
      tradeable: item.tradeable,
      members: item.members,
      cost: item.cost,
      weight: item.weight
    }));

    return { results, totalCount, offset, limit };
  }

  /**
   * Advanced NPC search with filters
   */
  searchNpcsAdvanced(
    filter: NpcAdvancedFilter,
    options: { offset?: number; limit?: number } = {}
  ): AdvancedSearchResult<NpcAdvancedResult> {
    if (!this.npcAdvancedIndex) {
      return { results: [], totalCount: 0, offset: 0, limit: 25 };
    }

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 25;
    const nameLower = filter.name?.toLowerCase();
    const actionLower = filter.hasAction?.toLowerCase();

    // Filter the index
    const filtered: NpcIndexEntry[] = [];

    for (const npc of this.npcAdvancedIndex) {
      // Name filter
      if (nameLower && !npc.nameLower.includes(nameLower)) continue;

      // Combat level range
      if (filter.minCombatLevel !== undefined && npc.combatLevel < filter.minCombatLevel) continue;
      if (filter.maxCombatLevel !== undefined && npc.combatLevel > filter.maxCombatLevel) continue;

      // Has action filter
      if (actionLower) {
        const hasAction = npc.actions.some(a => a.toLowerCase().includes(actionLower));
        if (!hasAction) continue;
      }

      // Attackable filter (has "Attack" action)
      if (filter.attackable !== undefined) {
        const isAttackable = npc.actions.some(a => a.toLowerCase() === 'attack');
        if (filter.attackable !== isAttackable) continue;
      }

      // Size filter
      if (filter.size !== undefined && npc.size !== filter.size) continue;

      // Interactable filter
      if (filter.interactable !== undefined && npc.interactable !== filter.interactable) continue;

      filtered.push(npc);
    }

    // Apply pagination
    const totalCount = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    // Convert to result format
    const results: NpcAdvancedResult[] = paged.map(npc => ({
      id: npc.id,
      name: npc.name,
      combatLevel: npc.combatLevel,
      actions: npc.actions,
      size: npc.size
    }));

    return { results, totalCount, offset, limit };
  }

  /**
   * Advanced object search with filters
   */
  searchObjectsAdvanced(
    filter: ObjectAdvancedFilter,
    options: { offset?: number; limit?: number } = {}
  ): AdvancedSearchResult<ObjectAdvancedResult> {
    if (!this.objectAdvancedIndex) {
      return { results: [], totalCount: 0, offset: 0, limit: 25 };
    }

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 25;
    const nameLower = filter.name?.toLowerCase();
    const actionLower = filter.hasAction?.toLowerCase();

    // Filter the index
    const filtered: ObjectIndexEntry[] = [];

    for (const obj of this.objectAdvancedIndex) {
      // Name filter
      if (nameLower && !obj.nameLower.includes(nameLower)) continue;

      // Has action filter
      if (actionLower) {
        const hasAction = obj.actions.some(a => a.toLowerCase().includes(actionLower));
        if (!hasAction) continue;
      }

      // Blocks projectile filter
      if (filter.blocksProjectile !== undefined && obj.blocksProjectile !== filter.blocksProjectile) continue;

      // Interactable filter (interactType > 0)
      if (filter.interactable !== undefined) {
        const isInteractable = obj.interactType > 0;
        if (filter.interactable !== isInteractable) continue;
      }

      // Size filters
      if (filter.minSizeX !== undefined && obj.sizeX < filter.minSizeX) continue;
      if (filter.maxSizeX !== undefined && obj.sizeX > filter.maxSizeX) continue;
      if (filter.minSizeY !== undefined && obj.sizeY < filter.minSizeY) continue;
      if (filter.maxSizeY !== undefined && obj.sizeY > filter.maxSizeY) continue;

      filtered.push(obj);
    }

    // Apply pagination
    const totalCount = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    // Convert to result format
    const results: ObjectAdvancedResult[] = paged.map(obj => ({
      id: obj.id,
      name: obj.name,
      actions: obj.actions,
      interactable: obj.interactType > 0,
      sizeX: obj.sizeX,
      sizeY: obj.sizeY
    }));

    return { results, totalCount, offset, limit };
  }

  /**
   * Get advanced item index count
   */
  getItemAdvancedCount(): number {
    return this.itemAdvancedIndex?.length ?? 0;
  }

  /**
   * Get advanced NPC index count
   */
  getNpcAdvancedCount(): number {
    return this.npcAdvancedIndex?.length ?? 0;
  }

  /**
   * Get advanced object index count
   */
  getObjectAdvancedCount(): number {
    return this.objectAdvancedIndex?.length ?? 0;
  }

  // ============================================
  // Phase 6: Interface Methods
  // ============================================

  /**
   * Build interface index for text and action search
   */
  private async buildInterfaceIndex(): Promise<InterfaceIndexEntry[]> {
    const entries: InterfaceIndexEntry[] = [];
    const interfaceDir = path.join(this.cachePath, 'interface_defs');

    let parentDirs: string[];
    try {
      const dirs = await fs.readdir(interfaceDir, { withFileTypes: true });
      parentDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);
    } catch {
      return entries;
    }

    // Process each parent directory
    for (const parentDir of parentDirs) {
      const parentId = parseInt(parentDir);
      if (isNaN(parentId)) continue;

      const parentPath = path.join(interfaceDir, parentDir);
      let files: string[];
      try {
        files = await fs.readdir(parentPath);
      } catch {
        continue;
      }

      const jsonFiles = files.filter(f => f.endsWith('.json'));

      // Process in batches for performance
      for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batch = jsonFiles.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (file) => {
            const childId = parseInt(file.replace('.json', ''));
            if (isNaN(childId)) return null;
            try {
              const content = await fs.readFile(path.join(parentPath, file), 'utf-8');
              const data = JSON.parse(content);

              // Extract text
              const text = (data.text as string) || '';

              // Extract non-null actions
              const actions: string[] = [];
              if (data.actions && Array.isArray(data.actions)) {
                for (const action of data.actions) {
                  if (action && typeof action === 'string' && action.length > 0 && action !== '*') {
                    actions.push(action);
                  }
                }
              }

              return {
                parentId,
                childId,
                fullId: parentId * 65536 + childId,
                type: (data.type as number) ?? 0,
                text,
                textLower: text.toLowerCase(),
                actions,
                spriteId: (data.spriteId as number) ?? -1,
                modelId: (data.modelId as number) ?? -1,
                hasListener: (data.hasListener as boolean) ?? false
              };
            } catch {
              return null;
            }
          })
        );

        for (const result of results) {
          if (result) {
            entries.push(result);
          }
        }
      }
    }

    return entries;
  }

  /**
   * Search interfaces by text content
   */
  searchInterfaces(query: string, options: SearchOptions & { type?: number; hasAction?: boolean } = {}): InterfaceSearchResult[] {
    if (!this.interfaceIndex) return [];

    const queryLower = query.toLowerCase();
    const limit = options.limit ?? 25;
    const results: InterfaceSearchResult[] = [];

    for (const entry of this.interfaceIndex) {
      // Filter by type if specified
      if (options.type !== undefined && entry.type !== options.type) {
        continue;
      }

      // Filter by has action if specified
      if (options.hasAction !== undefined) {
        const hasActions = entry.actions.length > 0;
        if (options.hasAction !== hasActions) continue;
      }

      // Match by text
      if (entry.textLower.includes(queryLower)) {
        results.push({
          parentId: entry.parentId,
          childId: entry.childId,
          type: entry.type,
          typeName: INTERFACE_TYPES[entry.type] || `type_${entry.type}`,
          text: entry.text,
          actions: entry.actions
        });
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Find interfaces with a specific action
   */
  findInterfacesByAction(action: string, limit = 25): InterfaceSearchResult[] {
    if (!this.interfaceIndex) return [];

    const actionLower = action.toLowerCase();
    const results: InterfaceSearchResult[] = [];

    for (const entry of this.interfaceIndex) {
      // Check if any action matches
      const hasAction = entry.actions.some(a => a.toLowerCase().includes(actionLower));
      if (hasAction) {
        results.push({
          parentId: entry.parentId,
          childId: entry.childId,
          type: entry.type,
          typeName: INTERFACE_TYPES[entry.type] || `type_${entry.type}`,
          text: entry.text,
          actions: entry.actions
        });
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Get interface index count
   */
  getInterfaceCount(): number {
    return this.interfaceIndex?.length ?? 0;
  }

  // ============================================
  // Phase 6.5: Interface Cross-Reference Methods
  // ============================================

  /**
   * Build interface script cross-references from scripts
   * Scans for iconst followed by interface opcodes (if_*, cc_*)
   */
  private buildInterfaceScriptRefs(): Map<number, InterfaceScriptRef[]> {
    const refs = new Map<number, InterfaceScriptRef[]>();

    if (!this.scriptIndex) return refs;

    // Interface opcodes that take a fullId as parameter
    const interfaceOpcodes = new Set([
      'if_find', 'if_settext', 'if_sethide', 'if_setgraphic', 'if_setposition',
      'if_setcolour', 'if_setmodel', 'if_setsize', 'if_setop', 'if_setanim',
      'if_setobject', 'if_setnpchead', 'if_setplayerhead', 'if_setscrollpos',
      'if_settextfont', 'if_setalpha', 'if_getwidth', 'if_getheight', 'if_getscrollx',
      'if_getscrolly', 'if_gettext', 'if_getx', 'if_gety',
      'cc_find', 'cc_create', 'cc_delete', 'cc_deleteall'
    ]);

    for (const script of this.scriptIndex) {
      const lines = script.content.split('\n');

      for (let i = 0; i < lines.length - 1; i++) {
        const currentLine = lines[i].trim();
        const nextLine = lines[i + 1].trim();

        // Match iconst with a number
        const iconMatch = currentLine.match(/^iconst\s+(\d+)$/);
        if (!iconMatch) continue;

        const fullId = parseInt(iconMatch[1]);

        // Check if next line is an interface opcode
        const opcodeMatch = nextLine.match(/^(\w+)/);
        if (!opcodeMatch) continue;

        const opcode = opcodeMatch[1];
        if (!interfaceOpcodes.has(opcode)) continue;

        // Validate fullId as a reasonable interface ID
        // parent ID should be 0-999 (max observed), child ID 0-65535
        const parentId = Math.floor(fullId / 65536);
        const childId = fullId % 65536;

        // Skip if parent is too large (likely just a regular number, not an interface)
        if (parentId > 999 || parentId < 0) continue;

        const ref: InterfaceScriptRef = {
          scriptId: script.id,
          lineNumber: i + 2, // +2 because: 1-based indexing + opcode is on next line
          opcode,
          matchLine: nextLine,
          fullId,
          parentId,
          childId
        };

        const existing = refs.get(fullId);
        if (existing) {
          existing.push(ref);
        } else {
          refs.set(fullId, [ref]);
        }
      }
    }

    return refs;
  }

  /**
   * Build interface varbit cross-references
   * Scans interface definitions for varTransmitTriggers and clientScripts with VARBIT opcodes
   */
  private async buildInterfaceVarbitRefs(): Promise<{
    byInterface: Map<number, InterfaceVarbitRef[]>;
    byVarbit: Map<number, InterfaceVarbitRef[]>;
  }> {
    const byInterface = new Map<number, InterfaceVarbitRef[]>();
    const byVarbit = new Map<number, InterfaceVarbitRef[]>();

    const interfaceDir = path.join(this.cachePath, 'interface_defs');

    let parentDirs: string[];
    try {
      const dirs = await fs.readdir(interfaceDir, { withFileTypes: true });
      parentDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);
    } catch {
      return { byInterface, byVarbit };
    }

    // Process each parent directory
    for (const parentDir of parentDirs) {
      const parentId = parseInt(parentDir);
      if (isNaN(parentId)) continue;

      const parentPath = path.join(interfaceDir, parentDir);
      let files: string[];
      try {
        files = await fs.readdir(parentPath);
      } catch {
        continue;
      }

      const jsonFiles = files.filter(f => f.endsWith('.json'));

      // Process in batches for performance
      for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batch = jsonFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (file) => {
            const childId = parseInt(file.replace('.json', ''));
            if (isNaN(childId)) return;

            try {
              const content = await fs.readFile(path.join(parentPath, file), 'utf-8');
              const data = JSON.parse(content);
              const fullId = parentId * 65536 + childId;

              // Check varTransmitTriggers
              if (data.varTransmitTriggers && Array.isArray(data.varTransmitTriggers)) {
                for (const varbitId of data.varTransmitTriggers) {
                  if (typeof varbitId !== 'number' || varbitId < 0) continue;

                  const ref: InterfaceVarbitRef = {
                    parentId,
                    childId,
                    fullId,
                    fieldName: 'varTransmitTriggers',
                    varbitId
                  };

                  // Add to byInterface map
                  const existingByInterface = byInterface.get(fullId);
                  if (existingByInterface) {
                    existingByInterface.push(ref);
                  } else {
                    byInterface.set(fullId, [ref]);
                  }

                  // Add to byVarbit map
                  const existingByVarbit = byVarbit.get(varbitId);
                  if (existingByVarbit) {
                    existingByVarbit.push(ref);
                  } else {
                    byVarbit.set(varbitId, [ref]);
                  }
                }
              }

              // Check clientScripts for VARBIT opcodes
              if (data.clientScripts && Array.isArray(data.clientScripts)) {
                for (const scriptArray of data.clientScripts) {
                  if (!Array.isArray(scriptArray)) continue;
                  for (const op of scriptArray) {
                    if (op && op.opcode === 'VARBIT' && op.operands && Array.isArray(op.operands)) {
                      for (const varbitId of op.operands) {
                        if (typeof varbitId !== 'number' || varbitId < 0) continue;

                        const ref: InterfaceVarbitRef = {
                          parentId,
                          childId,
                          fullId,
                          fieldName: 'clientScripts',
                          varbitId
                        };

                        // Add to byInterface map
                        const existingByInterface = byInterface.get(fullId);
                        if (existingByInterface) {
                          existingByInterface.push(ref);
                        } else {
                          byInterface.set(fullId, [ref]);
                        }

                        // Add to byVarbit map
                        const existingByVarbit = byVarbit.get(varbitId);
                        if (existingByVarbit) {
                          existingByVarbit.push(ref);
                        } else {
                          byVarbit.set(varbitId, [ref]);
                        }
                      }
                    }
                  }
                }
              }
            } catch {
              // Skip invalid files
            }
          })
        );
      }
    }

    return { byInterface, byVarbit };
  }

  /**
   * Get scripts that reference a specific interface widget
   */
  getInterfaceScriptRefs(parentId: number, childId: number): InterfaceScriptRef[] {
    if (!this.interfaceScriptRefs) return [];
    const fullId = parentId * 65536 + childId;
    return this.interfaceScriptRefs.get(fullId) ?? [];
  }

  /**
   * Get varbits referenced by a specific interface widget
   */
  getInterfaceVarbitRefs(parentId: number, childId: number): InterfaceVarbitRef[] {
    if (!this.interfaceVarbitRefs) return [];
    const fullId = parentId * 65536 + childId;
    return this.interfaceVarbitRefs.get(fullId) ?? [];
  }

  /**
   * Get interfaces that reference a specific varbit
   */
  getVarbitInterfaceRefs(varbitId: number): InterfaceVarbitRef[] {
    if (!this.varbitInterfaceRefs) return [];
    return this.varbitInterfaceRefs.get(varbitId) ?? [];
  }

  // ============================================
  // Phase 7: Relationship & Analysis Methods
  // ============================================

  /**
   * Build item variant index with noted/placeholder/bought relationships
   */
  private async buildItemVariantIndex(): Promise<ItemVariantIndexEntry[]> {
    const entries: ItemVariantIndexEntry[] = [];
    const dirPath = path.join(this.cachePath, 'item_defs');

    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      return entries;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Process in batches for performance
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
            const item = JSON.parse(content) as ItemDef & {
              notedID?: number;
              notedTemplate?: number;
              placeholderId?: number;
              placeholderTemplateId?: number;
              boughtId?: number;
              boughtTemplateId?: number;
              inventoryModel?: number;
            };

            return {
              id: item.id,
              name: item.name || 'null',
              notedID: item.notedID ?? -1,
              notedTemplate: item.notedTemplate ?? -1,
              placeholderId: item.placeholderId ?? -1,
              placeholderTemplateId: item.placeholderTemplateId ?? -1,
              boughtId: item.boughtId ?? -1,
              boughtTemplateId: item.boughtTemplateId ?? -1,
              inventoryModel: item.inventoryModel ?? -1
            };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (result) {
          entries.push(result);
        }
      }
    }

    return entries;
  }

  /**
   * Get all variants of an item (noted, placeholder, bought, same model)
   */
  getItemVariants(itemId: number): ItemVariantsResult | null {
    if (!this.itemVariantIndex || !this.crossRefIndex) return null;

    // Find the base item
    const baseItem = this.itemVariantIndex.find(e => e.id === itemId);
    if (!baseItem) return null;

    const variants: ItemVariant[] = [];
    const seen = new Set<number>([itemId]);

    // Helper to add variant if not already seen
    const addVariant = (id: number, relationship: ItemVariant['relationship'], allowNullName = false) => {
      if (id > 0 && !seen.has(id)) {
        seen.add(id);
        const variantItem = this.itemVariantIndex!.find(e => e.id === id);
        if (variantItem) {
          const hasValidName = variantItem.name && variantItem.name !== 'null';
          // For noted/placeholder/bought, show even if name is null (it's a template)
          if (hasValidName || allowNullName) {
            variants.push({
              id,
              name: hasValidName ? variantItem.name : `(template for ${baseItem.name})`,
              relationship
            });
          }
        }
      }
    };

    // Check if this is a noted item (has notedTemplate)
    if (baseItem.notedTemplate !== -1 && baseItem.notedID !== -1) {
      // This is a noted item, add the unnoted version
      addVariant(baseItem.notedID, 'unnoted', true);
    } else if (baseItem.notedID !== -1) {
      // This is an unnoted item, add the noted version
      addVariant(baseItem.notedID, 'noted', true);
    }

    // Check placeholder relationship
    if (baseItem.placeholderTemplateId !== -1 && baseItem.placeholderId !== -1) {
      // This is a placeholder, find the real item that points to this placeholder
      // (The placeholderId here points back to the real item)
      addVariant(baseItem.placeholderId, 'unnoted', true);
    } else if (baseItem.placeholderId !== -1) {
      // This is a real item, add its placeholder
      addVariant(baseItem.placeholderId, 'placeholder', true);
    }

    // Check bought relationship
    if (baseItem.boughtTemplateId !== -1 && baseItem.boughtId !== -1) {
      // This is a bought item, add the original
      addVariant(baseItem.boughtId, 'bought', true);
    } else if (baseItem.boughtId !== -1) {
      // This is an original item, add the bought version
      addVariant(baseItem.boughtId, 'bought', true);
    }

    // Find items with the same inventory model
    if (baseItem.inventoryModel > 0) {
      const sameModelItems = this.crossRefIndex.inventoryModelToItems.get(baseItem.inventoryModel);
      if (sameModelItems) {
        for (const entry of sameModelItems) {
          if (!seen.has(entry.id)) {
            seen.add(entry.id);
            variants.push({
              id: entry.id,
              name: entry.name,
              relationship: 'same_model'
            });
          }
        }
      }
    }

    return {
      baseItem: {
        id: baseItem.id,
        name: baseItem.name
      },
      variants
    };
  }

  /**
   * Find equipment items matching a name prefix in a specific slot or all slots
   */
  findEquipmentByPrefix(prefix: string, slot?: number): EquipmentSetResult | null {
    if (!this.itemAdvancedIndex) return null;

    const prefixLower = prefix.toLowerCase();
    const setItems: EquipmentSetMatch[] = [];

    for (const item of this.itemAdvancedIndex) {
      // Skip non-equippable items
      if (item.equipSlot < 0) continue;

      // Check if slot filter applies
      if (slot !== undefined && item.equipSlot !== slot) continue;

      // Check if name starts with prefix
      if (item.nameLower.startsWith(prefixLower)) {
        setItems.push({
          id: item.id,
          name: item.name,
          slot: EQUIPMENT_SLOTS[item.equipSlot] || `slot_${item.equipSlot}`,
          matchType: 'prefix'
        });
      }
    }

    if (setItems.length === 0) return null;

    // Sort by slot then by name
    setItems.sort((a, b) => {
      const slotA = SLOT_TO_WEARPOS[a.slot] ?? 99;
      const slotB = SLOT_TO_WEARPOS[b.slot] ?? 99;
      if (slotA !== slotB) return slotA - slotB;
      return a.name.localeCompare(b.name);
    });

    return {
      baseItem: {
        id: setItems[0].id,
        name: setItems[0].name,
        slot: setItems[0].slot,
        prefix: prefix
      },
      setItems
    };
  }

  /**
   * Extract the prefix from an item name (e.g., "Dragon platebody" -> "Dragon")
   */
  extractItemPrefix(itemName: string): string | null {
    // Common equipment suffixes to detect prefix
    const suffixes = [
      'platebody', 'chainbody', 'platelegs', 'plateskirt', 'full helm', 'med helm',
      'boots', 'gloves', 'gauntlets', 'shield', 'kiteshield', 'sq shield',
      'sword', 'longsword', 'scimitar', 'dagger', 'mace', 'warhammer', 'battleaxe',
      '2h sword', 'halberd', 'spear', 'hasta', 'crossbow', 'shortbow', 'longbow',
      'arrow', 'bolts', 'dart', 'knife', 'javelin', 'thrownaxe',
      'cape', 'cloak', 'helm', 'hat', 'hood', 'coif', 'mask',
      'body', 'legs', 'skirt', 'robe top', 'robe bottom', 'robes',
      'chaps', 'vambraces', 'd\'hide body', 'd\'hide chaps', 'd\'hide vambraces'
    ];

    const nameLower = itemName.toLowerCase();

    for (const suffix of suffixes) {
      if (nameLower.endsWith(suffix)) {
        const prefix = itemName.slice(0, itemName.length - suffix.length).trim();
        if (prefix.length > 0) {
          return prefix;
        }
      }
    }

    // Try splitting on space and taking first word if it looks like a material name
    const words = itemName.split(' ');
    if (words.length >= 2) {
      const firstWord = words[0];
      const materialNames = [
        'Bronze', 'Iron', 'Steel', 'Black', 'Mithril', 'Adamant', 'Rune', 'Dragon',
        'White', 'Granite', 'Obsidian', 'Barrows', 'Bandos', 'Armadyl', 'Ancient',
        'Leather', 'Studded', 'Green', 'Blue', 'Red', 'Black', 'Blessed',
        'Mystic', 'Infinity', 'Ancestral', 'Virtus', 'Ahrim\'s', 'Karil\'s',
        'Verac\'s', 'Torag\'s', 'Dharok\'s', 'Guthan\'s'
      ];
      if (materialNames.some(m => m.toLowerCase() === firstWord.toLowerCase())) {
        return firstWord;
      }
    }

    return null;
  }

  // ============================================
  // Phase 7.5: Item Sources Methods
  // ============================================

  /**
   * Build item sources index mapping items to NPC drop rows and shop rows
   * - Table 118: NPC drops (Collection Log) - col 19 has item IDs, col 20 has NPC ID
   * - Table 40: Shop inventory - col 0 has item ID (NAMEDOBJ)
   */
  private async buildItemSourceIndex(): Promise<Map<number, { npcDropRows: number[]; shopRows: number[] }>> {
    const index = new Map<number, { npcDropRows: number[]; shopRows: number[] }>();

    // Load Table 118 column 19 index (item ID -> drop rows)
    try {
      const indexPath = path.join(this.cachePath, 'dbtable_index', '118', '19.json');
      const content = await fs.readFile(indexPath, 'utf-8');
      const data = JSON.parse(content) as {
        tupleIndexes: [{ [itemId: string]: number[] }];
      };

      if (data.tupleIndexes && data.tupleIndexes[0]) {
        for (const [itemIdStr, rowIds] of Object.entries(data.tupleIndexes[0])) {
          const itemId = parseInt(itemIdStr);
          if (!isNaN(itemId)) {
            const entry = index.get(itemId) || { npcDropRows: [], shopRows: [] };
            entry.npcDropRows.push(...rowIds);
            index.set(itemId, entry);
          }
        }
      }
    } catch {
      // Table 118 index might not exist
    }

    // Load Table 40 rows for shop inventory
    try {
      const masterPath = path.join(this.cachePath, 'dbtable_index', '40', 'master.json');
      const content = await fs.readFile(masterPath, 'utf-8');
      const data = JSON.parse(content) as {
        tupleIndexes: [{ '0': number[] }];
      };

      if (data.tupleIndexes && data.tupleIndexes[0] && data.tupleIndexes[0]['0']) {
        const shopRowIds = data.tupleIndexes[0]['0'];

        // Process shop rows in batches to extract item IDs
        for (let i = 0; i < shopRowIds.length; i += BATCH_SIZE) {
          const batch = shopRowIds.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (rowId) => {
              try {
                const rowPath = path.join(this.cachePath, 'dbrow', `${rowId}.json`);
                const rowContent = await fs.readFile(rowPath, 'utf-8');
                const row = JSON.parse(rowContent) as {
                  id: number;
                  tableId: number;
                  columnValues: (unknown[] | null)[];
                };

                // Column 0 contains the item ID (NAMEDOBJ)
                if (row.columnValues && row.columnValues[0] && Array.isArray(row.columnValues[0])) {
                  const itemId = row.columnValues[0][0] as number;
                  if (typeof itemId === 'number') {
                    const entry = index.get(itemId) || { npcDropRows: [], shopRows: [] };
                    entry.shopRows.push(rowId);
                    index.set(itemId, entry);
                  }
                }
              } catch {
                // Skip invalid rows
              }
            })
          );
        }
      }
    } catch {
      // Table 40 master might not exist
    }

    return index;
  }

  /**
   * Find all sources for an item (NPC drops and shops)
   */
  async findItemSources(itemId: number): Promise<ItemSourcesResult | null> {
    if (!this.itemSourceIndex) return null;

    // Get item info
    const itemPath = path.join(this.cachePath, 'item_defs', `${itemId}.json`);
    let itemName = `Item ${itemId}`;
    try {
      const content = await fs.readFile(itemPath, 'utf-8');
      const item = JSON.parse(content) as { name?: string };
      if (item.name) itemName = item.name;
    } catch {
      // Item might not exist
    }

    const sourceEntry = this.itemSourceIndex.get(itemId);
    const result: ItemSourcesResult = {
      item: { id: itemId, name: itemName },
      sources: {
        npcDrops: [],
        shops: []
      },
      totalSources: 0
    };

    if (!sourceEntry) {
      return result;
    }

    // Load NPC drop sources from Table 118 rows
    for (const rowId of sourceEntry.npcDropRows) {
      try {
        const rowPath = path.join(this.cachePath, 'dbrow', `${rowId}.json`);
        const content = await fs.readFile(rowPath, 'utf-8');
        const row = JSON.parse(content) as {
          columnValues: (unknown[] | null)[];
        };

        // Column 0: description, Column 20: NPC ID
        const description = row.columnValues?.[0]?.[0] as string || '';
        const npcId = row.columnValues?.[20]?.[0] as number;

        if (typeof npcId === 'number') {
          // Get NPC name
          let npcName = `NPC ${npcId}`;
          try {
            const npcPath = path.join(this.cachePath, 'npc_defs', `${npcId}.json`);
            const npcContent = await fs.readFile(npcPath, 'utf-8');
            const npc = JSON.parse(npcContent) as { name?: string };
            if (npc.name) npcName = npc.name;
          } catch {
            // NPC might not exist
          }

          result.sources.npcDrops.push({
            npcId,
            npcName,
            description
          });
        }
      } catch {
        // Skip invalid rows
      }
    }

    // Load shop sources from Table 40 rows
    for (const rowId of sourceEntry.shopRows) {
      try {
        const rowPath = path.join(this.cachePath, 'dbrow', `${rowId}.json`);
        const content = await fs.readFile(rowPath, 'utf-8');
        const row = JSON.parse(content) as {
          columnValues: (unknown[] | null)[];
        };

        // Column 0: item ID, Column 6: stock info, Column 7: [currency_dbrow, price]
        const stockVal = row.columnValues?.[6];
        const stock = Array.isArray(stockVal) && typeof stockVal[0] === 'number' ? stockVal[0] : 0;

        const currencyInfo = row.columnValues?.[7] as [number, number] | null;
        let currency = 'Coins';
        let price = 0;

        if (Array.isArray(currencyInfo) && currencyInfo.length >= 2) {
          const currencyRowId = currencyInfo[0];
          price = currencyInfo[1];

          // Load currency name from Table 41
          try {
            const currencyPath = path.join(this.cachePath, 'dbrow', `${currencyRowId}.json`);
            const currencyContent = await fs.readFile(currencyPath, 'utf-8');
            const currencyRow = JSON.parse(currencyContent) as {
              columnValues: (unknown[] | null)[];
            };
            // Column 2 has plural form of currency name
            const currencyName = currencyRow.columnValues?.[2]?.[0] as string;
            if (currencyName) currency = currencyName;
          } catch {
            // Use default currency name
          }
        }

        result.sources.shops.push({
          itemId,
          price,
          currency,
          stock
        });
      } catch {
        // Skip invalid rows
      }
    }

    result.totalSources = result.sources.npcDrops.length + result.sources.shops.length;
    return result;
  }

  // ============================================
  // Phase 8: Database Methods
  // ============================================

  /**
   * Build DBRow index for full-text search across STRING columns
   */
  private async buildDBRowIndex(): Promise<DBRowIndexEntry[]> {
    const entries: DBRowIndexEntry[] = [];
    const dirPath = path.join(this.cachePath, 'dbrow');

    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      return entries;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Process in batches for performance
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          const id = parseInt(file.replace('.json', ''));
          try {
            const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
            const data = JSON.parse(content) as {
              id: number;
              tableId: number;
              columnTypes: (string[] | null)[];
              columnValues: (unknown[] | null)[];
            };

            // Extract all string values for search
            const strings: string[] = [];
            if (data.columnTypes && data.columnValues) {
              for (let col = 0; col < data.columnTypes.length; col++) {
                const types = data.columnTypes[col];
                const values = data.columnValues[col];
                if (types && values && types.includes('STRING')) {
                  for (const val of values) {
                    if (typeof val === 'string' && val.length > 0) {
                      strings.push(val);
                    }
                  }
                }
              }
            }

            if (strings.length === 0) return null;

            const searchText = strings.join(' ');
            return {
              id,
              tableId: data.tableId,
              searchText,
              searchTextLower: searchText.toLowerCase()
            };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (result) {
          entries.push(result);
        }
      }
    }

    return entries;
  }

  /**
   * Build DBTable metadata with row counts and indexed columns
   */
  private async buildDBTableMetadata(): Promise<Map<number, { rowCount: number; indexedCols: number[] }>> {
    const metadata = new Map<number, { rowCount: number; indexedCols: number[] }>();
    const indexDir = path.join(this.cachePath, 'dbtable_index');

    let tableDirs: string[];
    try {
      const dirs = await fs.readdir(indexDir, { withFileTypes: true });
      tableDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);
    } catch {
      return metadata;
    }

    for (const tableDir of tableDirs) {
      const tableId = parseInt(tableDir);
      if (isNaN(tableId)) continue;

      const tablePath = path.join(indexDir, tableDir);

      // Read master.json for row count
      let rowCount = 0;
      try {
        const masterPath = path.join(tablePath, 'master.json');
        const content = await fs.readFile(masterPath, 'utf-8');
        const data = JSON.parse(content);
        if (data.tupleIndexes && data.tupleIndexes.length > 0) {
          rowCount = (data.tupleIndexes[0]['0'] || []).length;
        }
      } catch {
        // master.json might not exist
      }

      // Get indexed columns
      let indexedCols: number[] = [];
      try {
        const files = await fs.readdir(tablePath);
        indexedCols = files
          .filter(f => f.endsWith('.json') && f !== 'master.json')
          .map(f => parseInt(f.replace('.json', '')))
          .filter(id => !isNaN(id))
          .sort((a, b) => a - b);
      } catch {
        // Ignore
      }

      metadata.set(tableId, { rowCount, indexedCols });
    }

    return metadata;
  }

  /**
   * Search dbrows by text content
   */
  searchDbrows(query: string, tableId?: number, limit = 25): DBRowIndexEntry[] {
    if (!this.dbrowIndex) return [];

    const queryLower = query.toLowerCase();
    const results: DBRowIndexEntry[] = [];

    for (const entry of this.dbrowIndex) {
      // Filter by table if specified
      if (tableId !== undefined && entry.tableId !== tableId) {
        continue;
      }

      // Match by text
      if (entry.searchTextLower.includes(queryLower)) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Get DBTable metadata
   */
  getDBTableMetadata(tableId: number): { rowCount: number; indexedCols: number[] } | null {
    if (!this.dbtableMetadata) return null;
    return this.dbtableMetadata.get(tableId) || null;
  }

  /**
   * Get all DBTable metadata
   */
  getAllDBTableMetadata(): Map<number, { rowCount: number; indexedCols: number[] }> {
    return this.dbtableMetadata || new Map();
  }

  // ============================================
  // Phase 9: Export Methods
  // ============================================

  /**
   * Get item stats export data
   * Returns all items from the advanced index with combat stats
   */
  getItemStatsExport(): ItemStatsExport[] {
    if (!this.itemAdvancedIndex) return [];

    return this.itemAdvancedIndex.map(item => ({
      id: item.id,
      name: item.name,
      equipSlot: item.equipSlot,
      tradeable: item.tradeable,
      members: item.members,
      cost: item.cost,
      weight: item.weight,
      stackable: item.stackable,
      attackStab: item.attackStab,
      attackSlash: item.attackSlash,
      attackCrush: item.attackCrush,
      attackMagic: item.attackMagic,
      attackRanged: item.attackRanged,
      defenceStab: item.defenceStab,
      defenceSlash: item.defenceSlash,
      defenceCrush: item.defenceCrush,
      defenceMagic: item.defenceMagic,
      defenceRanged: item.defenceRanged,
      meleeStrength: item.meleeStrength,
      rangedStrength: item.rangedStrength,
      magicDamage: item.magicDamage,
      prayer: item.prayer
    }));
  }

  /**
   * Get NPC combat export data
   * Returns all NPCs with combat stats from npcAdvancedIndex + NPC defs
   */
  async getNpcCombatExport(): Promise<NpcCombatExport[]> {
    if (!this.npcAdvancedIndex) return [];

    const results: NpcCombatExport[] = [];
    const npcDir = path.join(this.cachePath, 'npc_defs');

    // Process in batches
    for (let i = 0; i < this.npcAdvancedIndex.length; i += BATCH_SIZE) {
      const batch = this.npcAdvancedIndex.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (npc) => {
          // Load full NPC def for stats array
          try {
            const content = await fs.readFile(path.join(npcDir, `${npc.id}.json`), 'utf-8');
            const data = JSON.parse(content) as {
              id: number;
              name: string;
              combatLevel?: number;
              stats?: number[];
              actions?: (string | null)[];
              size?: number;
            };

            // Parse stats array: [Attack, Defence, Strength, Hitpoints, Ranged, Magic]
            const stats = data.stats || [];
            const actions: string[] = (data.actions || []).filter((a): a is string => a !== null && a !== 'null');
            const isAttackable = actions.some(a => a.toLowerCase() === 'attack');

            return {
              id: npc.id,
              name: npc.name,
              combatLevel: npc.combatLevel,
              attack: stats[0] ?? 0,
              defence: stats[1] ?? 0,
              strength: stats[2] ?? 0,
              hitpoints: stats[3] ?? 0,
              ranged: stats[4] ?? 0,
              magic: stats[5] ?? 0,
              size: npc.size,
              attackable: isAttackable,
              actions
            };
          } catch {
            // Return basic data from index if full def unavailable
            return {
              id: npc.id,
              name: npc.name,
              combatLevel: npc.combatLevel,
              attack: 0,
              defence: 0,
              strength: 0,
              hitpoints: 0,
              ranged: 0,
              magic: 0,
              size: npc.size,
              attackable: npc.actions.some(a => a.toLowerCase() === 'attack'),
              actions: npc.actions
            };
          }
        })
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get model references export data
   * Returns all model IDs with their entity usage from crossRefIndex
   */
  getModelRefsExport(): ModelRefExport[] {
    if (!this.crossRefIndex) return [];

    const results: ModelRefExport[] = [];

    for (const [modelId, entries] of this.crossRefIndex.modelToEntities.entries()) {
      const items: { id: number; name: string }[] = [];
      const npcs: { id: number; name: string }[] = [];
      const objects: { id: number; name: string }[] = [];

      for (const entry of entries) {
        const ref = { id: entry.id, name: entry.name };
        switch (entry.type) {
          case 'item':
            items.push(ref);
            break;
          case 'npc':
            npcs.push(ref);
            break;
          case 'object':
            objects.push(ref);
            break;
        }
      }

      results.push({
        modelId,
        usageCount: entries.length,
        items,
        npcs,
        objects
      });
    }

    // Sort by model ID
    results.sort((a, b) => a.modelId - b.modelId);

    return results;
  }

  // ============================================
  // Phase 10: Animation & Sequence Analysis
  // ============================================

  /**
   * Build sequence index for all animations
   */
  private async buildSequenceIndex(): Promise<SequenceIndexEntry[]> {
    const dir = path.join(this.cachePath, 'sequences');
    const entries: SequenceIndexEntry[] = [];

    try {
      const files = await fs.readdir(dir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batch = jsonFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(dir, file), 'utf-8');
            const seq = JSON.parse(content);

            const isSkeletal = seq.animMayaID != null && seq.animMayaID > 0;
            const frameIDs: number[] = seq.frameIDs || [];
            const frameLengths: number[] = seq.frameLengths || [];
            const frameSounds = seq.frameSounds || {};

            const entry: SequenceIndexEntry = {
              id: seq.id,
              type: isSkeletal ? 'skeletal' : 'frame',
              frameCount: isSkeletal ? (seq.animMayaEnd - seq.animMayaStart) : frameIDs.length,
              totalDuration: isSkeletal
                ? (seq.animMayaEnd - seq.animMayaStart)
                : frameLengths.reduce((sum: number, l: number) => sum + l, 0),
              forcedPriority: seq.forcedPriority ?? 0,
              priority: seq.priority ?? -1,
              leftHandItem: seq.leftHandItem ?? -1,
              rightHandItem: seq.rightHandItem ?? -1,
              hasSounds: Object.keys(frameSounds).length > 0,
              maxLoops: seq.maxLoops ?? 0,
              replyMode: seq.replyMode ?? 0,
              stretches: seq.stretches ?? false,
              animMayaID: isSkeletal ? seq.animMayaID : -1,
              animMayaStart: seq.animMayaStart ?? 0,
              animMayaEnd: seq.animMayaEnd ?? 0,
              frameGroup: (!isSkeletal && frameIDs.length > 0)
                ? (frameIDs[0] >>> 16)
                : -1
            };

            entries.push(entry);
          } catch {
            // Skip invalid files
          }
        }));
      }
    } catch {
      // sequences dir not found
    }

    entries.sort((a, b) => a.id - b.id);
    return entries;
  }

  /**
   * Build reverse index from animationId → spotanim IDs
   */
  private async buildSpotAnimIndex(): Promise<Map<number, number[]>> {
    const index = new Map<number, number[]>();
    const dir = path.join(this.cachePath, 'spotanims');

    try {
      const files = await fs.readdir(dir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batch = jsonFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(dir, file), 'utf-8');
            const spotAnim = JSON.parse(content);
            const animId = spotAnim.animationId ?? spotAnim.animation ?? -1;
            if (animId >= 0) {
              const existing = index.get(animId);
              if (existing) {
                existing.push(spotAnim.id);
              } else {
                index.set(animId, [spotAnim.id]);
              }
            }
          } catch {
            // Skip invalid files
          }
        }));
      }
    } catch {
      // spotanims dir not found
    }

    return index;
  }

  /**
   * Get spot anim IDs linked to an animation
   */
  getSpotAnimsForAnimation(animId: number): number[] {
    return this.spotAnimIndex?.get(animId) || [];
  }

  /**
   * Enhanced find_relative_animations: accepts animation_id and/or npc_id,
   * scans neighboring IDs, groups by frameGroup, includes spot anims
   */
  async findRelativeAnimationsEnhanced(args: {
    animation_id?: number;
    npc_id?: number;
    range?: number;
  }): Promise<RelativeAnimationResult | null> {
    if (!this.sequenceIndex || !this.crossRefIndex || !this.spotAnimIndex) return null;

    const range = args.range ?? 50;
    const seedAnimIds: number[] = [];
    let npcInfo: RelativeAnimationResult['npc'] = undefined;

    // Collect seed animations
    if (args.npc_id != null) {
      const npcPath = path.join(this.cachePath, 'npc_defs', `${args.npc_id}.json`);
      try {
        const content = await fs.readFile(npcPath, 'utf-8');
        const npc = JSON.parse(content);
        npcInfo = {
          id: npc.id,
          name: npc.name || 'Unknown',
          combatLevel: npc.combatLevel || 0
        };
        // Extract all animation fields
        const animFields = [
          'standingAnimation', 'walkingAnimation', 'runAnimation',
          'rotate180Animation', 'rotateLeftAnimation', 'rotateRightAnimation',
          'idleRotateLeftAnimation', 'idleRotateRightAnimation',
          'runRotate180Animation', 'runRotateLeftAnimation', 'runRotateRightAnimation',
          'crawlAnimation', 'crawlRotate180Animation', 'crawlRotateLeftAnimation', 'crawlRotateRightAnimation'
        ];
        for (const field of animFields) {
          const id = npc[field];
          if (id != null && id > 0 && !seedAnimIds.includes(id)) {
            seedAnimIds.push(id);
          }
        }
      } catch {
        // NPC not found
      }
    }

    if (args.animation_id != null) {
      if (!seedAnimIds.includes(args.animation_id)) {
        seedAnimIds.push(args.animation_id);
      }
    }

    if (seedAnimIds.length === 0) return null;

    // Build a quick lookup for sequence entries by ID
    const seqById = new Map<number, SequenceIndexEntry>();
    for (const seq of this.sequenceIndex) {
      seqById.set(seq.id, seq);
    }

    // Collect all frameGroups from seeds
    const seedFrameGroups = new Set<number>();
    for (const seedId of seedAnimIds) {
      const entry = seqById.get(seedId);
      if (entry && entry.frameGroup >= 0) {
        seedFrameGroups.add(entry.frameGroup);
      }
    }

    // Scan range around each seed to find animations sharing frameGroups
    const minId = Math.max(0, Math.min(...seedAnimIds) - range);
    const maxId = Math.max(...seedAnimIds) + range;

    // Group animations by frameGroup
    const clusterMap = new Map<number, Map<number, SequenceIndexEntry>>();

    for (const seq of this.sequenceIndex) {
      if (seq.id < minId || seq.id > maxId) continue;
      if (seq.frameGroup < 0) continue;
      if (!seedFrameGroups.has(seq.frameGroup)) continue;

      let group = clusterMap.get(seq.frameGroup);
      if (!group) {
        group = new Map();
        clusterMap.set(seq.frameGroup, group);
      }
      group.set(seq.id, seq);
    }

    // Also ensure all seeds with frameGroup are in their cluster
    for (const seedId of seedAnimIds) {
      const entry = seqById.get(seedId);
      if (entry && entry.frameGroup >= 0) {
        let group = clusterMap.get(entry.frameGroup);
        if (!group) {
          group = new Map();
          clusterMap.set(entry.frameGroup, group);
        }
        group.set(entry.id, entry);
      }
    }

    const seedSet = new Set(seedAnimIds);

    // Build clusters
    const clusters: AnimationCluster[] = [];
    for (const [frameGroup, animMap] of clusterMap) {
      const animations: AnimationCluster['animations'] = [];
      for (const [id, seq] of animMap) {
        // Get spot anims
        const spotAnims = this.spotAnimIndex.get(id) || [];

        // Get roles from cross-ref
        const entities = this.crossRefIndex.animationToEntities.get(id) || [];
        const roles = entities.map(e => ({
          entityId: e.id,
          entityName: e.name,
          entityType: e.type,
          role: e.type // Will be enriched by handler
        }));

        animations.push({
          id,
          type: seq.type,
          frameCount: seq.frameCount,
          duration: seq.totalDuration,
          spotAnims,
          roles,
          isSource: seedSet.has(id)
        });
      }
      animations.sort((a, b) => a.id - b.id);
      clusters.push({ frameGroup, animations });
    }

    clusters.sort((a, b) => a.frameGroup - b.frameGroup);

    return {
      seedAnimations: seedAnimIds,
      npc: npcInfo,
      clusters
    };
  }

  /**
   * Get sequence index entry by ID
   */
  getSequenceEntry(id: number): SequenceIndexEntry | null {
    if (!this.sequenceIndex) return null;
    // Binary search since sorted by id
    let lo = 0, hi = this.sequenceIndex.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const midId = this.sequenceIndex[mid].id;
      if (midId === id) return this.sequenceIndex[mid];
      if (midId < id) lo = mid + 1;
      else hi = mid - 1;
    }
    return null;
  }

  /**
   * Get total sequence count
   */
  getSequenceCount(): number {
    return this.sequenceIndex?.length ?? 0;
  }

  /**
   * Advanced sequence search with multiple filters
   */
  searchSequencesAdvanced(
    filter: SequenceAdvancedFilter,
    options?: { offset?: number; limit?: number }
  ): AdvancedSearchResult<SequenceAdvancedResult> {
    if (!this.sequenceIndex) {
      return { results: [], totalCount: 0, offset: 0, limit: 25 };
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 25;

    // Precompute entity name matches if needed
    let npcNameMatches: Set<number> | null = null;
    let objectNameMatches: Set<number> | null = null;

    if (filter.usedByNpc && this.crossRefIndex) {
      npcNameMatches = new Set<number>();
      const queryLower = filter.usedByNpc.toLowerCase();
      // Find all animations used by NPCs matching the name
      for (const [animId, entities] of this.crossRefIndex.animationToEntities.entries()) {
        for (const entity of entities) {
          if (entity.type === 'npc' && entity.name.toLowerCase().includes(queryLower)) {
            npcNameMatches.add(animId);
            break;
          }
        }
      }
    }

    if (filter.usedByObject && this.crossRefIndex) {
      objectNameMatches = new Set<number>();
      const queryLower = filter.usedByObject.toLowerCase();
      for (const [animId, entities] of this.crossRefIndex.animationToEntities.entries()) {
        for (const entity of entities) {
          if (entity.type === 'object' && entity.name.toLowerCase().includes(queryLower)) {
            objectNameMatches.add(animId);
            break;
          }
        }
      }
    }

    // Filter sequences
    const matching: SequenceAdvancedResult[] = [];

    for (const seq of this.sequenceIndex) {
      // Type filter
      if (filter.type && seq.type !== filter.type) continue;

      // Duration filters
      if (filter.minDuration != null && seq.totalDuration < filter.minDuration) continue;
      if (filter.maxDuration != null && seq.totalDuration > filter.maxDuration) continue;

      // Frame count filters
      if (filter.minFrameCount != null && seq.frameCount < filter.minFrameCount) continue;
      if (filter.maxFrameCount != null && seq.frameCount > filter.maxFrameCount) continue;

      // Sound filter
      if (filter.hasSounds != null && seq.hasSounds !== filter.hasSounds) continue;

      // Hand item filters
      if (filter.leftHandItem != null && seq.leftHandItem !== filter.leftHandItem) continue;
      if (filter.rightHandItem != null && seq.rightHandItem !== filter.rightHandItem) continue;

      // Priority filters
      if (filter.minPriority != null && seq.forcedPriority < filter.minPriority) continue;
      if (filter.maxPriority != null && seq.forcedPriority > filter.maxPriority) continue;

      // Frame group filter
      if (filter.frameGroup != null && seq.frameGroup !== filter.frameGroup) continue;

      // Maya ID filter
      if (filter.animMayaID != null && seq.animMayaID !== filter.animMayaID) continue;

      // Entity name filters
      if (npcNameMatches && !npcNameMatches.has(seq.id)) continue;
      if (objectNameMatches && !objectNameMatches.has(seq.id)) continue;

      // Build result
      const result: SequenceAdvancedResult = {
        id: seq.id,
        type: seq.type,
        frameCount: seq.frameCount,
        totalDuration: seq.totalDuration,
        forcedPriority: seq.forcedPriority,
        hasSounds: seq.hasSounds,
        leftHandItem: seq.leftHandItem,
        rightHandItem: seq.rightHandItem
      };

      if (seq.type === 'skeletal' && seq.animMayaID > 0) {
        result.animMayaID = seq.animMayaID;
      }
      if (seq.type === 'frame' && seq.frameGroup >= 0) {
        result.frameGroup = seq.frameGroup;
      }

      // Add entity associations if entity filters were used
      if (this.crossRefIndex && (npcNameMatches || objectNameMatches)) {
        const entities = this.crossRefIndex.animationToEntities.get(seq.id);
        if (entities) {
          result.usedBy = entities.slice(0, 10).map(e => ({
            id: e.id,
            name: e.name,
            entityType: e.type
          }));
        }
      }

      matching.push(result);
    }

    return {
      results: matching.slice(offset, offset + limit),
      totalCount: matching.length,
      offset,
      limit
    };
  }

  /**
   * Find all animations related to a given animation:
   * - Other animations used by the same NPCs/objects
   * - Animations sharing the same frame group or Maya skeleton
   */
  findRelatedAnimations(animationId: number): RelatedAnimationsResult | null {
    if (!this.crossRefIndex || !this.sequenceIndex) return null;

    const sourceEntry = this.getSequenceEntry(animationId);
    if (!sourceEntry) return null;

    const result: RelatedAnimationsResult = {
      sourceAnimation: {
        id: sourceEntry.id,
        type: sourceEntry.type,
        frameCount: sourceEntry.frameCount,
        totalDuration: sourceEntry.totalDuration
      },
      byEntity: [],
      allRelatedIds: [],
      bySkeleton: []
    };

    const relatedIds = new Set<number>();

    // 1. Find all entities using this animation
    // The handler will read the full NPC/object defs to resolve proper animation roles
    const entities = this.crossRefIndex.animationToEntities.get(animationId) || [];

    for (const entity of entities) {
      result.byEntity.push({
        entityId: entity.id,
        entityName: entity.name,
        entityType: entity.type as 'npc' | 'object',
        animations: [] // Populated by the handler with proper role resolution
      });
    }

    // 2. Find animations sharing same frame group or Maya skeleton
    if (sourceEntry.type === 'frame' && sourceEntry.frameGroup >= 0) {
      for (const seq of this.sequenceIndex) {
        if (seq.id !== animationId && seq.frameGroup === sourceEntry.frameGroup) {
          result.bySkeleton.push({
            id: seq.id,
            type: seq.type,
            frameCount: seq.frameCount,
            totalDuration: seq.totalDuration
          });
          relatedIds.add(seq.id);
        }
      }
    } else if (sourceEntry.type === 'skeletal' && sourceEntry.animMayaID > 0) {
      // For skeletal, we can't easily group - each has a unique Maya ID
      // But we can check for nearby Maya IDs (same skeleton export batch)
      // Maya IDs in the same batch often differ by small amounts
      // Skipping this heuristic for now - entity-based matching is more reliable
    }

    result.allRelatedIds = [...relatedIds].sort((a, b) => a - b);

    return result;
  }

  /**
   * Get all animation entries for NPC definition fields
   */
  getNpcAnimationEntries(npcDef: Record<string, unknown>): AnimationRoleEntry[] {
    const entries: AnimationRoleEntry[] = [];

    const animFields: [AnimationRole, string][] = [
      ['standing', 'standingAnimation'],
      ['walking', 'walkingAnimation'],
      ['running', 'runAnimation'],
      ['rotate180', 'rotate180Animation'],
      ['rotateLeft', 'rotateLeftAnimation'],
      ['rotateRight', 'rotateRightAnimation'],
      ['idleRotateLeft', 'idleRotateLeftAnimation'],
      ['idleRotateRight', 'idleRotateRightAnimation'],
      ['runRotate180', 'runRotate180Animation'],
      ['runRotateLeft', 'runRotateLeftAnimation'],
      ['runRotateRight', 'runRotateRightAnimation'],
      ['crawl', 'crawlAnimation'],
      ['crawlRotate180', 'crawlRotate180Animation'],
      ['crawlRotateLeft', 'crawlRotateLeftAnimation'],
      ['crawlRotateRight', 'crawlRotateRightAnimation'],
    ];

    for (const [role, field] of animFields) {
      const animId = npcDef[field] as number | undefined;
      if (animId != null && animId > 0) {
        const seq = this.getSequenceEntry(animId);
        entries.push({
          role,
          animationId: animId,
          sequence: seq ? {
            type: seq.type,
            frameCount: seq.frameCount,
            totalDuration: seq.totalDuration,
            forcedPriority: seq.forcedPriority,
            hasSounds: seq.hasSounds
          } : undefined
        });
      }
    }

    return entries;
  }
}
