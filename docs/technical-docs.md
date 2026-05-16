# Yazıcı Technical Specification ✦ v3.0.0

## 1. Abstract
This document outlines the architectural specifications of the **Yazıcı** production engine. Yazıcı implements an AI-native development environment that prioritizes execution speed, contextual density, and cost-efficiency. It leverages the latest Node.js V8 optimizations and a robust persistence layer to provide a seamless "printing" experience for software developers.

## 2. Core Architecture

### 2.1 The Routing Engine (The Duct)
The Duct is a sophisticated middleware that categorizes incoming development requests into three primary complexity tiers:
- **T1 (Standard)**: Syntactic sugar, linting, and single-line refactors.
- **T2 (Intermediate)**: Component logic, state management updates, and unit test generation.
- **T3 (Advanced)**: Architectural redesigns, schema migrations, and complex multi-file integrations.

### 2.2 Contextual Serialization (The Ink)
Unlike traditional "copy-paste" context management, Yazıcı uses a selective serialization algorithm. It identifies "Hot Bricks" (frequently modified or highly coupled files) and prioritizes their inclusion in the LLM prompt. This minimizes token overhead while maintaining high semantic accuracy.

### 2.3 Persistence Layer (The Bed)
Data persistence is handled by a local SQLite instance utilizing the `better-sqlite3` driver. 
- **WAL Mode**: Enabled for concurrent read/write operations without performance degradation.
- **C++20 Optimization**: The driver is compiled with native C++20 headers to leverage modern instruction sets for rapid indexing.

## 3. ESM and Pathing Standards
Yazıcı is fully compliant with ECMAScript Modules (ESM). It avoids legacy CommonJS patterns:
- **Path Resolution**: Employs `fileURLToPath` and `import.meta.url` for deterministic directory mapping.
- **Module Target**: Configured for `nodenext` to support advanced metadata properties.

## 4. Operational Metrics

| Metric | Target | Minimum Baseline |
| :--- | :--- | :--- |
| Server Initialization | 850ms | 2.5s |
| API Roundtrip (Local) | < 15ms | 50ms |
| Code Diff Application | < 100ms | 300ms |
| Persistence Latency | < 2ms | 10ms |

## 5. Security and Authentication
The "Infinite Credit" model requires secure vaulting of API keys. Yazıcı stores keys in an encrypted table within the Bed layer, accessible only to the server process via authenticated endpoints.

## 6. Future Expansion
The architecture is extensible via the `src/routes/` directory, allowing for the addition of new "nozzles" (e.g., automated deployment, security auditing, and performance profiling).

---
*Yazıcı Technical Document v3.0.0 — Document ID: YZ-SPEC-2026-001*
*Copyright © 2026 Yazıcı Group. All Rights Reserved.*
