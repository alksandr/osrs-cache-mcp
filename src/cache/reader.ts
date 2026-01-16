import * as fs from 'fs/promises';
import * as path from 'path';
import { CacheType, TYPE_TO_DIR, SpriteData, SpriteGroupEntry, GameValDef, GAMEVAL_CATEGORIES, InterfaceTreeNode, InterfaceParentInfo, INTERFACE_TYPES, DBTableIndexData } from '../types.js';

export class CacheReader {
  constructor(private cachePath: string) {}

  /**
   * Get a cache definition by type and ID (direct file read - fastest)
   */
  async getById(type: CacheType, id: number): Promise<object | null> {
    const dir = TYPE_TO_DIR[type];
    if (!dir) throw new Error(`Unknown cache type: ${type}`);

    const filePath = path.join(this.cachePath, dir, `${id}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Get an interface widget definition by parent and child ID
   */
  async getInterface(parent: number, child: number): Promise<object | null> {
    const filePath = path.join(
      this.cachePath,
      'interface_defs',
      String(parent),
      `${child}.json`
    );
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Get sprite file path by ID
   */
  async getSpritePath(id: number): Promise<string | null> {
    const filePath = path.join(this.cachePath, 'sprites', `${id}.png`);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  /**
   * Extract dimensions from PNG header
   * PNG format: 8-byte signature, then IHDR chunk with width at offset 16, height at offset 20
   */
  private extractPngDimensions(buffer: Buffer): { width: number; height: number } {
    // PNG header: 8 bytes signature + 4 bytes chunk length + 4 bytes chunk type (IHDR)
    // Then: 4 bytes width + 4 bytes height
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  /**
   * Get sprite data with base64 content and dimensions
   */
  async getSpriteData(id: number): Promise<SpriteData | null> {
    // First try root-level sprite
    const rootPath = path.join(this.cachePath, 'sprites', `${id}.png`);
    try {
      const buffer = await fs.readFile(rootPath);
      const { width, height } = this.extractPngDimensions(buffer);
      const base64 = buffer.toString('base64');
      return {
        id,
        width,
        height,
        dataUri: `data:image/png;base64,${base64}`,
        path: rootPath
      };
    } catch {
      // Not a root-level sprite, check if it's a group directory
      const groupPath = path.join(this.cachePath, 'sprites', String(id));
      try {
        const stat = await fs.stat(groupPath);
        if (stat.isDirectory()) {
          // It's a group - return the first frame (0.png)
          const framePath = path.join(groupPath, '0.png');
          const buffer = await fs.readFile(framePath);
          const { width, height } = this.extractPngDimensions(buffer);
          const base64 = buffer.toString('base64');
          return {
            id,
            width,
            height,
            dataUri: `data:image/png;base64,${base64}`,
            path: framePath,
            groupId: id,
            frameIndex: 0
          };
        }
      } catch {
        return null;
      }
      return null;
    }
  }

  /**
   * Get a specific frame from a sprite group
   */
  async getSpriteFrame(groupId: number, frameIndex: number): Promise<SpriteData | null> {
    const framePath = path.join(this.cachePath, 'sprites', String(groupId), `${frameIndex}.png`);
    try {
      const buffer = await fs.readFile(framePath);
      const { width, height } = this.extractPngDimensions(buffer);
      const base64 = buffer.toString('base64');
      return {
        id: groupId,
        width,
        height,
        dataUri: `data:image/png;base64,${base64}`,
        path: framePath,
        groupId,
        frameIndex
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all frames in a sprite group
   */
  async getSpriteGroup(groupId: number): Promise<SpriteGroupEntry[]> {
    const groupPath = path.join(this.cachePath, 'sprites', String(groupId));
    try {
      const files = await fs.readdir(groupPath);
      const frames = files
        .filter(f => f.endsWith('.png'))
        .map(f => parseInt(f.replace('.png', '')))
        .filter(idx => !isNaN(idx))
        .sort((a, b) => a - b);

      return frames.map(frameIndex => ({
        id: groupId,
        frameIndex,
        path: path.join(groupPath, `${frameIndex}.png`)
      }));
    } catch {
      return [];
    }
  }

  /**
   * List all sprite IDs (both root-level and group directories)
   */
  async listSpriteIds(): Promise<{ rootSprites: number[]; groups: number[] }> {
    const spritesPath = path.join(this.cachePath, 'sprites');
    try {
      const entries = await fs.readdir(spritesPath, { withFileTypes: true });

      const rootSprites: number[] = [];
      const groups: number[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.png')) {
          const id = parseInt(entry.name.replace('.png', ''));
          if (!isNaN(id)) rootSprites.push(id);
        } else if (entry.isDirectory()) {
          const id = parseInt(entry.name);
          if (!isNaN(id)) groups.push(id);
        }
      }

      return {
        rootSprites: rootSprites.sort((a, b) => a - b),
        groups: groups.sort((a, b) => a - b)
      };
    } catch {
      return { rootSprites: [], groups: [] };
    }
  }

  /**
   * Search sprites by ID pattern (glob-like matching)
   */
  async searchSprites(pattern: string, limit = 25): Promise<Array<{ id: number; isGroup: boolean; frameCount?: number }>> {
    const { rootSprites, groups } = await this.listSpriteIds();
    const results: Array<{ id: number; isGroup: boolean; frameCount?: number }> = [];

    // Convert pattern to regex
    // Support patterns like "10*" for IDs starting with 10, "*99" for ending with 99
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    // Search root sprites
    for (const id of rootSprites) {
      if (regex.test(String(id))) {
        results.push({ id, isGroup: false });
        if (results.length >= limit) return results;
      }
    }

    // Search groups
    for (const id of groups) {
      if (regex.test(String(id))) {
        const groupEntries = await this.getSpriteGroup(id);
        results.push({ id, isGroup: true, frameCount: groupEntries.length });
        if (results.length >= limit) return results;
      }
    }

    return results;
  }

  /**
   * Get RS2ASM script content by ID
   */
  async getScript(id: number): Promise<string | null> {
    const filePath = path.join(this.cachePath, 'rs2asm', `${id}.rs2asm`);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Get RS2ASM script hash by ID
   */
  async getScriptHash(id: number): Promise<string | null> {
    const filePath = path.join(this.cachePath, 'rs2asm', `${id}.hash`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.trim();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * List all available script IDs
   */
  async listScriptIds(): Promise<number[]> {
    const dirPath = path.join(this.cachePath, 'rs2asm');
    try {
      const files = await fs.readdir(dirPath);
      return files
        .filter(f => f.endsWith('.rs2asm'))
        .map(f => parseInt(f.replace('.rs2asm', '')))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * Count script files
   */
  async countScripts(): Promise<number> {
    const dirPath = path.join(this.cachePath, 'rs2asm');
    try {
      const files = await fs.readdir(dirPath);
      return files.filter(f => f.endsWith('.rs2asm')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get multiple definitions of the same type by ID array
   */
  async getMultiple(type: CacheType, ids: number[]): Promise<Map<number, object>> {
    const results = new Map<number, object>();
    await Promise.all(
      ids.map(async (id) => {
        const data = await this.getById(type, id);
        if (data) results.set(id, data);
      })
    );
    return results;
  }

  /**
   * List all available IDs for a cache type
   */
  async listIds(type: CacheType): Promise<number[]> {
    const dir = TYPE_TO_DIR[type];
    if (!dir) throw new Error(`Unknown cache type: ${type}`);

    const dirPath = path.join(this.cachePath, dir);
    try {
      const files = await fs.readdir(dirPath);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => parseInt(f.replace('.json', '')))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * Count files in a cache directory
   */
  async countFiles(type: CacheType): Promise<number> {
    const dir = TYPE_TO_DIR[type];
    if (!dir) throw new Error(`Unknown cache type: ${type}`);

    const dirPath = path.join(this.cachePath, dir);
    try {
      const files = await fs.readdir(dirPath);
      return files.filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    const types = Object.keys(TYPE_TO_DIR) as CacheType[];

    await Promise.all(
      types.map(async (type) => {
        stats[type] = await this.countFiles(type);
      })
    );

    // Also count sprites
    try {
      const spriteDir = path.join(this.cachePath, 'sprites');
      const sprites = await fs.readdir(spriteDir);
      stats['sprite'] = sprites.filter(f => f.endsWith('.png')).length;
    } catch {
      stats['sprite'] = 0;
    }

    // Count interface parents
    try {
      const interfaceDir = path.join(this.cachePath, 'interface_defs');
      const parents = await fs.readdir(interfaceDir);
      stats['interface'] = parents.filter(p => !p.includes('.')).length;
    } catch {
      stats['interface'] = 0;
    }

    // Count scripts
    stats['script'] = await this.countScripts();

    // Count gamevals
    stats['gameval'] = await this.countAllGameVals();

    return stats;
  }

  // ============================================
  // Game Values Methods
  // ============================================

  /**
   * Get a game value by category and ID
   */
  async getGameVal(category: number, id: number): Promise<GameValDef | null> {
    const filePath = path.join(this.cachePath, 'gamevals', String(category), String(id));
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as GameValDef;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * List all game value categories
   */
  async listGameValCategories(): Promise<Array<{ category: number; name: string; count: number }>> {
    const results: Array<{ category: number; name: string; count: number }> = [];
    const gamevalsDir = path.join(this.cachePath, 'gamevals');

    try {
      const dirs = await fs.readdir(gamevalsDir, { withFileTypes: true });

      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const category = parseInt(dir.name);
          if (!isNaN(category)) {
            const categoryPath = path.join(gamevalsDir, dir.name);
            const files = await fs.readdir(categoryPath);
            const count = files.length;
            const name = GAMEVAL_CATEGORIES[category] || `unknown_${category}`;
            results.push({ category, name, count });
          }
        }
      }
    } catch {
      return [];
    }

    return results.sort((a, b) => a.category - b.category);
  }

  /**
   * List all game value IDs in a category
   */
  async listGameValIds(category: number): Promise<number[]> {
    const categoryDir = path.join(this.cachePath, 'gamevals', String(category));
    try {
      const files = await fs.readdir(categoryDir);
      return files
        .map(f => parseInt(f))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * Count game values in a category
   */
  async countGameVals(category: number): Promise<number> {
    const categoryDir = path.join(this.cachePath, 'gamevals', String(category));
    try {
      const files = await fs.readdir(categoryDir);
      return files.length;
    } catch {
      return 0;
    }
  }

  /**
   * Count all game values across all categories
   */
  async countAllGameVals(): Promise<number> {
    let total = 0;
    const gamevalsDir = path.join(this.cachePath, 'gamevals');

    try {
      const dirs = await fs.readdir(gamevalsDir, { withFileTypes: true });

      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const category = parseInt(dir.name);
          if (!isNaN(category)) {
            total += await this.countGameVals(category);
          }
        }
      }
    } catch {
      return 0;
    }

    return total;
  }

  // ============================================
  // Phase 6: Interface Methods
  // ============================================

  /**
   * List all parent interface IDs with child counts
   */
  async listInterfaceParents(): Promise<InterfaceParentInfo[]> {
    const interfaceDir = path.join(this.cachePath, 'interface_defs');
    const results: InterfaceParentInfo[] = [];

    try {
      const dirs = await fs.readdir(interfaceDir, { withFileTypes: true });

      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const parentId = parseInt(dir.name);
          if (!isNaN(parentId)) {
            const parentPath = path.join(interfaceDir, dir.name);
            const children = await fs.readdir(parentPath);
            const childCount = children.filter(f => f.endsWith('.json')).length;
            results.push({ parentId, childCount });
          }
        }
      }
    } catch {
      return [];
    }

    return results.sort((a, b) => a.parentId - b.parentId);
  }

  /**
   * List all child IDs for a parent interface
   */
  async listInterfaceChildren(parent: number): Promise<number[]> {
    const parentDir = path.join(this.cachePath, 'interface_defs', String(parent));
    try {
      const files = await fs.readdir(parentDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => parseInt(f.replace('.json', '')))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * Get interface tree for a parent - all children with hierarchy info
   */
  async getInterfaceTree(parent: number): Promise<InterfaceTreeNode | null> {
    const childIds = await this.listInterfaceChildren(parent);
    if (childIds.length === 0) return null;

    // Load all child interfaces
    const interfaces: Map<number, Record<string, unknown>> = new Map();
    for (const childId of childIds) {
      const iface = await this.getInterface(parent, childId);
      if (iface) {
        interfaces.set(childId, iface as Record<string, unknown>);
      }
    }

    // Build tree - find root node (child 0) and build hierarchy
    // Note: Interface parentId field refers to the internal UI hierarchy, not our tree
    // For simplicity, we return a flat list organized by child ID

    const rootNode: InterfaceTreeNode = {
      parentId: parent,
      childId: -1,  // Virtual root
      type: 0,
      typeName: 'root',
      children: []
    };

    // Convert interfaces to tree nodes
    for (const [childId, iface] of interfaces) {
      const type = (iface.type as number) ?? 0;
      const node: InterfaceTreeNode = {
        parentId: parent,
        childId,
        type,
        typeName: INTERFACE_TYPES[type] || `type_${type}`,
        children: []
      };

      // Add text if present
      const text = iface.text as string | undefined;
      if (text && text.length > 0) {
        node.text = text;
      }

      // Add actions if present
      const actions = iface.actions as string[] | undefined;
      if (actions && actions.length > 0) {
        const nonNullActions = actions.filter(a => a && a.length > 0);
        if (nonNullActions.length > 0) {
          node.actions = nonNullActions;
        }
      }

      // Add sprite if present
      const spriteId = iface.spriteId as number | undefined;
      if (spriteId !== undefined && spriteId >= 0) {
        node.spriteId = spriteId;
      }

      // Add model if present
      const modelId = iface.modelId as number | undefined;
      if (modelId !== undefined && modelId >= 0) {
        node.modelId = modelId;
      }

      rootNode.children.push(node);
    }

    return rootNode;
  }

  /**
   * Count total interface files across all parents
   */
  async countAllInterfaces(): Promise<number> {
    const parents = await this.listInterfaceParents();
    return parents.reduce((sum, p) => sum + p.childCount, 0);
  }

  // ============================================
  // Phase 8: Database Methods
  // ============================================

  /**
   * Get row IDs for a table from master.json
   */
  async getTableRowIds(tableId: number): Promise<number[]> {
    const masterPath = path.join(this.cachePath, 'dbtable_index', String(tableId), 'master.json');
    try {
      const content = await fs.readFile(masterPath, 'utf-8');
      const data = JSON.parse(content) as DBTableIndexData;
      // Row IDs are in tupleIndexes[0]["0"]
      if (data.tupleIndexes && data.tupleIndexes.length > 0) {
        return data.tupleIndexes[0]['0'] || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Get indexed column IDs for a table (columns with index files)
   */
  async getTableIndexedColumns(tableId: number): Promise<number[]> {
    const indexDir = path.join(this.cachePath, 'dbtable_index', String(tableId));
    try {
      const files = await fs.readdir(indexDir);
      return files
        .filter(f => f.endsWith('.json') && f !== 'master.json')
        .map(f => parseInt(f.replace('.json', '')))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * Get column index (value -> rowIds mapping)
   */
  async getColumnIndex(tableId: number, columnId: number): Promise<Map<string, number[]> | null> {
    const indexPath = path.join(this.cachePath, 'dbtable_index', String(tableId), `${columnId}.json`);
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      const data = JSON.parse(content) as DBTableIndexData;
      if (data.tupleIndexes && data.tupleIndexes.length > 0) {
        return new Map(Object.entries(data.tupleIndexes[0]));
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * List all dbtable IDs
   */
  async listDbtableIds(): Promise<number[]> {
    const dirPath = path.join(this.cachePath, 'dbtable');
    try {
      const files = await fs.readdir(dirPath);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => parseInt(f.replace('.json', '')))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * List all dbtable_index directories (tables with indexes)
   */
  async listDbtableIndexIds(): Promise<number[]> {
    const dirPath = path.join(this.cachePath, 'dbtable_index');
    try {
      const dirs = await fs.readdir(dirPath, { withFileTypes: true });
      return dirs
        .filter(d => d.isDirectory())
        .map(d => parseInt(d.name))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }
}
