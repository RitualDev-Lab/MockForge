export interface QueryResult {
  rows: Record<string, any>[];
  columns: string[];
  rowCount: number;
  durationMs: number;
}

export interface TableMetadata {
  name: string;
  rowCount: number;
  columns: string[];
}

export interface WasmDatabaseEngine {
  loadDataset(dataset: any): Promise<void> | void;
  query(sql: string): Promise<QueryResult> | QueryResult;
  getTables(): TableMetadata[];
  close?(): Promise<void> | void;
}
