# GEMINI.md

## Project Overview

This is a monorepo containing the web front-end and back-end for the Creatify application.

*   **`webserver/frontend/`**: A [React](https://react.dev/) application built with [Vite](https://vitejs.dev/). It uses [TanStack Router](https://tanstack.com/router) for routing, [Redux Toolkit](https://redux-toolkit.js.org/) and [Zustand](https://zustand-demo.pmnd.rs/) for state management, and [Vitest](https://vitest.dev/) for testing.
*   **`webserver/backend/`**: A [Python](https://www.python.org/) back-end built with the [Django](https://www.djangoproject.com/) framework. It uses [pytest](https://pytest.org/) for testing and [Ruff](https://beta.ruff.rs/) for linting and formatting.

## Building and Running

### `webserver/frontend` (Frontend)

*   **Install dependencies:**
    ```bash
    bun install
    ```
*   **Run development server:**
    ```bash
    bun run dev
    ```
*   **Run unit tests:**
    ```bash
    bun run test
    ```
*   **Run end-to-end tests:**
    ```bash
    bun run test:e2e
    ```
*   **Build for production:**
    ```bash
    bun run build
    ```

### `webserver/backend` (Backend)

*   **Activate virtual environment:**
    ```bash
    source .env/bin/activate
    ```
*   **Run tests:**
    ```bash
    pytest
    ```
*   **Lint and format:**
    ```bash
    ruff check --fix
    ruff format .
    ```

## Development Conventions

### `webserver/frontend` (Frontend)

*   **Linting:** This project uses ESLint and Biome for code quality. Run `bun run lint` to check for issues.
*   **Routing:** Routes are managed with TanStack Router. Use `bun run generate-routes` to generate routes.
*   **State Management:** The project uses both Redux Toolkit and Zustand for state management. Refer to the existing code for usage patterns.
*   **Storybook:** The project uses Storybook for UI component development and testing. Run `bun run story-dev` to start the Storybook server.

### `webserver/backend` (Backend)

*   **Testing:** All new functionality should be accompanied by unit tests. All tests must pass before merging to the `main` branch.
*   **Linting and Formatting:** This project uses Ruff for linting and formatting. Ensure all checks pass before committing code.
*   **Database Migrations:** Refer to `docs/operations/DB_Migration.md` for instructions on how to run database migrations.
*   **Deployment:** Changes are deployed to production via a CI/CD pipeline. Monitor deployments in the `#backend-deployments` Slack channel.

## Project Rules

This project has a dedicated `.project-rules` directory that contains detailed information about project-specific rules and conventions. As an AI agent, it is **critical** that you read and adhere to these rules.

### Entry Points

The `index.md` file within each subdirectory (`frontend`, `backend`, `fullstack`) serves as the entry point for the rules of that specific domain. You should always start by reading the `index.md` file to understand which documents are mandatory and which are optional.

### Frontend Rules (`.project-rules/frontend/`)

The most comprehensive set of rules is for the frontend. The `index.md` file in this directory outlines a set of **mandatory** documents that all AI agents must read before starting any task. These documents cover:

*   **Architecture:** The core architectural principles of the project, including the Manager pattern.
*   **MVC Architecture:** Standards for implementing ViewControllers and Managers.
*   **Development Workflow:** Standardized procedures for different types of tasks (e.g., bug fixes, feature development).
*   **Programming Conventions:** Quick-reference guide for development and a list of absolute prohibitions.
*   **Directory Structure:** The standard organization of feature directories.
*   **Examples and Patterns:** In-depth explanations of design patterns with practical examples.

The `index.md` file also provides guidance on how to discover and read optional documents based on the specific requirements of your task.

### Backend and Fullstack Rules

The `backend` and `fullstack` directories also contain `index.md` files that serve as entry points to their respective rules. While these are currently less detailed than the frontend rules, you should still consult them before working on backend or fullstack tasks.

**Your primary instruction is to always consult the relevant `index.md` file in the `.project-rules` directory before starting any new task.** This will ensure that you are following the correct procedures and conventions for the project.
