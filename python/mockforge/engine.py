import json
from typing import Dict, List, Set, Any
from .dag import KahnTopologicalSorter
from .synthesizer import RelationalSynthesizer, TableSchema

class MockForgeEngine:
    """Orchestrates topological dependency resolution, seed synthesis, and relational data export"""

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.synthesizer = RelationalSynthesizer(seed=seed)

    def generate(self, tables: List[TableSchema]) -> Dict[str, List[Dict[str, Any]]]:
        """Resolves dependencies and generates coherent relational mock data for all tables"""
        # Build dependency graph
        table_names = [t.name for t in tables]
        table_map = {t.name: t for t in tables}
        dependencies: Dict[str, Set[str]] = {t.name: set() for t in tables}

        for table in tables:
            for col in table.columns:
                if col.foreign_key and col.foreign_key.target_table in table_map:
                    dependencies[table.name].add(col.foreign_key.target_table)

        # Topologically sort tables
        ordered_table_names = KahnTopologicalSorter.sort(table_names, dependencies)

        dataset: Dict[str, List[Dict[str, Any]]] = {}

        for name in ordered_table_names:
            table_schema = table_map[name]
            rows = self.synthesizer.generate_table(table_schema)
            dataset[name] = rows

        return dataset

    @staticmethod
    def to_json(dataset: Dict[str, List[Dict[str, Any]]], indent: int = 2) -> str:
        """Serializes relational dataset to formatted JSON"""
        return json.dumps(dataset, indent=indent, default=str)

    @staticmethod
    def to_sql(dataset: Dict[str, List[Dict[str, Any]]], dialect: str = "postgres") -> str:
        """Generates ANSI / Postgres INSERT statements preserving topological order"""
        statements: List[str] = [
            f"-- MockForge AI Synthesized Relational Seed Data ({dialect.upper()})",
            "-- Generated with 100% Referential Integrity",
            ""
        ]

        for table_name, rows in dataset.items():
            if not rows:
                continue

            columns = list(rows[0].keys())
            cols_str = ", ".join([f'"{c}"' for c in columns])

            for row in rows:
                val_strs = []
                for c in columns:
                    val = row.get(c)
                    if val is None:
                        val_strs.append("NULL")
                    elif isinstance(val, (int, float)):
                        val_strs.append(str(val))
                    else:
                        clean_str = str(val).replace("'", "''")
                        val_strs.append(f"'{clean_str}'")

                statements.append(f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({", ".join(val_strs)});')
            statements.append("")

        return "\n".join(statements)
