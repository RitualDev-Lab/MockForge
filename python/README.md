# MockForge AI Python SDK

> **Enterprise In-Memory Relational Mock Database & Test Data Generator**  
> Built by **[RitualDev Studio](https://ritualdev.in)**. Proprietary & Closed-Source.

---

## ⚡ Overview

`mockforge` is a pure-Python relational test data synthesis engine designed for developers, QA engineers, and automated test suites (`pytest`, `unittest`, Django, SQLAlchemy).

It uses Kahn's topological DAG algorithm to automatically resolve foreign key dependencies, ensuring that relational datasets are generated in causal order with 100% referential integrity and zero cyclic lockups.

---

## 🚀 Quickstart

```python
from mockforge import (
    MockForgeEngine,
    TableSchema,
    ColumnSchema,
    ForeignKeyRef
)

# 1. Define parent and child tables with foreign keys
users_table = TableSchema(
    name="users",
    row_count=5,
    columns=[
        ColumnSchema(name="id", data_type="serial", is_primary_key=True),
        ColumnSchema(name="full_name", data_type="name"),
        ColumnSchema(name="email", data_type="email")
    ]
)

orders_table = TableSchema(
    name="orders",
    row_count=10,
    columns=[
        ColumnSchema(name="id", data_type="uuid", is_primary_key=True),
        ColumnSchema(
            name="user_id",
            data_type="serial",
            foreign_key=ForeignKeyRef(target_table="users", target_column="id")
        ),
        ColumnSchema(name="total_amount", data_type="price"),
        ColumnSchema(name="status", data_type="status")
    ]
)

# 2. Synthesize dataset with topological ordering
engine = MockForgeEngine(seed=42)
dataset = engine.generate([orders_table, users_table]) # Pass in any order!

# 3. Export to JSON or SQL
print(engine.to_sql(dataset))
```
