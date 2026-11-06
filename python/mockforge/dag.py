from typing import Dict, List, Set
from collections import defaultdict, deque

class CircularDependencyError(Exception):
    """Raised when schema contains cyclic foreign key dependencies"""
    def __init__(self, cycle_nodes: List[str]):
        super().__init__(f"Circular foreign key dependency detected among tables: {', '.join(cycle_nodes)}")
        self.cycle_nodes = cycle_nodes

class KahnTopologicalSorter:
    """Kahn's algorithm for ordering relational tables in topological causal sequence"""

    @staticmethod
    def sort(tables: List[str], dependencies: Dict[str, Set[str]]) -> List[str]:
        """
        dependencies: mapping table -> set of tables it depends on (foreign keys)
        Returns ordered list where parent tables precede child tables
        """
        # Adjacency list: parent -> list of children
        graph = defaultdict(list)
        # In-degree: table -> number of parent dependencies
        in_degree = {t: 0 for t in tables}

        for child, parents in dependencies.items():
            for parent in parents:
                if parent in in_degree and parent != child:
                    graph[parent].append(child)
                    in_degree[child] += 1

        # Queue of nodes with zero dependencies
        queue = deque([t for t in tables if in_degree[t] == 0])
        ordered: List[str] = []

        while queue:
            node = queue.popleft()
            ordered.append(node)

            for child in graph[node]:
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    queue.append(child)

        if len(ordered) != len(tables):
            remaining = [t for t in tables if t not in ordered]
            raise CircularDependencyError(remaining)

        return ordered
