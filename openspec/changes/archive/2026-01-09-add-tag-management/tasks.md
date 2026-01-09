## 1. Backend Implementation

- [ ] 1.1 Add `usage` action to `MushroomTagViewSet` in `webserver/backend/mushroom/views/tags.py`
  - [ ] 1.1.1 Implement `get_usage_counts()` method to aggregate tag usage from evaluation tickets
  - [ ] 1.1.2 Filter `your_tags` by current user's attachment history
  - [ ] 1.1.3 Filter `all_tags` to include all project tags
  - [ ] 1.1.4 Filter `unused_tags` where `usage_count = 0`
  - [ ] 1.1.5 Add URL route for `/api/mushroom/tags/usage/`

- [ ] 1.2 Verify tag creation endpoint exists in `MushroomTagViewSet`
  - [ ] 1.2.1 Confirm `POST` endpoint creates project-scoped tags
  - [ ] 1.2.2 Verify validation for duplicate tag names
  - [ ] 1.2.3 Confirm `is_system` is forced to `False` for user-created tags

- [ ] 1.3 Add unit tests for tag usage endpoint in `webserver/backend/mushroom/tests/`
  - [ ] 1.2.1 Test usage count calculation
  - [ ] 1.2.2 Test user-specific tag filtering
  - [ ] 1.2.3 Test unused tag detection
  - [ ] 1.2.4 Test with system tags

## 2. Frontend Data Layer

- [ ] 2.1 Create tags API client in `webserver/frontend/feature/mushroom/sub-feature/project-management/api/tags.api.ts`
  - [ ] 2.1.1 Define `TagUsageResponse` type
  - [ ] 2.1.2 Implement `getTagUsage(projectId: string)` function (stable function reference for `createAutoKeyMiniQueryClient`)
  - [ ] 2.1.3 Implement `deleteTag(tagId: string)` function
  - [ ] 2.1.4 Implement `bulkDeleteUnusedTags(tagIds: string[])` function
  - [ ] 2.1.5 Implement `createTag(projectId: string, name: string)` function

- [ ] 2.2 Create `TagsViewController` in `webserver/frontend/feature/mushroom/sub-feature/project-management/manager/tags/tags-view-controller.tsx`
  - [ ] 2.2.1 Create `tagUsageQueryClient` using `createAutoKeyMiniQueryClient` with `getTagUsage`
  - [ ] 2.2.2 Create `combinedStore` including the query client's store
  - [ ] 2.2.3 Implement `bootstrap()` method
  - [ ] 2.2.4 Implement `dispose()` method
  - [ ] 2.2.5 Implement `handleDeleteTag(tagId: string)` method with optimistic update
  - [ ] 2.2.6 Implement `handleBulkDeleteUnusedTags()` method with optimistic update
  - [ ] 2.2.7 Implement `handleCreateTag(name: string)` method with optimistic update

- [ ] 2.3 Create Context provider in `webserver/frontend/feature/mushroom/sub-feature/project-management/context/tags-view-controller-context.tsx`
  - [ ] 2.3.1 Create `TagsViewControllerContext`
  - [ ] 2.3.2 Create `TagsViewControllerProvider` component
  - [ ] 2.3.3 Create `useTagsViewController()` hook

## 3. Frontend UI Components

- [ ] 3.1 Create `TagGroupContainer` component in `webserver/frontend/feature/mushroom/sub-feature/project-management/component/tag-group-container.tsx`
  - [ ] 3.1.1 Define props interface (title, count, description, tags, actions)
  - [ ] 3.1.2 Implement header with title, badge, and description
  - [ ] 3.1.3 Implement tag list with flex-wrap layout
  - [ ] 3.1.4 Support optional actions slot for bulk delete button

- [ ] 3.2 Create `TagItem` component in `webserver/frontend/feature/mushroom/sub-feature/project-management/component/tag-item.tsx`
  - [ ] 3.2.1 Use `ClosableWrapper` for hover-to-show delete interaction
  - [ ] 3.2.2 Display tag name and usage count
  - [ ] 3.2.3 Handle delete click with callback
  - [ ] 3.2.4 Hide delete button for system tags (`is_system=True`)
  - [ ] 3.2.5 Hide delete button for tags with `usage_count > 0` (only unused tags are deletable)

- [ ] 3.3 Create delete confirmation dialog in `webserver/frontend/feature/mushroom/sub-feature/project-management/component/tag-delete-confirm-dialog.tsx`
  - [ ] 3.3.1 Use AlertDialog component from UI library
  - [ ] 3.3.2 Accept props for tag name, count (for bulk), and onConfirm callback
  - [ ] 3.3.3 Handle confirm and cancel actions

- [ ] 3.4 Create tag creation dialog in `webserver/frontend/feature/mushroom/sub-feature/project-management/component/create-tag-dialog.tsx`
  - [ ] 3.4.1 Use Dialog component from UI library
  - [ ] 3.4.2 Include input field for tag name
  - [ ] 3.4.3 Disable "Create" button when input is empty
  - [ ] 3.4.4 Handle confirm and cancel actions
  - [ ] 3.4.5 Display error messages from backend

- [ ] 3.5 Create tags page content panel in `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/tags-page/tags-content-panel.tsx`
  - [ ] 3.5.1 Use `TagsViewController` via context
  - [ ] 3.5.2 Display loading state while fetching data
  - [ ] 3.5.3 Display error state if fetch fails
  - [ ] 3.5.4 Render "Create Tag" button in top-right area (left of any Bulk Edit button)
  - [ ] 3.5.5 Render three `TagGroupContainer` components for Your Tags, All Tags, Unused Tags
  - [ ] 3.5.6 Wire up delete interactions to view controller methods
  - [ ] 3.5.7 Wire up create tag interaction to view controller method

## 4. Frontend Pages and Routing

- [ ] 4.1 Create tags page entry in `webserver/frontend/feature/mushroom/sub-feature/project-management/page/tags-page.tsx`
  - [ ] 4.1.1 Accept `projectId` prop
  - [ ] 4.1.2 Create `TagsViewController` instance
  - [ ] 4.1.3 Manage lifecycle with `useEffect`
  - [ ] 4.1.4 Provide context with `TagsViewControllerProvider`
  - [ ] 4.1.5 Render desktop/mobile variants based on breakpoint

- [ ] 4.2 Create desktop tags page in `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/tags-page/index.tsx`
  - [ ] 4.2.1 Use `TagsContentPanel` component
  - [ ] 4.2.2 Follow same structure as `DesktopAssetPage`

- [ ] 4.3 Create route file in `webserver/frontend/.vite/routes/mushroom/_layout/project/tags.tsx`
  - [ ] 4.3.1 Define `TagsSearchParams` type with `projectId`
  - [ ] 4.3.2 Configure route validation
  - [ ] 4.3.3 Set component to `TagsPage`

- [ ] 4.4 Update TanStack Router routes by running `bun run generate-routes`

## 5. Sidebar Integration

- [ ] 5.1 Update `sidebar-panel.tsx` to add Label icon button
  - [ ] 5.1.1 Import `IconButton` with `icon="label"`
  - [ ] 5.1.2 Position button to the left of Member button
  - [ ] 5.1.3 Add click handler to navigate to `/mushroom/project/tags?projectId={projectId}`
  - [ ] 5.1.4 Hide button in client view mode (same as Member button)

## 6. Testing

- [ ] 6.1 Backend testing
  - [ ] 6.1.1 Run `pytest` for tag usage endpoint tests
  - [ ] 6.1.2 Verify system tag protection
  - [ ] 6.1.3 Test with various tag counts and user scenarios

- [ ] 6.2 Frontend testing
  - [ ] 6.2.1 Test navigation from sidebar to tags page
  - [ ] 6.2.2 Test tag group rendering
  - [ ] 6.2.3 Test individual tag deletion with confirmation (only unused tags)
  - [ ] 6.2.4 Test delete button is hidden for tags with `usage_count > 0`
  - [ ] 6.2.5 Test bulk delete unused tags
  - [ ] 6.2.6 Test system tag delete button is hidden
  - [ ] 6.2.7 Test create tag dialog opens and closes correctly
  - [ ] 6.2.8 Test create tag success flow
  - [ ] 6.2.9 Test create tag with duplicate name shows error
  - [ ] 6.2.10 Test create tag button is disabled with empty input
  - [ ] 6.2.11 Test loading and error states

- [ ] 6.3 Integration testing
  - [ ] 6.3.1 Test full flow from navigation to deletion
  - [ ] 6.3.2 Test with actual project data
  - [ ] 6.3.3 Verify counts update correctly after operations

## 7. Code Quality

- [ ] 7.1 Run `bun biome:fix` in frontend directory for code formatting
- [ ] 7.2 Run `bun precommit` for TypeScript checks
- [ ] 7.3 Ensure all components follow Manager pattern guidelines
- [ ] 7.4 Verify all imports use full file paths (no index exports)

## 8. Documentation

- [ ] 8.1 Update component documentation if needed
- [ ] 8.2 Add comments for any complex business logic
