# Design: Tag Filter Implementation

## Context

The project management content view currently has filters for:
- Appearance (grid/list view)
- Asset fields (column visibility)
- Ordering (sort by)
- Date range (date filter)
- Search (text search)

We need to add tag filtering as another dimension for filtering assets/folders.

## Goals / Non-Goals

### Goals
- Add tag filter dropdown next to Date filter in content toolbar
- Support multi-tag selection (OR logic - show assets with ANY of selected tags)
- Display available tags from the current project (using existing `/api/mushroom/tags/usage/` endpoint)
- Show selected tag count in trigger button
- Persist tag filter state in localStorage (like date filter)
- Apply filter to both assets and folders in the query

### Non-Goals
- Tag creation/editing from the filter dropdown (use existing tags page)
- Complex tag logic (AND/NOT combinations)
- Tag filter in other views (only content toolbar)

## Decisions

### 1. Component Pattern: Simple Component with Internal State
**Rationale**: This is a simple filter dropdown that:
- Uses `useAutoKeyQuery` directly for data fetching (no manager/view-controller needed)
- Manages selected tags state internally via `useState`
- Uses FlexibleDropdown with checkbox mode for multi-selection
- Shows selected count in trigger button
- Has desktop/mobile variants
- Integrates with viewStateManager for persistence

**Alternatives considered**:
- Using TagsViewController pattern: Too complex for a simple dropdown; adds unnecessary Manager/ViewController layers
- Custom dropdown without FlexibleDropdown: More control but more code, inconsistent with project patterns
- AssetFieldsDropdownButton pattern: Too complex (drag-and-drop), not needed for simple tag selection

### 2. State Management: Add to ProjectViewStateManager
**Rationale**: Tag filter is a view state like `dateFilter`, `ordering`, and `searchQuery`. Adding it to `ProjectViewStateManager`:
- Keeps all filter state in one place
- Enables persistence via existing localStorage setup
- Works with CombinedStore for reactive updates

**Alternatives considered**:
- New TagFilterManager: Unnecessary complexity for simple state
- URL state: Not appropriate for tag filter (could create long URLs)

### 3. Tag Fetching: Use Default Django List Endpoint
**Rationale**: The default `MushroomTagViewSet` (ModelViewSet) provides a standard list endpoint:
- `GET /api/mushroom/tags/?project=<project_id>` - returns all tags for the project
- Uses existing Django REST framework infrastructure
- Supports project filtering via query parameter

We'll use `useAutoKeyQuery` directly in the component for simple, straightforward data fetching without the complexity of view controllers or managers.

**Alternatives considered**:
- `/api/mushroom/tags/usage/` endpoint: Provides usage counts but more complex response structure; not needed for simple tag display
- `createAutoKeyMiniQueryClient`: More complex setup needed; `useAutoKeyQuery` is sufficient for this simple component

### 4. UI Layout: Position After Date Filter
**Rationale**: In the filter flow:
1. View controls (Appearance, Fields, Sort)
2. Date filter
3. **Tag filter** (new)
4. Search

This maintains logical grouping (time-based filters together, then metadata filters).

## Risks / Trade-offs

### Risk: Query Performance with Tag Filter
**Risk**: Adding tag filter to queries may impact performance, especially with many tags.

**Mitigation**:
- Backend already supports tag filtering via existing API
- Use indexed database columns for tag queries
- Consider debouncing filter changes if needed

### Trade-off: Checkbox vs Radio Mode
**Decision**: Use checkbox mode for multi-tag selection.

**Rationale**: Users typically want to see assets with "design review" OR "approved" tags, not require both.

**Trade-off**: Slightly more complex UI (checkboxes) vs single selection.

## Migration Plan

No data migration needed - this is a new feature. Tag filter state will default to empty (no filter).

## Open Questions

1. **Should tag filter apply to folders?**
   - Most tags are on assets (evaluation tickets)
   - **Decision: Assets only** - Tag filter applies to assets, not folders. This keeps the filtering focused on the content where tags are actually used.

2. **Should we show tag usage counts in the dropdown?**
   - Could help users identify popular tags
   - **Decision: Tag names only** - Display only tag names without counts. This keeps the UI simpler and more consistent with the filter dropdown pattern.

3. **How should we handle empty tag list?**
   - New projects may have no tags
   - Decision: Show "No tags available" message in dropdown, disable trigger
