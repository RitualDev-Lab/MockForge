# 🎲 MockForge AI — Enterprise Relational Mock DB & Synthetic Test Data Engine

[![Architecture: Client-Side](https://img.shields.io/badge/Architecture-100%25%20In--Browser%20WASM-00F59B?style=for-the-badge)](https://ritualdev.in)
[![Dialects](https://img.shields.io/badge/Dialects-Postgres%20%7C%20MySQL%20%7C%20SQLite%20%7C%20Prisma-blue?style=for-the-badge)](https://ritualdev.in)
[![DAG Resolution](https://img.shields.io/badge/DAG-Kahn's%20Algorithm-purple?style=for-the-badge)](https://ritualdev.in)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-yellow.svg?style=for-the-badge)](https://ritualdev.in)

> Enterprise-grade, client-side relational mock database generator and synthetic test data engine. Converts complex SQL DDL schemas (**PostgreSQL, MySQL, SQLite, Prisma**) into referentially coherent datasets and instant in-memory SQL sandboxes (**PGlite / WASM SQLite**) at **$0 running cost**.

---

## ⚡ Core Capabilities (Phase 1)

- **Multi-Dialect AST Schema Parser**: Parses complex `CREATE TABLE`, `CREATE TYPE AS ENUM`, column modifiers, composite primary keys, check constraints, and `ALTER TABLE ADD CONSTRAINT` references.
- **Prisma Schema Support**: Direct conversion of `schema.prisma` models, virtual `@relation` directives, and enums into normalized database ASTs.
- **Topological Dependency DAG (Kahn's Algorithm)**: Automatically constructs dependency graphs to generate parent tables before dependent child tables.
- **Cycle & Self-Reference Breaker**: Intelligently handles recursive tables (e.g. `users.manager_id -> users.id`) and circular foreign keys via deferred secondary passes.

---

## 🧪 Testing & Verification

```bash
# Run unit tests and performance benchmarks
npm test

# Typecheck TypeScript
npm run typecheck

# Build library bundle
npm run build
```

---

## 📄 License

Proprietary © [RitualDev Studio](https://ritualdev.in). All rights reserved.
