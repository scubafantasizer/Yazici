# Yazıcı ✦ The Autonomous Production Engine

*"Development is not a construction; it is a print. The logic is the ink, the AI is the nozzle, and the codebase is the paper. We do not build code—we print it."*

**License**: GNU General Public License v3.0
**Architecture**: Multi-Model Routing & Contextual Serialization
**Runtime**: Node.js 26+ (V8-Optimized)
**Project Status**: v3.0.0 Stable

---

## What Is Yazıcı?

**Yazıcı** (Turkish: *Printer*) is an autonomous development engine designed to bridge the gap between abstract human intent and concrete executable code. It treats software development as a continuous, linear production process. By abstracting away the friction of manual environment setup, dependency resolution, and model selection, Yazıcı allows developers to maintain a "flow state" that is effectively infinite.

Instead of navigating the codebase manually, the Yazıcı engine analyzes your intent at the architectural level and "prints" the necessary modifications across files simultaneously. The route is the code; the code is the output.

## Architecture: The Production Line

Yazıcı operates on a "Production Line" model where every component is a stage in the printing process.

### Components

| Component | Role |
| :--- | :--- |
| **Intake (UI)** | A high-performance Monaco-based interface for precise intent capturing. |
| **Duct (Router)** | Patented multi-model routing that selects the optimal LLM tier (Gemini, Claude, OpenAI) based on task complexity. |
| **Ink (Context)** | Advanced contextual serialization that feeds relevant code snippets to the AI without overwhelming token limits. |
| **Nozzle (Engine)** | The core execution layer that applies diffs onto the local filesystem using transactionally safe operations. |
| **Bed (Persistence)** | Optimized SQLite storage via `better-sqlite3` for state, history, and secret management. |

## The Philosophy of "Infinite Credit"

The primary bottleneck in modern AI-driven development is not model intelligence, but the cost and availability of model "credits." Yazıcı employs a structural optimization strategy:

1. **Intelligent Tiering**: By routing simple refactors to lower-latency, lower-cost models and reserving "Advanced" tiers for architectural changes, Yazıcı maximizes the "credit-to-output" ratio.
2. **Context Compression**: Only the most vital "bricks" of the codebase are sent to the AI, reducing token waste and ensuring high-quality responses even in large projects.
3. **Fluid Workflows**: By automating the "boring" parts (like dependency installs and port clearing), Yazıcı ensures that the developer's time—the most expensive credit—is never wasted.

## Technical Specification: PBNM-Flow Compatibility

While Yazıcı currently operates as a high-level development engine, its architecture is designed for future compatibility with Pointer-Based Neural Mapping (PBNM) frameworks. 

- **Traceable Code Printing**: Every modification is logged as an explicit sequence of operations.
- **Modular Refinement**: Components can be swapped or patched without halting the server, enabling "Hot-Printing" of new features.

## Usage

### Requirements
- Node.js 26+
- C++20 Compiler (for native module optimization)
- SQLite3

### Installation
```bash
# Ensure C++20 standard is forced during native compilation
CXXFLAGS="-std=c++20" npm install
```

### Execution
```bash
# Start the production engine
npm run dev
```

The system will initialize at `http://127.0.0.1:3147`. The console will display the Yazıcı banner upon successful boot.

## License

**GNU General Public License v3.0**.

If you have hardware above T4 scale — the code is GPL 3.0. Go test it.

A wall is built from bricks, but a blueprint is realized by the printer. We chose the name **Yazıcı** to signify the transition from manual "bricklaying" to automated "printing." The goal is a world where high-quality, secure code is as easy to produce as a sheet of paper.

Go forth and print. ✦
