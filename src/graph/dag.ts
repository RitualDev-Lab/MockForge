import type {
  DatabaseSchema,
  TableDefinition,
  ForeignKeyReference,
  GenerationStep,
  TopologicalSortResult
} from '../types/schema.js';

export class DependencyGraph {
  private schema: DatabaseSchema;
  private tables: Map<string, TableDefinition> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // Parent -> Set<Children that depend on Parent>
  private dependencyList: Map<string, Set<string>> = new Map(); // Child -> Set<Parents that Child depends on>
  private selfReferences: Map<string, ForeignKeyReference[]> = new Map();
  private deferredForeignKeys: Map<string, ForeignKeyReference[]> = new Map();

  constructor(schema: DatabaseSchema) {
    this.schema = schema;
    this.buildGraph();
  }

  private buildGraph(): void {
    for (const table of this.schema.tables) {
      const lowerName = table.name.toLowerCase();
      this.tables.set(lowerName, table);
      this.adjacencyList.set(lowerName, new Set());
      this.dependencyList.set(lowerName, new Set());
      this.selfReferences.set(lowerName, []);
      this.deferredForeignKeys.set(lowerName, []);
    }

    for (const table of this.schema.tables) {
      const childName = table.name.toLowerCase();

      for (const fk of table.foreignKeys) {
        const parentName = fk.targetTable.toLowerCase();

        // 1. Handle Self-referencing tables (e.g. users.manager_id -> users.id)
        if (childName === parentName) {
          this.selfReferences.get(childName)?.push(fk);
          this.deferredForeignKeys.get(childName)?.push(fk);
          continue; // Do not add self-edge to topological DAG
        }

        // Only register dependency if parent table exists in schema
        if (this.tables.has(parentName)) {
          this.adjacencyList.get(parentName)?.add(childName);
          this.dependencyList.get(childName)?.add(parentName);
        }
      }
    }
  }

  /**
   * Performs Kahn's Algorithm topological sort with automatic cycle breaking
   */
  resolveExecutionOrder(): TopologicalSortResult {
    const inDegree: Map<string, number> = new Map();
    for (const [name, parents] of this.dependencyList.entries()) {
      inDegree.set(name, parents.size);
    }

    // Queue tables with in-degree 0 (no unresolved dependencies)
    const queue: string[] = [];
    for (const [name, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    const executionOrder: string[] = [];
    const steps: GenerationStep[] = [];
    let orderIndex = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const originalTable = this.tables.get(current)!;
      executionOrder.push(originalTable.name);

      const parents = Array.from(this.dependencyList.get(current) || []).map(
        (p) => this.tables.get(p)?.name || p
      );

      steps.push({
        tableName: originalTable.name,
        order: orderIndex++,
        dependsOn: parents,
        deferredForeignKeys: this.deferredForeignKeys.get(current) || []
      });

      // For every child that depends on current, decrement in-degree
      const children = this.adjacencyList.get(current) || new Set();
      for (const child of children) {
        const newDegree = (inDegree.get(child) || 0) - 1;
        inDegree.set(child, newDegree);
        if (newDegree === 0) {
          queue.push(child);
        }
      }
    }

    // Check for remaining cycles (e.g. Table A <-> Table B circular FK)
    if (executionOrder.length < this.tables.size) {
      const remainingNodes = Array.from(this.tables.keys()).filter((t) => !executionOrder.map((e) => e.toLowerCase()).includes(t));
      const cycles = this.detectCycles(remainingNodes);

      // Break cycles by deferring the most breakable (nullable) foreign keys
      this.breakCycles(remainingNodes);

      // Re-run sort recursively with broken edges
      return this.resolveExecutionOrder();
    }

    return {
      executionOrder,
      steps,
      hasCycles: false
    };
  }

  private detectCycles(nodes: string[]): string[][] {
    const visited: Set<string> = new Set();
    const recStack: Set<string> = new Set();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const children = this.adjacencyList.get(node) || new Set();
      for (const child of children) {
        if (!nodes.includes(child)) continue;

        if (!visited.has(child)) {
          dfs(child, [...path]);
        } else if (recStack.has(child)) {
          const cycleStart = path.indexOf(child);
          cycles.push(path.slice(cycleStart));
        }
      }

      recStack.delete(node);
    };

    for (const node of nodes) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  private breakCycles(nodes: string[]): void {
    // Pick the foreign key edge that is nullable or breakable
    for (const node of nodes) {
      const table = this.tables.get(node);
      if (!table) continue;

      // Prefer nullable foreign key to break
      const fkToBreak = table.foreignKeys.find((fk) => {
        const target = fk.targetTable.toLowerCase();
        return nodes.includes(target) && (fk.isNullable !== false);
      }) || table.foreignKeys.find((fk) => nodes.includes(fk.targetTable.toLowerCase()));

      if (fkToBreak) {
        const target = fkToBreak.targetTable.toLowerCase();
        // Remove edge from graph
        this.dependencyList.get(node)?.delete(target);
        this.adjacencyList.get(target)?.delete(node);

        // Defer this FK to post-generation phase
        this.deferredForeignKeys.get(node)?.push(fkToBreak);
        return; // Break one cycle edge at a time
      }
    }
  }

  /**
   * Helper to print visual dependency tree
   */
  toDebugString(): string {
    const lines: string[] = ['Dependency DAG:'];
    for (const [table, deps] of this.dependencyList.entries()) {
      const depList = Array.from(deps).join(', ') || '(none)';
      lines.push(`  ${table} -> depends on [${depList}]`);
    }
    return lines.join('\n');
  }
}
