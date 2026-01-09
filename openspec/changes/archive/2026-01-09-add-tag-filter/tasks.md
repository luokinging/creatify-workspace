## 1. Frontend Component Development

- [x] 1.1 Create `TagFilterDropdownButton` component at `webserver/frontend/feature/mushroom/sub-feature/project-management/block/tag-filter-dropdown-button.tsx`
  - Use FlexibleDropdown with checkbox mode for multi-tag selection
  - Use useAutoKeyQuery directly for data fetching (no manager/view-controller)
  - Manage selected tags state internally via useState
  - Implement desktop/mobile variants (Button vs IconButton)
  - Display selected tag count in trigger button
  - Use "label" icon for the button
  - Show loading state while fetching tags
  - Show error state
  - Show empty state when no tags available
  - Order tags alphabetically by name

- [x] 1.2 Add tag fetching API function
  - Add `getTagsList(projectId: string)` function to `tags.api.ts`
  - Use standard list endpoint: `GET /api/mushroom/tags/?project=<project_id>`
  - Return `Tag[]` array

- [x] 1.3 Use useAutoKeyQuery in component
  - Import useAutoKeyQuery from `@/feature/common/experimental/auto-key-query`
  - Fetch tags using the new getTagsList API function
  - Handle loading, error, and success states
  - Include projectId in API request parameters

## 2. State Management

- [x] 2.1 Add `tagFilter` state to `ProjectViewStateManager`
  - Add `tagFilter: string[]` to ProjectViewState type (default: empty array)
  - Initialize in viewStateInitialState
  - Add to persist configuration (partialize)
  - Add migration handling for rehydration

- [x] 2.2 Add tag filter methods to ProjectViewStateManager
  - Add `setTagFilter(tagIds: string[])` method
  - Add `tagFilterChangedEvent` emitter
  - Fire event when tag filter changes
  - Add event disposal in dispose() method

- [x] 2.3 Expose tagFilter in ProjectFileManager
  - Add getter for `tagFilter` state
  - Add convenience method `setTagFilter(tagIds: string[])`
  - Ensure tagFilter is included in combinedStore

## 3. Query Integration

- [x] 3.1 Update `ProjectDataQueryManager` to apply tag filter to assets only
  - Modify asset query parameters to include tag IDs when tagFilter is not empty
  - Do NOT apply tag filter to folder queries (folders remain unfiltered)
  - Apply OR logic for multiple tags (match any selected tag)
  - Ensure tag filter combines correctly with dateFilter and searchQuery
  - Trigger refetch when tagFilterChangedEvent fires

- [ ] 3.2 Add tag filter to URL state sync (optional)
  - Consider whether to include tag IDs in URL parameters
  - If implemented, add sync from URL logic
  - If implemented, add URL update logic when filter changes

## 4. UI Integration

- [x] 4.1 Add TagFilterDropdownButton to content toolbar
  - Import component in `content-toolbar.tsx`
  - Position after MushroomDateFilter
  - Pass projectId from view controller
  - Pass current tagFilter value from viewStateManager
  - Handle tag filter changes via setTagFilter method
  - Support isDesktop prop for responsive behavior

- [ ] 4.2 Test responsive behavior
  - Verify desktop variant shows full button with label and count
  - Verify mobile variant shows icon-only button
  - Test dropdown positioning and overflow handling

## 5. Testing

- [ ] 5.1 Write unit tests for TagFilterDropdownButton component
  - Test tag selection and deselection
  - Test count display in trigger button
  - Test loading state rendering
  - Test error state rendering
  - Test empty state rendering

- [ ] 5.2 Write unit tests for ProjectViewStateManager tagFilter methods
  - Test setTagFilter updates state correctly
  - Test tagFilterChangedEvent fires on state change
  - Test state persistence to localStorage
  - Test state rehydration from localStorage

- [ ] 5.3 Write integration tests for query filtering
  - Test that assets are filtered when tags are selected
  - Test that folders are NOT filtered by tags (all folders still shown)
  - Test that tag filter combines with other filters
  - Test that clearing tag filter shows all assets
  - Test refetch behavior when filter changes

## 6. Backend Verification

- [ ] 6.1 Verify backend API endpoints
  - Confirm `/api/mushroom/tags/?project=<project_id>` endpoint returns tags array
  - Verify that asset listing endpoints accept tag filter parameters
  - Test OR logic for multiple tag IDs in asset queries
  - Verify response format matches frontend expectations (Tag[] array)
