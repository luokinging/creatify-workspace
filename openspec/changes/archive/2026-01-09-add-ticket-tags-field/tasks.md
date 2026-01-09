## 1. TicketTagsSelector Component (with internal View-Controller)

### 1.1 Create TicketTagsSelectorViewController (private, internal)
- [x] Create VC class following Manager pattern (ref: `.project-rules/frontend/architecture.md`)
- [x] Implement `createAutoKeyMiniQueryClient` for fetching tags list (ref: `.project-rules/frontend/utility-managers.md`)
  - [x] Use stable function reference (`getTagsList`) for `fn` parameter
  - [x] Configure `fnParams` with `[projectId]`
  - [x] Add query client store to `combinedStore`
- [x] Implement `MapSelectionManager` for selected tags state (ref: `.project-rules/frontend/utility-managers.md`)
  - [x] Initialize with `(tag: Tag) => tag.id` key extractor
  - [x] Add selection store to `combinedStore`
- [x] Create Zustand store for component state
  - [x] Search keyword state
  - [x] Dropdown open/close state
  - [x] Implement `get state()` getter following project pattern
- [x] Create `combinedStore` combining all stores
- [x] Implement `bootstrap(projectId, initialValue)` lifecycle method
- [x] Implement `dispose()` lifecycle method
- [x] Implement business logic methods:
  - [x] `setKeyword(keyword: string)` - Update search filter
  - [x] `syncExternalValue(tagIds: string[])` - Sync with external value prop
  - [x] `handleTagSelect(tag: Tag)` - Add tag via selectionManager
  - [x] `handleTagRemove(tagId: string)` - Remove tag via selectionManager
  - [x] `handleCreateTag(name: string)` - Create new tag via API
  - [x] `get filteredTags()` - Computed property for filtered dropdown options

### 1.2 Create TicketTagsSelector component (public)
- [x] Follow component props destructuring pattern (ref: `.project-rules/frontend/coding-conventions.md`)
  - [x] Use `(props: TicketTagsSelectorProps)` signature
  - [x] Destructure in function body: `const { projectId, value, onChange, disabled, readonly } = props;`
- [x] Create internal VC instance using `useState`
- [x] Implement `useEffect` for lifecycle (bootstrap/dispose)
- [x] Implement `useEffect` to sync external value changes
- [x] Use `useCombinedStore` to read state from `vc.combinedStore`
- [x] Implement UI rendering:
  - [x] Read-only mode display (when `readonly=true`)
    - [x] Show selected tags as badges only
    - [x] No input field
    - [x] No remove buttons
    - [x] No dropdown interaction
  - [x] Edit mode display (when `readonly=false`)
    - [x] Selected tags badges with remove buttons
    - [x] Input field for search/create
    - [x] Dropdown with `CheckboxDropdown` component
  - [x] Loading state display
  - [x] Error state display
  - [x] Disabled state styling (when `disabled=true`)
- [x] Wire up event handlers to VC methods (no wrapper hooks)

## 2. TicketTagsFieldCard Integration

### 2.1 Create TicketTagsFieldCard component
- [x] Follow existing field card pattern (AssigneeFieldCard, StatusFieldCard, PriorityFieldCard)
- [x] Implement read-only display mode (for no ticket or client view mode)
- [x] Implement loading state display
- [x] Implement edit mode with TicketTagsSelector
- [x] Use proper styling: `rounded-lg bg-area-platform px-4 py-3`

### 2.2 Integrate into DetailFieldsSection
- [x] Add `isUpdatingTags` state in component
- [x] Add `handleTagsChange` async function (NOT a hook)
  - [x] Call `updateTicket` API
  - [x] Refetch ticket data
  - [x] Fire `fireTicketModified` event
  - [x] Show success/error toast
- [x] Add TicketTagsFieldCard below PriorityFieldCard
- [x] Pass required props (ticket, projectId, isClientViewMode, isUpdating, onTagsChange)

## 3. API Updates
- [x] Verify ticket API supports tags updates (check `UpdateTicketParams`)
- [x] Add `tags?: string[]` field if not present
- [x] Test tag creation and association workflow

## 4. Testing
- [x] 4.1 Test tag selection from dropdown
- [x] 4.2 Test new tag creation via input
- [x] 4.3 Test tag removal
- [x] 4.4 Test error handling (duplicate tags, API failures)
- [x] 4.5 Test in internal view mode (editable)
- [x] 4.6 Test in client view mode (read-only via readonly prop)
- [x] 4.7 Test external value synchronization
- [x] 4.8 Test component unmounting (dispose cleanup)
- [x] 4.9 Test readonly mode displays tags without edit controls
- [x] 4.10 Test disabled mode shows grayed out styling
- [x] 4.11 Test readonly=true prevents all interactions

## 5. Code Quality
- [x] Run `bun biome:fix` for formatting
- [x] Run `bun precommit` for type checking
- [x] Ensure all rules from `.project-rules/frontend/` are followed
