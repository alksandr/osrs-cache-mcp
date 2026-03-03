import { CacheReader } from './reader.js';
import { CacheIndexer } from './indexer.js';
import {
  CacheType,
  SearchOptions,
  SearchResult,
  CrossRefEntry,
  ScriptSearchResult,
  SpriteData,
  SpriteGroupEntry,
  VarbitSearchResult,
  VarbitScriptRef,
  GameValDef,
  GameValSearchResult,
  GameValCategoryInfo,
  // Phase 5: Advanced search types
  ItemAdvancedFilter,
  NpcAdvancedFilter,
  ObjectAdvancedFilter,
  ItemAdvancedResult,
  NpcAdvancedResult,
  ObjectAdvancedResult,
  AdvancedSearchResult,
  // Phase 6: Interface types
  InterfaceSearchResult,
  InterfaceTreeNode,
  InterfaceParentInfo,
  // Phase 6.5: Interface cross-reference types
  InterfaceScriptRef,
  InterfaceVarbitRef,
  // Phase 7: Analysis types
  ItemVariantsResult,
  EquipmentSetResult,
  // Phase 7.5: Item sources types
  ItemSourcesResult,
  // Phase 8: Database types
  DBRowIndexEntry,
  // Phase 9: Export types
  ItemStatsExport,
  NpcCombatExport,
  ModelRefExport,
  // Phase 10: Animation types
  SequenceIndexEntry,
  SequenceAdvancedFilter,
  SequenceAdvancedResult,
  RelatedAnimationsResult,
  AnimationRoleEntry
} from '../types.js';

export class CacheManager {
  public readonly reader: CacheReader;
  public readonly indexer: CacheIndexer;

  constructor(cachePath: string) {
    this.reader = new CacheReader(cachePath);
    this.indexer = new CacheIndexer(cachePath);
  }

  /**
   * Build indexes on startup
   */
  async buildIndexes(quiet = false): Promise<void> {
    await this.indexer.buildIndexes(quiet);
  }

  /**
   * Check if indexes are ready
   */
  get isReady(): boolean {
    return this.indexer.isReady;
  }

  // Direct lookups (delegate to reader)
  async getById(type: CacheType, id: number): Promise<object | null> {
    return this.reader.getById(type, id);
  }

  async getInterface(parent: number, child: number): Promise<object | null> {
    return this.reader.getInterface(parent, child);
  }

  async getSpritePath(id: number): Promise<string | null> {
    return this.reader.getSpritePath(id);
  }

  // Enhanced sprite methods
  async getSpriteData(id: number): Promise<SpriteData | null> {
    return this.reader.getSpriteData(id);
  }

  async getSpriteFrame(groupId: number, frameIndex: number): Promise<SpriteData | null> {
    return this.reader.getSpriteFrame(groupId, frameIndex);
  }

  async getSpriteGroup(groupId: number): Promise<SpriteGroupEntry[]> {
    return this.reader.getSpriteGroup(groupId);
  }

  async listSpriteIds(): Promise<{ rootSprites: number[]; groups: number[] }> {
    return this.reader.listSpriteIds();
  }

  async searchSprites(pattern: string, limit?: number): Promise<Array<{ id: number; isGroup: boolean; frameCount?: number }>> {
    return this.reader.searchSprites(pattern, limit);
  }

  // Script methods (delegate to reader)
  async getScript(id: number): Promise<string | null> {
    return this.reader.getScript(id);
  }

  async getScriptHash(id: number): Promise<string | null> {
    return this.reader.getScriptHash(id);
  }

  async listScriptIds(): Promise<number[]> {
    return this.reader.listScriptIds();
  }

  async getMultiple(type: CacheType, ids: number[]): Promise<Map<number, object>> {
    return this.reader.getMultiple(type, ids);
  }

  async getStats(): Promise<Record<string, number>> {
    return this.reader.getStats();
  }

  // Search (delegate to indexer)
  searchItems(query: string, options?: SearchOptions): SearchResult[] {
    return this.indexer.searchItems(query, options);
  }

  searchNpcs(query: string, options?: SearchOptions): SearchResult[] {
    return this.indexer.searchNpcs(query, options);
  }

  searchObjects(query: string, options?: SearchOptions): SearchResult[] {
    return this.indexer.searchObjects(query, options);
  }

  // Script search (delegate to indexer)
  searchScripts(query: string, options?: SearchOptions): ScriptSearchResult[] {
    return this.indexer.searchScripts(query, options);
  }

  // Cross-reference lookups (delegate to indexer)
  findByModel(modelId: number): CrossRefEntry[] {
    return this.indexer.findByModel(modelId);
  }

  findByAnimation(animationId: number): CrossRefEntry[] {
    return this.indexer.findByAnimation(animationId);
  }

  findByInventoryModel(modelId: number): CrossRefEntry[] {
    return this.indexer.findByInventoryModel(modelId);
  }

  // Varbit methods (delegate to indexer)
  searchVarbits(query: string, options?: SearchOptions): VarbitSearchResult[] {
    return this.indexer.searchVarbits(query, options);
  }

  findVarbitsByIndex(index: number): VarbitSearchResult[] {
    return this.indexer.findVarbitsByIndex(index);
  }

  getVarbitScriptRefs(varbitId: number): VarbitScriptRef[] {
    return this.indexer.getVarbitScriptRefs(varbitId);
  }

  getVarbitCount(): number {
    return this.indexer.getVarbitCount();
  }

  getVarbitIndexCount(): number {
    return this.indexer.getVarbitIndexCount();
  }

  // Game value methods (delegate to reader)
  async getGameVal(category: number, id: number): Promise<GameValDef | null> {
    return this.reader.getGameVal(category, id);
  }

  async listGameValCategories(): Promise<GameValCategoryInfo[]> {
    return this.reader.listGameValCategories();
  }

  async listGameValIds(category: number): Promise<number[]> {
    return this.reader.listGameValIds(category);
  }

  // Game value search (delegate to indexer)
  searchGameVals(query: string, options?: SearchOptions & { category?: number }): GameValSearchResult[] {
    return this.indexer.searchGameVals(query, options);
  }

  getGameValCount(): number {
    return this.indexer.getGameValCount();
  }

  // Phase 5: Advanced search methods (delegate to indexer)
  searchItemsAdvanced(
    filter: ItemAdvancedFilter,
    options?: { offset?: number; limit?: number }
  ): AdvancedSearchResult<ItemAdvancedResult> {
    return this.indexer.searchItemsAdvanced(filter, options);
  }

  searchNpcsAdvanced(
    filter: NpcAdvancedFilter,
    options?: { offset?: number; limit?: number }
  ): AdvancedSearchResult<NpcAdvancedResult> {
    return this.indexer.searchNpcsAdvanced(filter, options);
  }

  searchObjectsAdvanced(
    filter: ObjectAdvancedFilter,
    options?: { offset?: number; limit?: number }
  ): AdvancedSearchResult<ObjectAdvancedResult> {
    return this.indexer.searchObjectsAdvanced(filter, options);
  }

  // Phase 6: Interface methods (delegate to reader)
  async listInterfaceParents(): Promise<InterfaceParentInfo[]> {
    return this.reader.listInterfaceParents();
  }

  async listInterfaceChildren(parent: number): Promise<number[]> {
    return this.reader.listInterfaceChildren(parent);
  }

  async getInterfaceTree(parent: number): Promise<InterfaceTreeNode | null> {
    return this.reader.getInterfaceTree(parent);
  }

  // Phase 6: Interface search methods (delegate to indexer)
  searchInterfaces(query: string, options?: SearchOptions & { type?: number; hasAction?: boolean }): InterfaceSearchResult[] {
    return this.indexer.searchInterfaces(query, options);
  }

  findInterfacesByAction(action: string, limit?: number): InterfaceSearchResult[] {
    return this.indexer.findInterfacesByAction(action, limit);
  }

  getInterfaceCount(): number {
    return this.indexer.getInterfaceCount();
  }

  // Phase 6.5: Interface cross-reference methods (delegate to indexer)
  getInterfaceScriptRefs(parentId: number, childId: number): InterfaceScriptRef[] {
    return this.indexer.getInterfaceScriptRefs(parentId, childId);
  }

  getInterfaceVarbitRefs(parentId: number, childId: number): InterfaceVarbitRef[] {
    return this.indexer.getInterfaceVarbitRefs(parentId, childId);
  }

  getVarbitInterfaceRefs(varbitId: number): InterfaceVarbitRef[] {
    return this.indexer.getVarbitInterfaceRefs(varbitId);
  }

  // Phase 7: Analysis methods (delegate to indexer)
  getItemVariants(itemId: number): ItemVariantsResult | null {
    return this.indexer.getItemVariants(itemId);
  }

  findEquipmentByPrefix(prefix: string, slot?: number): EquipmentSetResult | null {
    return this.indexer.findEquipmentByPrefix(prefix, slot);
  }

  extractItemPrefix(itemName: string): string | null {
    return this.indexer.extractItemPrefix(itemName);
  }

  // Phase 7.5: Item sources method
  async findItemSources(itemId: number): Promise<ItemSourcesResult | null> {
    return this.indexer.findItemSources(itemId);
  }

  // Phase 8: Database methods (delegate to reader)
  async getTableRowIds(tableId: number): Promise<number[]> {
    return this.reader.getTableRowIds(tableId);
  }

  async getTableIndexedColumns(tableId: number): Promise<number[]> {
    return this.reader.getTableIndexedColumns(tableId);
  }

  async getColumnIndex(tableId: number, columnId: number): Promise<Map<string, number[]> | null> {
    return this.reader.getColumnIndex(tableId, columnId);
  }

  async listDbtableIds(): Promise<number[]> {
    return this.reader.listDbtableIds();
  }

  async listDbtableIndexIds(): Promise<number[]> {
    return this.reader.listDbtableIndexIds();
  }

  // Phase 8: Database search methods (delegate to indexer)
  searchDbrows(query: string, tableId?: number, limit?: number): DBRowIndexEntry[] {
    return this.indexer.searchDbrows(query, tableId, limit);
  }

  getDBTableMetadata(tableId: number): { rowCount: number; indexedCols: number[] } | null {
    return this.indexer.getDBTableMetadata(tableId);
  }

  getAllDBTableMetadata(): Map<number, { rowCount: number; indexedCols: number[] }> {
    return this.indexer.getAllDBTableMetadata();
  }

  // Phase 9: Export methods (delegate to indexer)
  getItemStatsExport(): ItemStatsExport[] {
    return this.indexer.getItemStatsExport();
  }

  async getNpcCombatExport(): Promise<NpcCombatExport[]> {
    return this.indexer.getNpcCombatExport();
  }

  getModelRefsExport(): ModelRefExport[] {
    return this.indexer.getModelRefsExport();
  }

  // Phase 10: Animation analysis methods (delegate to indexer)
  getSequenceEntry(id: number): SequenceIndexEntry | null {
    return this.indexer.getSequenceEntry(id);
  }

  getSequenceCount(): number {
    return this.indexer.getSequenceCount();
  }

  searchSequencesAdvanced(
    filter: SequenceAdvancedFilter,
    options?: { offset?: number; limit?: number }
  ): AdvancedSearchResult<SequenceAdvancedResult> {
    return this.indexer.searchSequencesAdvanced(filter, options);
  }

  findRelatedAnimations(animationId: number): RelatedAnimationsResult | null {
    return this.indexer.findRelatedAnimations(animationId);
  }

  getNpcAnimationEntries(npcDef: Record<string, unknown>): AnimationRoleEntry[] {
    return this.indexer.getNpcAnimationEntries(npcDef);
  }
}

export { CacheReader } from './reader.js';
export { CacheIndexer } from './indexer.js';
