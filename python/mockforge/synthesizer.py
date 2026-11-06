import random
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

@dataclass
class ForeignKeyRef:
    target_table: str
    target_column: str

@dataclass
class ColumnSchema:
    name: str
    data_type: str  # 'uuid' | 'serial' | 'name' | 'email' | 'price' | 'status' | 'timestamp' | 'text' | 'integer'
    is_primary_key: bool = False
    is_nullable: bool = False
    foreign_key: Optional[ForeignKeyRef] = None
    enum_values: Optional[List[str]] = None

@dataclass
class TableSchema:
    name: str
    columns: List[ColumnSchema]
    row_count: int = 10

class RelationalSynthesizer:
    """Deterministic, seeded synthetic relational test data generator maintaining referential integrity"""

    FIRST_NAMES = ["James", "Emma", "Liam", "Olivia", "Noah", "Sophia", "Alex", "Maya", "Ethan", "Isabella"]
    LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
    DOMAINS = ["example.com", "testorg.io", "devmail.net", "acme.corp"]
    STATUSES = ["active", "pending", "completed", "cancelled", "archived"]

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)
        # Table -> Primary Key Column Name -> List of generated values
        self.generated_keys: Dict[str, Dict[str, List[Any]]] = {}

    def generate_table(self, table: TableSchema) -> List[Dict[str, Any]]:
        """Generates relational mock rows for a table schema"""
        rows: List[Dict[str, Any]] = []
        pk_col = next((c for c in table.columns if c.is_primary_key), None)

        if table.name not in self.generated_keys:
            self.generated_keys[table.name] = {}

        for row_idx in range(table.row_count):
            row_data: Dict[str, Any] = {}
            first_name = self.rng.choice(self.FIRST_NAMES)
            last_name = self.rng.choice(self.LAST_NAMES)

            for col in table.columns:
                if col.foreign_key:
                    # Resolve from parent table generated primary keys
                    parent_vals = self.generated_keys.get(col.foreign_key.target_table, {}).get(col.foreign_key.target_column, [])
                    if parent_vals:
                        row_data[col.name] = self.rng.choice(parent_vals)
                    else:
                        row_data[col.name] = row_idx + 1
                elif col.is_primary_key:
                    if col.data_type == "uuid":
                        val = str(uuid.UUID(int=self.rng.getrandbits(128), version=4))
                    else:
                        val = row_idx + 1
                    row_data[col.name] = val

                    # Record PK value for child tables to reference
                    if col.name not in self.generated_keys[table.name]:
                        self.generated_keys[table.name][col.name] = []
                    self.generated_keys[table.name][col.name].append(val)
                elif col.data_type == "email":
                    domain = self.rng.choice(self.DOMAINS)
                    row_data[col.name] = f"{first_name.lower()}.{last_name.lower()}{row_idx}@{domain}"
                elif col.data_type == "name":
                    row_data[col.name] = f"{first_name} {last_name}"
                elif col.data_type == "price":
                    row_data[col.name] = round(self.rng.uniform(9.99, 999.99), 2)
                elif col.data_type == "status":
                    choices = col.enum_values or self.STATUSES
                    row_data[col.name] = self.rng.choice(choices)
                elif col.data_type == "timestamp":
                    year = 2026
                    month = self.rng.randint(1, 12)
                    day = self.rng.randint(1, 28)
                    hour = self.rng.randint(0, 23)
                    minute = self.rng.randint(0, 59)
                    row_data[col.name] = f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:00Z"
                elif col.data_type == "uuid":
                    row_data[col.name] = str(uuid.UUID(int=self.rng.getrandbits(128), version=4))
                elif col.data_type == "integer":
                    row_data[col.name] = self.rng.randint(1, 1000)
                else:
                    row_data[col.name] = f"{col.name}_{row_idx + 1}"

            rows.append(row_data)

        return rows
