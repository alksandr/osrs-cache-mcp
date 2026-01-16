import { CacheManager } from '../cache/index.js';
import { ToolResponse, DB_TYPE_DESCRIPTIONS, DBQueryFilter } from '../types.js';

/**
 * List all database tables with column/row counts and indexed columns
 */
export async function handleListDbtables(
  cache: CacheManager,
  args: { limit?: number }
): Promise<ToolResponse> {
  const limit = args.limit ?? 50;

  // Get all table IDs
  const tableIds = await cache.listDbtableIds();
  const metadata = cache.getAllDBTableMetadata();

  // Build table summaries
  const summaries: Array<{
    id: number;
    columnCount: number;
    rowCount: number;
    indexedColumns: number[];
  }> = [];

  for (const id of tableIds) {
    const table = await cache.getById('dbtable', id) as {
      id: number;
      types: (string[] | null)[];
    } | null;

    if (!table) continue;

    // Count non-null columns
    const columnCount = table.types ? table.types.filter(t => t !== null).length : 0;

    // Get metadata from index
    const meta = metadata.get(id);
    const rowCount = meta?.rowCount ?? 0;
    const indexedColumns = meta?.indexedCols ?? [];

    summaries.push({
      id,
      columnCount,
      rowCount,
      indexedColumns
    });
  }

  // Sort by row count descending
  summaries.sort((a, b) => b.rowCount - a.rowCount);

  // Apply limit
  const limited = summaries.slice(0, limit);

  const lines: string[] = [
    `Found ${tableIds.length} database tables:`,
    ''
  ];

  for (const t of limited) {
    const indexedStr = t.indexedColumns.length > 0
      ? ` (indexed: ${t.indexedColumns.join(', ')})`
      : '';
    lines.push(`Table ${t.id}: ${t.columnCount} columns, ${t.rowCount} rows${indexedStr}`);
  }

  if (summaries.length > limit) {
    lines.push('', `... and ${summaries.length - limit} more tables`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Get detailed schema for a database table with human-readable column types
 */
export async function handleGetDbtableSchema(
  cache: CacheManager,
  args: { table_id: number; include_sample?: boolean }
): Promise<ToolResponse> {
  const table = await cache.getById('dbtable', args.table_id) as {
    id: number;
    types: (string[] | null)[];
    defaultColumnValues: (unknown[] | null)[];
  } | null;

  if (!table) {
    return {
      content: [{ type: 'text', text: `Table ${args.table_id} not found` }],
      isError: true
    };
  }

  // Get metadata for row count and indexed columns
  const meta = cache.getDBTableMetadata(args.table_id);
  const indexedCols = new Set(meta?.indexedCols ?? []);

  const lines: string[] = [
    `Database Table ${args.table_id}`,
    `Row count: ${meta?.rowCount ?? 'unknown'}`,
    '',
    'Columns:'
  ];

  for (let i = 0; i < table.types.length; i++) {
    const colTypes = table.types[i];
    const defaultVal = table.defaultColumnValues?.[i];

    if (colTypes === null) {
      continue; // Skip null columns
    }

    // Format column types with descriptions
    const typeDescriptions = colTypes.map(t => {
      const desc = DB_TYPE_DESCRIPTIONS[t];
      return desc ? `${t} (${desc})` : t;
    });

    const isIndexed = indexedCols.has(i) ? ' [indexed]' : '';
    const defaultStr = defaultVal !== null && defaultVal !== undefined
      ? ` default: ${JSON.stringify(defaultVal)}`
      : '';

    lines.push(`  Column ${i}: ${typeDescriptions.join(', ')}${isIndexed}${defaultStr}`);
  }

  // Include sample row if requested
  if (args.include_sample) {
    const rowIds = await cache.getTableRowIds(args.table_id);
    if (rowIds.length > 0) {
      const sampleRow = await cache.getById('dbrow', rowIds[0]) as {
        id: number;
        columnValues: (unknown[] | null)[];
      } | null;

      if (sampleRow) {
        lines.push('', `Sample row (ID ${sampleRow.id}):`);
        for (let i = 0; i < (sampleRow.columnValues?.length ?? 0); i++) {
          const val = sampleRow.columnValues?.[i];
          if (val !== null && val !== undefined) {
            lines.push(`  Column ${i}: ${JSON.stringify(val)}`);
          }
        }
      }
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Get all rows belonging to a specific table with pagination
 */
export async function handleGetTableRows(
  cache: CacheManager,
  args: { table_id: number; offset?: number; limit?: number }
): Promise<ToolResponse> {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 25;

  // Get row IDs from master.json
  const rowIds = await cache.getTableRowIds(args.table_id);

  if (rowIds.length === 0) {
    return {
      content: [{ type: 'text', text: `No rows found for table ${args.table_id}` }]
    };
  }

  // Apply pagination
  const pagedIds = rowIds.slice(offset, offset + limit);

  // Load rows
  const rows: Array<{ id: number; values: (unknown[] | null)[] }> = [];
  for (const id of pagedIds) {
    const row = await cache.getById('dbrow', id) as {
      id: number;
      columnValues: (unknown[] | null)[];
    } | null;

    if (row) {
      rows.push({
        id: row.id,
        values: row.columnValues
      });
    }
  }

  const lines: string[] = [
    `Table ${args.table_id} rows (${offset + 1}-${offset + rows.length} of ${rowIds.length}):`,
    ''
  ];

  for (const row of rows) {
    // Build a summary of non-null values
    const valueSummary: string[] = [];
    for (let i = 0; i < row.values.length; i++) {
      const val = row.values[i];
      if (val !== null && val !== undefined) {
        const valStr = Array.isArray(val)
          ? val.length > 3
            ? `[${val.slice(0, 3).join(', ')}, ...]`
            : `[${val.join(', ')}]`
          : String(val);
        // Truncate long strings
        const truncated = valStr.length > 50 ? valStr.slice(0, 47) + '...' : valStr;
        valueSummary.push(`${i}:${truncated}`);
      }
    }

    lines.push(`Row ${row.id}: {${valueSummary.slice(0, 5).join(', ')}${valueSummary.length > 5 ? ', ...' : ''}}`);
  }

  if (offset + limit < rowIds.length) {
    lines.push('', `Use offset=${offset + limit} to see more rows`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Query database table with filters using pre-built indexes when available
 */
export async function handleQueryDbtable(
  cache: CacheManager,
  args: { table_id: number; filters: DBQueryFilter[]; offset?: number; limit?: number }
): Promise<ToolResponse> {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 25;
  const filters = args.filters || [];

  if (filters.length === 0) {
    // No filters, just get all rows
    return handleGetTableRows(cache, { table_id: args.table_id, offset, limit });
  }

  // Get indexed columns for this table
  const indexedColumns = await cache.getTableIndexedColumns(args.table_id);
  const indexedSet = new Set(indexedColumns);

  // Start with all row IDs
  let candidateRows: Set<number> | null = null;

  // Process filters - use indexes for 'eq' filters on indexed columns
  for (const filter of filters) {
    if (filter.operator === 'eq' && indexedSet.has(filter.column)) {
      // Use pre-built index for equality filter
      const columnIndex = await cache.getColumnIndex(args.table_id, filter.column);
      if (columnIndex) {
        const valueKey = String(filter.value);
        const matchingRows = columnIndex.get(valueKey) || [];

        if (candidateRows === null) {
          candidateRows = new Set(matchingRows);
        } else {
          // Intersect with existing candidates
          const newSet = new Set<number>();
          for (const id of matchingRows) {
            if (candidateRows.has(id)) {
              newSet.add(id);
            }
          }
          candidateRows = newSet;
        }
      }
    }
  }

  // If no indexed filters were used, start with all rows
  if (candidateRows === null) {
    const allRows = await cache.getTableRowIds(args.table_id);
    candidateRows = new Set(allRows);
  }

  // Apply remaining filters in-memory
  const results: Array<{ id: number; values: (unknown[] | null)[] }> = [];
  const candidateArray = Array.from(candidateRows);

  for (const rowId of candidateArray) {
    const row = await cache.getById('dbrow', rowId) as {
      id: number;
      columnValues: (unknown[] | null)[];
    } | null;

    if (!row) continue;

    // Check all filters
    let matches = true;
    for (const filter of filters) {
      const colVal = row.columnValues?.[filter.column];
      if (colVal === null || colVal === undefined) {
        matches = false;
        break;
      }

      // Get the first value if it's an array
      const val = Array.isArray(colVal) ? colVal[0] : colVal;

      switch (filter.operator) {
        case 'eq':
          if (val != filter.value) matches = false;
          break;
        case 'neq':
          if (val == filter.value) matches = false;
          break;
        case 'gt':
          if (typeof val !== 'number' || val <= Number(filter.value)) matches = false;
          break;
        case 'gte':
          if (typeof val !== 'number' || val < Number(filter.value)) matches = false;
          break;
        case 'lt':
          if (typeof val !== 'number' || val >= Number(filter.value)) matches = false;
          break;
        case 'lte':
          if (typeof val !== 'number' || val > Number(filter.value)) matches = false;
          break;
        case 'contains':
          if (typeof val !== 'string' || !val.toLowerCase().includes(String(filter.value).toLowerCase())) {
            // Also check all values in the array
            if (Array.isArray(colVal)) {
              const found = colVal.some(v =>
                typeof v === 'string' && v.toLowerCase().includes(String(filter.value).toLowerCase())
              );
              if (!found) matches = false;
            } else {
              matches = false;
            }
          }
          break;
      }

      if (!matches) break;
    }

    if (matches) {
      results.push({
        id: row.id,
        values: row.columnValues
      });
    }

    // Early exit if we have enough results for pagination
    if (results.length >= offset + limit + 100) break;
  }

  // Apply pagination
  const paged = results.slice(offset, offset + limit);

  const lines: string[] = [
    `Query results for table ${args.table_id} (${paged.length} shown, ${results.length} total matches):`,
    ''
  ];

  for (const row of paged) {
    const valueSummary: string[] = [];
    for (let i = 0; i < row.values.length; i++) {
      const val = row.values[i];
      if (val !== null && val !== undefined) {
        const valStr = Array.isArray(val)
          ? val.length > 3
            ? `[${val.slice(0, 3).join(', ')}, ...]`
            : `[${val.join(', ')}]`
          : String(val);
        const truncated = valStr.length > 50 ? valStr.slice(0, 47) + '...' : valStr;
        valueSummary.push(`${i}:${truncated}`);
      }
    }

    lines.push(`Row ${row.id}: {${valueSummary.slice(0, 5).join(', ')}${valueSummary.length > 5 ? ', ...' : ''}}`);
  }

  if (offset + limit < results.length) {
    lines.push('', `Use offset=${offset + limit} to see more results`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}

/**
 * Full-text search across all STRING column values in dbrows
 */
export async function handleSearchDbrows(
  cache: CacheManager,
  args: { query: string; table_id?: number; limit?: number }
): Promise<ToolResponse> {
  const limit = args.limit ?? 25;

  const results = cache.searchDbrows(args.query, args.table_id, limit);

  if (results.length === 0) {
    const tableFilter = args.table_id !== undefined ? ` in table ${args.table_id}` : '';
    return {
      content: [{ type: 'text', text: `No dbrows found matching "${args.query}"${tableFilter}` }]
    };
  }

  const lines: string[] = [
    args.table_id !== undefined
      ? `Found ${results.length} dbrows matching "${args.query}" in table ${args.table_id}:`
      : `Found ${results.length} dbrows matching "${args.query}":`,
    ''
  ];

  for (const entry of results) {
    // Truncate the search text for display
    const textPreview = entry.searchText.length > 80
      ? entry.searchText.slice(0, 77) + '...'
      : entry.searchText;
    lines.push(`Row ${entry.id} (table ${entry.tableId}): ${textPreview}`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }]
  };
}
