## Context

The Mushroom module currently has a `MushroomTag` model with basic CRUD operations via `MushroomTagViewSet`. Tags are used on evaluation tickets but lack a dedicated management interface. Users need to:
1. View all tags in a project at a glance
2. Identify which tags they've personally used
3. Find and clean up unused tags
4. Delete individual tags with confirmation

## Goals / Non-Goals

### Goals
- Provide a centralized tag management page within the project context
- Display tags organized by usage categories (your tags, all tags, unused)
- Enable individual tag deletion with confirmation
- Enable bulk deletion of unused tags
- Maintain consistency with existing asset page layout (shared topbar and sidebar)

### Non-Goals
- Tag creation/editing on this page (can be done through ticket editing)
- Tag renaming functionality
- Advanced tag filtering or search
- Mobile-responsive layout (desktop only initially)

## Decisions

### 1. Page Layout Consistency
**Decision**: Use the same layout structure as the asset page (`/mushroom/project/asset`)

**Rationale**: Users are already familiar with the asset page layout. Reusing the shared topbar and sidebar provides a consistent experience and reduces development effort. The tag page supports the same left sidebar toggle as the asset page.

**Alternatives considered**:
- Modal-based tag manager: Rejected because tags are complex enough to warrant a full page

### 2. Tag Grouping Strategy
**Decision**: Three groups based on usage patterns:
- **Your Tags**: Tags where current user has attached at least once
- **All Tags**: All tags in the project (user's tags + other users' tags)
- **Unused Tags**: Tags with `usage_count = 0` (not attached to any ticket)

**Rationale**: This aligns with the UI requirements and provides clear separation of concerns for different user needs. Tag types follow backend model: `COMMON`, `PROJECT`, `AI`, and all types are shown together within each group.

### 3. Backend API Design
**Decision**: Enhance existing `MushroomTagViewSet` with:
- New endpoint `/api/mushroom/tags/usage/` to get tag usage statistics
- Filter parameter `?project=<id>` already exists
- Add annotation for usage count in list response

**Rationale**: Minimal changes to existing API, leverages current patterns.

**Alternatives considered**:
- Separate tags statistics endpoint: Rejected because over-engineering for current needs
- GraphQL: Rejected because project uses REST

### 4. Delete Interaction
**Decision**: Hover shows close button ONLY for tags with `usage_count = 0`, click triggers AlertDialog confirmation

**Rationale**:
- Matches existing `ClosableWrapper` component pattern (`webserver/frontend/feature/common/component/closable-wrapper.tsx`)
- Prevents accidental deletion of tags that are in use
- Tags with `usage_count > 0` cannot be deleted (button not shown)
- Provides safety against accidental deletion with confirmation dialog

### 5. Frontend Architecture
**Decision**: Follow Manager pattern with:
- `TagsViewController` to coordinate page logic
- `createAutoKeyMiniQueryClient` for tag fetching (uses utility manager pattern, no custom DataManager needed)
- Reusable `TagGroupContainer` component for consistent UI

**Rationale**:
- Maintains architectural consistency with the rest of the Mushroom feature
- Uses project's standard utility manager (`createAutoKeyMiniQueryClient`) which includes built-in state management (loading, data, error)
- Follows `.project-rules/frontend/utility-managers.md` guidelines

## Data Model

### Existing Model (No Changes Required)
```python
class MushroomTag(UUIDModelMixin, TimeStampModelMixin):
    name: CharField
    tag_type: CharField  # common/project/ai
    is_system: BooleanField
    project: ForeignKey(MushroomNodeProject, null=True)
```

### New Backend Response Format
```python
# GET /api/mushroom/tags/usage/?project=<id>
{
    "your_tags": [
        {"id": "...", "name": "urgent", "usage_count": 5}
    ],
    "all_tags": [
        {"id": "...", "name": "urgent", "usage_count": 5},
        {"id": "...", "name": "feedback", "usage_count": 0}
    ],
    "unused_tags": [
        {"id": "...", "name": "feedback", "usage_count": 0}
    ]
}
```

## Component Structure

```
feature/mushroom/sub-feature/project-management/
├── page/
│   ├── tags-page.tsx              # Entry point
│   └── desktop/
│       └── tags-page/
│           ├── index.tsx          # Desktop tags page
│           └── tags-content-panel.tsx
├── manager/
│   └── tags/
│       └── tags-view-controller.tsx
├── api/
│   └── tags.api.ts                # API client functions
├── component/
│   └── tag-group-container.tsx    # Reusable tag group component
└── context/
    └── tags-view-controller-context.tsx
```

Note: No `tags-data-manager.ts` needed - using `createAutoKeyMiniQueryClient` utility instead.

## Risks / Trade-offs

### Risk: Tag Usage Performance
**Risk**: Counting tag usage across all tickets could be slow for projects with many tickets.

**Mitigation**:
- Use database aggregation with indexes
- Consider caching usage counts
- Add pagination if tag list grows large

### Trade-off: System Tag Deletion
**Decision**: System tags (`is_system=True`) already protected from deletion via API. Frontend should not show delete button for system tags.

### Trade-off: Unused Tag Detection
**Approach**: A tag is "unused" if `usage_count = 0`. This means it exists but is not attached to any evaluation ticket.

## Open Questions

1. **Should "Your Tags" include system tags?**
   - Assumption: Yes, if the user has attached them to tickets

2. **Tag grouping clarification**
   - **Your Tags**: Tags where the current user has attached at least once
   - **All Tags**: All tags in the project (includes current user's tags + other users' tags)
   - **Unused Tags**: Tags with `usage_count = 0` across all users
   - Tag types (`COMMON`, `PROJECT`, `AI`) are shown together within each group

## Migration Plan

### Steps
1. Backend: Add usage statistics endpoint
2. Frontend: Create tags page components
3. Add route configuration
4. Add sidebar label button
5. Test with sample data

### Rollback
- Remove route and button
- Backend endpoint can be disabled by removing from URLconf
- No database changes to revert
