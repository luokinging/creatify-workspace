# Project Context

## Purpose
Creatify is a creative content management and video editing platform. The application enables users to create, manage, and publish creative content with features including campaign management, video editing, template systems, and collaborative workflows.

## Tech Stack

### Frontend
- **Runtime:** Bun
- **Framework:** React 18.x with TypeScript 5.x
- **Routing:** TanStack Router
- **State Management:** Zustand
- **Styling:** TailwindCSS
- **UI Components:** Radix UI primitives, shadcn/ui, internal component library (`webserver/frontend/component/ui`)
- **Testing:** Vitest (unit), Playwright (e2e), Storybook (component development)
- **Build:** Vite
- **Linting/Formatting:** Biome, ESLint
- **Video Rendering:** Remotion

### Backend
- **Runtime:** Python 3.x
- **Framework:** Django
- **Testing:** pytest
- **Linting/Formatting:** Ruff
- **Container:** Docker (backend runs in Docker containers)

## Project Conventions

### Code Style

#### Frontend
- **Formatting:** Use `bun biome:fix` for code formatting in the frontend directory
- **Type Checking:** Run `bun precommit` for TypeScript checks before committing
- **Component Props:** Destructure props in function body, not in function signature
  ```typescript
  // Correct
  export function MyComponent(props: MyComponentProps) {
    const { value, onChange } = props;
    // ...
  }
  ```
- **File Naming:** kebab-case for files (e.g., `data-manager.ts`, `example-page.tsx`)

#### Backend
- **All backend operations must be performed inside Docker containers**
- Use `docker-compose` file for reference and `docker ps` to view containers
- All unit tests and Django debugging must be done inside the Docker container

### Architecture Patterns

#### Frontend: Manager Pattern
The project strictly follows the **Manager Pattern** for separating business logic from UI:

**Hierarchy:**
1. **Services** (`feature/services/*`) - Global infrastructure services (registered at app level)
2. **Managers** (`*-manager.ts`) - Domain brains that encapsulate state and behavior
3. **ViewControllers** (`*.manager/view-controller.ts`) - Orchestrators coordinating multiple Managers
4. **UI Components** (`*.tsx`) - Pure presentation layer

**Key Principles:**
- All state in Manager/ViewController is internal implementation detail
- Use `createStore` from `zustand/vanilla` with `immer(combine(...))` for state
- Must implement `bootstrap()` and `dispose()` lifecycle methods
- Use `DisposerManager` for cleanup
- State must be accessed via `state` getter and updated via `setState()` method
- Prefer `bootstrapXxx` naming for methods triggered from bootstrap (not `initXxx`)

**State vs Instance Variables:**
- **State (Store):** Data that drives UI updates (form fields, lists, loading states)
- **Instance Variables:** Read-only config, one-time data, internal calculations

**Anti-Patterns to Avoid:**
- God components with mixed UI and logic
- Logic in store actions
- Overusing `useCallback`/`useMemo` in components (move to Manager if >10 lines)
- Creating `store/` directories (state belongs in Managers)
- Hacky conditionals for module interactions (provide generic capabilities instead)

#### Frontend: Feature Directory Structure
Standard structure for all features:
```
feature/example/
├── api/          # Pure API request definitions
├── manager/      # Business logic and state (Class)
├── context/      # React Context for feature scope
├── component/    # Reusable pure UI components (Dumb)
├── block/        # Reusable business components (Smart, may use Context/Manager)
├── page/         # Page entry components
├── hook/         # Custom Hooks
├── type/         # Type definitions
└── util/         # Utility functions
```
**Prohibited directories:** `services/`, `helpers/`, `assets/`, `store/`

#### Frontend: Component Usage
- **Priority:** Use internal components (`webserver/frontend/component/ui`) first
- **Secondary:** Use shadcn/ui components
- **Dropdown:** Use `FlexibleDropdown` and its derivatives

#### Frontend: Import Convention
- **No feature-level index exports** - Always import from full file paths
- Example: `import { SomeManager } from '@/feature/example/manager/some-manager'`

### Testing Strategy

#### Frontend
- **Unit Tests:** Vitest (`bun run test`)
- **E2E Tests:** Playwright (`bun run test:e2e`)
- **Component Development:** Storybook (`bun run story-dev`)
- All tests must pass before merging to `main` branch

#### Backend
- **Unit Tests:** pytest (run inside Docker container)
- All new functionality requires unit tests

### Git Workflow

#### Branching
- **Main Branch:** `main`
- Create PRs for all changes
- Monitor deployments in `#backend-deployments` Slack channel

#### Commit Conventions
- Use git hooks configured in `.githooks` directory
- Run `bun precommit` before committing (frontend)

## Domain Context

### Core Capabilities
- **Campaign Management:** Create and manage advertising campaigns
- **Video Editing:** Browser-based video editing with Remotion
- **Template System:** Reusable content templates
- **TikTok Integration:** Connect and publish to TikTok via `@tiktok-service/app-center-connect`
- **Collaboration:** Multi-user editing and review workflows

### Key Business Terms
- **Campaign:** An organized advertising effort
- **Creative:** Individual content pieces within campaigns
- **Render:** Video generation process via Remotion

## Important Constraints

### Technical Constraints
- **Backend isolation:** All backend development must occur within Docker containers
- **State management:** No independent `store/` directories - state must be encapsulated in Managers
- **Component logic:** Components should be "dumb" - business logic belongs in Managers

### Performance Constraints
- Use `@tanstack/react-query` for server state management and caching
- Implement pagination for large datasets using `PaginatedQueryManager`

## External Dependencies

### Services
- **TikTok Service:** `@tiktok-service/app-center-connect` - TikTok app center integration
- **Datadog:** `@datadog/browser-rum` - Monitoring and analytics
- **Azure:** Likely hosting infrastructure (based on sourcemap upload URLs)

### APIs
- Backend Django API (communicates via fetch wrapper utilities)
- Auto-key system for request deduplication and caching
