# Contributing to gen-canvas

Thanks for your interest in contributing! This document covers the process for contributing to this project.

## Development Setup

```bash
git clone https://github.com/ReByteAI/gen-canvas.git
cd gen-canvas
npm install
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Watch mode build |
| `npm run build` | Production build |
| `npm run demo` | Run the demo app at localhost:3100 |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run check` | Run all checks (typecheck + lint + format + test) |

## Making Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Add or update tests for any changed functionality.
4. Run `npm run check` to verify everything passes.
5. Add a changeset: `npx changeset` and follow the prompts.
6. Open a pull request.

## Pre-commit Hooks

This project uses [husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) for pre-commit checks:

- **Pre-commit**: Runs ESLint and Prettier on staged files.
- **Pre-push**: Runs type checking and tests.

## Changesets

We use [changesets](https://github.com/changesets/changesets) for versioning. When making a user-facing change, run `npx changeset` and describe what changed. This creates a markdown file in `.changeset/` that gets consumed during release.

## Code Style

- TypeScript strict mode
- Prettier for formatting (see `.prettierrc`)
- ESLint for linting (see `eslint.config.js`)
- No emojis in code unless explicitly requested

## Architecture

The project follows a layered architecture:

```
EditorStore  ->  EditorCore  ->  ToolStateMachine  ->  CardPlugin
                                                         |
                                                    KonvaAdapter
                                                         |
                                                    React Shell
```

- **Core** (`src/core/`) is renderer-agnostic and has no DOM/Konva dependencies.
- **Konva adapter** (`src/konva/`) bridges core to the canvas.
- **React layer** (`src/react/`) provides hooks and components.

## Testing

Tests live alongside code in `src/core/__tests__/`. We use [Vitest](https://vitest.dev/).

- Test core logic thoroughly (geometry, store, editor, plugins, snapping).
- React components and Konva adapter are integration-tested separately.

## Reporting Issues

Use GitHub Issues. Please include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Environment (OS, Node version, browser)
