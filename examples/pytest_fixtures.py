"""
Example: Using MockForge in Pytest to dynamically synthesize relational test fixtures.
Requires: pip install mockforge pytest
"""
import pytest
import sqlite3
from mockforge import RelationalSynthesizer

SCHEMA_SQL = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total REAL NOT NULL
);
"""

@pytest.fixture(scope="session")
def test_db():
    # In-memory SQLite test database
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.executescript(SCHEMA_SQL)
    conn.commit()
    
    # Synthesize 100 users and 300 orders with strict FK integrity
    synthesizer = RelationalSynthesizer()
    seed_sql = synthesizer.generate_from_ddl(SCHEMA_SQL, row_counts={"users": 100, "orders": 300})
    
    cursor.executescript(seed_sql)
    conn.commit()
    
    yield conn
    conn.close()

def test_foreign_key_integrity(test_db):
    cursor = test_db.cursor()
    
    # Assert every order references an existing user
    cursor.execute("""
        SELECT COUNT(*) FROM orders 
        WHERE user_id NOT IN (SELECT id FROM users)
    """)
    orphan_count = cursor.fetchone()[0]
    assert orphan_count == 0, "Foreign key integrity violated!"
    
    cursor.execute("SELECT COUNT(*) FROM users")
    assert cursor.fetchone()[0] == 100
    
    cursor.execute("SELECT COUNT(*) FROM orders")
    assert cursor.fetchone()[0] == 300
    print("✓ All 300 orders correctly reference valid user foreign keys.")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
