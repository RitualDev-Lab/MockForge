# MockForge

> High-performance relational mock database and seed synthesizer powered by Kahn's Topological DAG Sorter and WebAssembly DuckDB/SQLite.

## Architecture
- **Kahn's Topological DAG Sorter**: Resolves table foreign key dependencies into a directed acyclic graph to ensure parent rows are created before child foreign keys.
- **WASM Client-Side Execution**: Runs entirely inside the client or Node.js runtime without sending database schemas or sensitive table structures to remote servers.
- **Synthesizers**: Supports UUIDv4, sequential serials, Gaussian/Zipfian distributed numbers, temporal sequences (timestamps where created_at < updated_at), and localized mock entities.

## Commands
- CLI Usage: `npx @ritualdev/mockforge generate --schema schema.sql --rows 500`
- Web Playground: https://ritualdev.in/mockforge
