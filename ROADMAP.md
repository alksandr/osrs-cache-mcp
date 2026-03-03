# OSRS Cache MCP Server - Development Roadmap

## Current State (v1.7)

The server currently exposes **43 tools** across 18 cache types:
- 22 lookup tools (items, NPCs, objects, enums, sequences, interfaces, structs, params, varbits, var_players, sprites, sprite frames, sprite groups, dbrows, dbtables, scripts, list_scripts, list_sprites, gamevals, list_gameval_categories, list_interfaces, get_interface_tree)
- 15 search tools (items, NPCs, objects, scripts by content, sprites by pattern, varbits, varbits by index, varbit script refs, gamevals, items_advanced, npcs_advanced, objects_advanced, interfaces, interfaces_by_action)
- 3 cross-reference tools (by model, animation, inventory model)
- 3 animation analysis tools (find_related_animations, search_sequences_advanced, get_npc_animations)

**Cache Statistics:**
- Items: 33,001 definitions
- NPCs: 15,535 definitions
- Objects: 60,601 definitions
- Sequences: 13,694 animations
- RS2ASM Scripts: 9,146 scripts (indexed & searchable)
- Sprites: 10,645 PNG files (6,816 root + 44 groups)
- Varbits: 19,650 definitions (indexed, 2,642 unique var_player indexes, 3,960 with script refs)
- Var_players: 16 definitions
- Game Values: 164,191 entries (indexed & searchable across 14 categories)
- Interfaces: 948 parent interfaces, 26,020 widgets (indexed & searchable by text/actions)

---

## Phase 1: Script Analysis Tools (COMPLETED)

**Goal:** Expose RS2ASM scripts for game logic reverse engineering

### Tasks

- [x] Add `rs2asm` to TYPE_TO_DIR mapping in `types.ts`
- [x] Implement `get_script(id)` - Fetch script by ID
  - Read from `rs2asm/{id}.rs2asm`
  - Include hash file content if available
- [x] Implement `search_scripts(query)` - Full-text search in script content
  - Build script content index on startup
  - Search opcode names, string literals, function calls
- [x] Implement `list_scripts()` - Enumerate all script IDs
- [ ] Add script cross-references to indexer (future enhancement)
  - Scripts that reference specific items/NPCs/objects
  - Scripts that use specific opcodes

### Files Modified
- `src/types.ts` - Added script types (CacheType, ScriptIndexEntry, ScriptSearchResult)
- `src/cache/reader.ts` - Added script reading methods (getScript, getScriptHash, listScriptIds)
- `src/cache/indexer.ts` - Added script indexing with full-text search
- `src/cache/index.ts` - Added CacheManager facade methods
- `src/tools/index.ts` - Registered 3 new tools (get_script, list_scripts, search_scripts)
- `src/tools/lookup.ts` - Added script lookup handlers
- `src/tools/search.ts` - Added script search handler

---

## Phase 2: Enhanced Sprite Support (COMPLETED)

**Goal:** Return actual sprite data, not just paths

### Tasks

- [x] Modify `get_sprite(id)` to return base64-encoded PNG
  - Read PNG file content
  - Encode as base64 data URI
  - Include dimensions metadata (extracted from PNG header)
- [x] Implement `search_sprites(pattern)` - Find sprites by ID pattern
  - Supports wildcards (* for any chars, ? for single char)
  - Returns both root sprites and sprite groups
- [x] Implement `get_sprite_group(group_id)` - Get all frames in a sprite group
  - Lists all frames with indices and paths
- [x] Implement `get_sprite_frame(group_id, frame)` - Get specific frame from group
  - Returns base64 PNG data with dimensions
- [x] Implement `list_sprites()` - Summary of all sprites
  - Shows root sprite count and group IDs

### Files Modified
- `src/types.ts` - Added sprite types (SpriteData, SpriteGroupEntry, SpriteSearchResult)
- `src/cache/reader.ts` - Added sprite methods (getSpriteData, getSpriteFrame, getSpriteGroup, listSpriteIds, searchSprites, extractPngDimensions)
- `src/cache/index.ts` - Added CacheManager facade methods for sprites
- `src/tools/lookup.ts` - Modified handleGetSprite, added handleGetSpriteFrame, handleGetSpriteGroup, handleSearchSprites, handleListSprites
- `src/tools/index.ts` - Registered 5 sprite tools (get_sprite updated + 4 new)

---

## Phase 3: Player Variables & Varbits (COMPLETED)

**Goal:** Complete variable system coverage

### Tasks

- [x] Implement `get_var_player(id)` - Fetch player variable definitions
  - Read from `var_players/` directory
- [x] Implement `search_varbits(query)` - Search varbit definitions
  - Search by ID, var_player index, or bit range pattern
- [x] Implement `find_varbits_by_index(index)` - Find varbits using same base var
  - Shows all varbits packed in a var_player with bit allocation
- [x] Add varbit cross-references
  - `get_varbit_script_refs(id)` - Which scripts read/write specific varbits
  - Indexed 3,960 varbits with script references

### Files Modified
- `src/types.ts` - Added var_player type, VarbitDef, VarPlayerDef, VarbitIndexEntry, VarbitSearchResult, VarbitScriptRef
- `src/cache/indexer.ts` - Added varbit indexing with var_player index lookup and script cross-refs
- `src/cache/index.ts` - Added CacheManager facade methods for varbits
- `src/tools/index.ts` - Registered 4 new tools (get_var_player, search_varbits, find_varbits_by_index, get_varbit_script_refs)
- `src/tools/lookup.ts` - Added get_var_player handler
- `src/tools/search.ts` - Added varbit search handlers

---

## Phase 4: Game Values System (COMPLETED)

**Goal:** Expose the 164,191 game value files

### Tasks

- [x] Analyze `gamevals/` directory structure
  - 14 category directories (0-15, skipping 5 and 13)
  - Categories map to entity types: items(0), npcs(1), inventories(2), structs(3), varbits(4), objects(6), sequences(7), spotanims(8), scripts(9), dbtables(10), music(11), enums(12), overlays(14), vars(15)
- [x] Implement `get_gameval(category, id)` - Fetch game value by category and ID
- [x] Implement `list_gameval_categories()` - List all categories with counts
- [x] Implement `search_gamevals(query)` - Search across all game values by name
  - Supports optional category filter
  - Shows entries with field definitions (dbtable schemas)
- [x] Build game value index with category metadata
  - 164,191 entries indexed on startup
  - Full-text search on entity names

### Files Modified
- `src/types.ts` - Added GAMEVAL_CATEGORIES mapping, GameValDef, GameValIndexEntry, GameValSearchResult, GameValCategoryInfo
- `src/cache/reader.ts` - Added getGameVal, listGameValCategories, listGameValIds, countGameVals, countAllGameVals
- `src/cache/indexer.ts` - Added buildGameValIndex, searchGameVals, getGameValCount, getGameValCategoryCounts (INDEX_VERSION bumped to 4)
- `src/cache/index.ts` - Added CacheManager facade methods for gamevals
- `src/tools/index.ts` - Registered 3 new tools (get_gameval, list_gameval_categories, search_gamevals)
- `src/tools/lookup.ts` - Added handleGetGameVal, handleListGameValCategories, handleSearchGameVals

---

## Phase 5: Advanced Search & Filtering (COMPLETED)

**Goal:** Enable complex queries beyond name matching

### Tasks

- [x] Implement `search_items_advanced(filters)`
  - Filter by: equipSlot (head, cape, neck, weapon, body, shield, legs, hands, feet, ring, ammo)
  - Filter by: tradeable, members, stackable (boolean filters)
  - Filter by: minValue, maxValue (cost range)
  - Filter by: minWeight, maxWeight (weight range in grams)
  - Filter by stat bonuses: minAttackStab/Slash/Crush/Magic/Ranged, minDefenceStab/Slash/Crush/Magic/Ranged, minMeleeStrength, minRangedStrength, minMagicDamage, minPrayer
- [x] Implement `search_npcs_advanced(filters)`
  - Filter by: minCombatLevel, maxCombatLevel (combat level range)
  - Filter by: hasAction (specific action like "Attack", "Talk-to", "Pickpocket")
  - Filter by: attackable (has "Attack" action)
  - Filter by: size (NPC tile size)
  - Filter by: interactable
- [x] Implement `search_objects_advanced(filters)`
  - Filter by: hasAction (e.g., "Open", "Mine", "Chop down", "Bank")
  - Filter by: blocksProjectile
  - Filter by: interactable (interactType > 0)
  - Filter by: minSizeX, maxSizeX, minSizeY, maxSizeY (object dimensions)
- [x] Add pagination support to advanced search tools
  - `offset` and `limit` parameters
  - Returns total count with results

### Files Modified
- `src/types.ts` - Added filter types (ItemAdvancedFilter, NpcAdvancedFilter, ObjectAdvancedFilter), index entry types (ItemIndexEntry, NpcIndexEntry, ObjectIndexEntry), result types (ItemAdvancedResult, NpcAdvancedResult, ObjectAdvancedResult, AdvancedSearchResult), equipment slot mappings (EQUIPMENT_SLOTS, SLOT_TO_WEARPOS), stat param IDs (ITEM_STAT_PARAMS)
- `src/cache/indexer.ts` - Added enhanced indexes (itemAdvancedIndex, npcAdvancedIndex, objectAdvancedIndex), build methods, advanced search methods (INDEX_VERSION bumped to 5)
- `src/cache/index.ts` - Added CacheManager facade methods for advanced search
- `src/tools/search.ts` - Added handleSearchItemsAdvanced, handleSearchNpcsAdvanced, handleSearchObjectsAdvanced handlers
- `src/tools/index.ts` - Registered 3 new tools (search_items_advanced, search_npcs_advanced, search_objects_advanced)

---

## Phase 6: Interface Deep Dive (COMPLETED)

**Goal:** Full UI widget exploration

### Tasks

- [x] Implement `list_interfaces()` - Get all top-level interface IDs
  - Returns 948 parent interfaces with child counts
  - Shows top interfaces by widget count
- [x] Implement `get_interface_tree(parent)` - Full widget hierarchy
  - Returns all children for a parent interface
  - Groups by widget type (container, text, sprite, model, etc.)
  - Shows widgets with text and actions
  - Optional detailed view with sprite/model IDs
- [x] Implement `search_interfaces(query)` - Search by widget text content
  - Full-text search across 26,020 widgets
  - Filter by widget type (0=container, 3=rectangle, 4=text, 5=sprite, 6=model)
  - Filter by has_action
- [x] Implement `find_interfaces_by_action(action)` - Find widgets with specific actions
  - Case-insensitive partial match on action strings
  - Finds buttons, menu items, interactive elements
- [ ] Add interface cross-references (deferred to Phase 6.5)
  - Which scripts modify interfaces
  - Which varbits display in interfaces

### Files Modified
- `src/types.ts` - Added INTERFACE_TYPES mapping, InterfaceIndexEntry, InterfaceSearchResult, InterfaceTreeNode, InterfaceParentInfo
- `src/cache/reader.ts` - Added listInterfaceParents, listInterfaceChildren, getInterfaceTree, countAllInterfaces
- `src/cache/indexer.ts` - Added buildInterfaceIndex, searchInterfaces, findInterfacesByAction, getInterfaceCount (INDEX_VERSION bumped to 6)
- `src/cache/index.ts` - Added CacheManager facade methods for interfaces
- `src/tools/interface.ts` - **NEW FILE** - Interface-specific handlers (handleListInterfaces, handleGetInterfaceTree, handleSearchInterfaces, handleFindInterfacesByAction)
- `src/tools/index.ts` - Registered 4 new tools (list_interfaces, get_interface_tree, search_interfaces, find_interfaces_by_action)

---

## Phase 7: Relationship & Analysis Tools

**Goal:** Cross-entity intelligence

### Tasks

- [ ] Implement `find_item_sources(item_id)`
  - NPCs that drop the item
  - Objects that contain the item
  - Shops that sell the item
- [ ] Implement `find_item_variants(item_id)`
  - Items sharing same base model
  - Noted/unnoted pairs
  - Charged/uncharged variants
- [ ] Implement `find_equipment_set(item_id)`
  - Items with matching name patterns
  - Items from same content update
- [ ] Implement `analyze_npc(npc_id)`
  - Combat stats analysis
  - Attack styles and speeds
  - Potential drop value

### Files to Modify
- `src/cache/indexer.ts` - Add relationship indexes
- New file: `src/tools/analysis.ts` - Analysis handlers
- `src/tools/index.ts` - Register new tools

---

## Phase 8: Database Deep Dive

**Goal:** Full database system support

### Tasks

- [ ] Implement `list_dbtables()` - Enumerate all database tables
- [ ] Implement `get_dbtable_schema(table_id)` - Detailed schema with column types
- [ ] Implement `query_dbtable(table_id, filters)` - Filter rows by column values
- [ ] Implement `search_dbrows(query)` - Full-text search across all rows
- [ ] Utilize `dbtable_index/` files for optimized lookups

### Files to Modify
- `src/cache/reader.ts` - Add database query methods
- `src/cache/indexer.ts` - Add database indexing
- `src/tools/lookup.ts` - Add database handlers

---

## Phase 9: Export & Visualization

**Goal:** Data export for external tools

### Tasks

- [ ] Implement `export_item_stats()` - CSV/JSON of all item combat stats
- [ ] Implement `export_npc_combat()` - CSV/JSON of all NPC combat data
- [ ] Implement `export_model_references()` - Model usage across all entities
- [ ] Add model metadata extraction
  - Vertex/face counts
  - Texture references
  - Bounding box dimensions

### Files to Modify
- New file: `src/tools/export.ts` - Export handlers
- `src/tools/index.ts` - Register new tools

---

## Phase 10: Animation & Sequence Analysis (COMPLETED)

**Goal:** Deep animation analysis, related animation discovery, and NPC animation profiling

### Tasks

- [x] Build sequence index on startup (all 13,694 animations indexed with type, duration, priority, sounds, hand items, frame group, Maya ID)
- [x] Implement `find_related_animations(animation_id)` - Find related animations
  - Other animations used by the same NPCs/objects
  - Animations sharing the same frame group (archive ID)
  - Groups results by entity showing animation roles
  - Shows all unique related animation IDs
- [x] Implement `search_sequences_advanced(filters)` - Advanced animation search
  - Filter by type: skeletal (BA2/Maya) or frame (classic)
  - Filter by duration, frame count, priority ranges
  - Filter by sound effects, hand items
  - Filter by frame group or Maya animation ID
  - Filter by NPC name or object name (partial match)
  - Pagination support
- [x] Implement `get_npc_animations(npc_id)` - Comprehensive NPC animation view
  - All definition-level animations (idle, walk, run, rotate, crawl, idle rotate)
  - Per-animation: sequence type, frame count, duration, priority, sounds
  - Transform/morph variant animations (if NPC has multiple forms)
  - Summary of all unique animation IDs

### Files Modified
- `src/types.ts` - Added SequenceIndexEntry, SequenceType, SequenceAdvancedFilter, SequenceAdvancedResult, RelatedAnimationsResult, NpcAnimationsResult, AnimationRoleEntry, AnimationRole
- `src/cache/indexer.ts` - Added buildSequenceIndex, getSequenceEntry, searchSequencesAdvanced, findRelatedAnimations, getNpcAnimationEntries (INDEX_VERSION bumped to 11)
- `src/cache/index.ts` - Added CacheManager facade methods for animation analysis
- `src/tools/animation.ts` - **NEW FILE** - Animation tool handlers (handleFindRelatedAnimations, handleSearchSequencesAdvanced, handleGetNpcAnimations)
- `src/tools/index.ts` - Registered 3 new tools

---

## Phase 11: Version & Diff Support

**Goal:** Track cache changes over time

### Tasks

- [ ] Support multiple cache versions in config
- [ ] Implement `compare_versions(type, id, v1, v2)` - Diff between versions
- [ ] Implement `find_changes(type, v1, v2)` - List all changes between versions
- [ ] Implement `get_version_history(type, id)` - Change history for entity

### Files to Modify
- `src/config.ts` - Multi-version config support
- `src/cache/reader.ts` - Version-aware reading
- New file: `src/tools/versioning.ts` - Version handlers

---

## Future Considerations

### Performance Optimizations
- SQLite-backed indexes for faster startup
- Lazy index building per cache type
- Memory-mapped file access for large caches

### Integration Features
- WebSocket support for real-time updates
- REST API wrapper for non-MCP clients
- Plugin system for custom analyzers

### Community Features
- Wiki integration for entity descriptions
- GE price data integration
- Drop rate database integration

---

## Contributing

When implementing new features:

1. Add types to `src/types.ts`
2. Add reading logic to `src/cache/reader.ts`
3. Add indexing logic to `src/cache/indexer.ts` (if searchable)
4. Add tool handlers to appropriate file in `src/tools/`
5. Register tools in `src/tools/index.ts`
6. Update this roadmap with completion status

---

*Last updated: March 2026 (v1.7 - Phase 10 complete)*
