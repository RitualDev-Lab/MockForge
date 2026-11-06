import unittest
from mockforge import (
    MockForgeEngine,
    KahnTopologicalSorter,
    CircularDependencyError,
    TableSchema,
    ColumnSchema,
    ForeignKeyRef
)

class TestMockForgePython(unittest.TestCase):
    def test_kahn_topological_sort(self):
        tables = ["orders", "users", "order_items", "products"]
        deps = {
            "orders": {"users"},
            "order_items": {"orders", "products"},
            "users": set(),
            "products": set()
        }

        ordered = KahnTopologicalSorter.sort(tables, deps)
        self.assertLess(ordered.index("users"), ordered.index("orders"))
        self.assertLess(ordered.index("orders"), ordered.index("order_items"))
        self.assertLess(ordered.index("products"), ordered.index("order_items"))

    def test_circular_dependency_detection(self):
        tables = ["table_a", "table_b"]
        deps = {
            "table_a": {"table_b"},
            "table_b": {"table_a"}
        }

        with self.assertRaises(CircularDependencyError):
            KahnTopologicalSorter.sort(tables, deps)

    def test_relational_data_synthesis_and_foreign_keys(self):
        users = TableSchema(
            name="users",
            row_count=5,
            columns=[
                ColumnSchema(name="id", data_type="serial", is_primary_key=True),
                ColumnSchema(name="name", data_type="name"),
                ColumnSchema(name="email", data_type="email")
            ]
        )

        orders = TableSchema(
            name="orders",
            row_count=10,
            columns=[
                ColumnSchema(name="id", data_type="uuid", is_primary_key=True),
                ColumnSchema(
                    name="user_id",
                    data_type="serial",
                    foreign_key=ForeignKeyRef(target_table="users", target_column="id")
                ),
                ColumnSchema(name="amount", data_type="price")
            ]
        )

        engine = MockForgeEngine(seed=100)
        # Pass child before parent to test automatic topological reordering
        dataset = engine.generate([orders, users])

        self.assertIn("users", dataset)
        self.assertIn("orders", dataset)
        self.assertEqual(len(dataset["users"]), 5)
        self.assertEqual(len(dataset["orders"]), 10)

        # Verify referential integrity: all orders.user_id must exist in users.id
        user_ids = {u["id"] for u in dataset["users"]}
        for order in dataset["orders"]:
            self.assertIn(order["user_id"], user_ids)

    def test_export_sql_statements(self):
        users = TableSchema(
            name="users",
            row_count=2,
            columns=[
                ColumnSchema(name="id", data_type="serial", is_primary_key=True),
                ColumnSchema(name="name", data_type="name")
            ]
        )
        engine = MockForgeEngine(seed=42)
        dataset = engine.generate([users])
        sql = engine.to_sql(dataset)

        self.assertIn('INSERT INTO "users"', sql)
        self.assertIn("VALUES", sql)

if __name__ == "__main__":
    unittest.main()
