# Change: Add Tags Field to Ticket Detail View

## Why
Users need to be able to associate tags with evaluation tickets for better categorization and filtering. Currently, the ticket detail view in the asset preview panel only supports editing priority, status, and assignee, but lacks the ability to manage tags. This change adds a tags selector component to the ticket detail fields section.

## What Changes
- Add a new `TicketTagsFieldCard` component in the ticket detail view
- Create a reusable `TicketTagsSelector` component with internal view-controller for state management
  - The component uses a private view-controller internally for complex logic (tag fetching, creation, selection)
  - Externally, it accepts simple props (projectId, value, onChange) for easy integration
- The component will support both selecting existing tags and creating new tags inline
- Follow the existing pattern of field cards (AssigneeFieldCard, StatusFieldCard, PriorityFieldCard)
- Integrate with the existing tags API (`getTagsList`, `createTag`)
- Update the ticket update logic to handle tags association

## Design Rules References

This change SHALL follow the project's MVC architecture patterns and coding conventions as defined in:

- **[`.project-rules/frontend/architecture.md`](.project-rules/frontend/architecture.md)** - Manager pattern, state management, lifecycle methods
- **[`.project-rules/frontend/coding-conventions.md`](.project-rules/frontend/coding-conventions.md)** - Component props destructuring, code style
- **[`.project-rules/frontend/utility-managers.md`](.project-rules/frontend/utility-managers.md)** - `MapSelectionManager`, `createAutoKeyMiniQueryClient` usage

## UI Design

### Reference Images
- `.doc/image/tags-1.png` - Shows the dropdown with selectable tags list
- `.doc/image/tags-2.png` - Shows the tags selector with selected tags and input field

### Component Layout
The `TicketTagsSelector` component consists of two main sections:

1. **Dropdown Menu (when focused)**: Displays available tags with checkboxes
   - Vertical list layout with each item showing checkbox + tag name
   - Supports hierarchical display (child tags indented)
   - Selected items highlighted with background color
   - Scrollable when list is long

2. **Tags Input Area (always visible)**: Horizontal layout
   - Left side: Selected tags displayed as removable badges
   - Right side: Input field for adding/searching tags
   - Both elements on the same line, wrapped if needed

### Visual Style

The component SHALL follow the project's white theme design system using standard Tailwind classes:

**Selected Tag Badges:**
- Background: Standard tag badge color (project convention)
- Text: `text-color-title` for readability
- Border radius: `rounded-lg` (standard rounding)
- Padding: Compact horizontal padding
- Spacing: Gap between badges using flex gap utilities
- Delete button (×): `text-color-support` with hover state

**Input Field:**
- Background: `bg-bg-1` (standard input background)
- Text: `text-color-title`
- Border: `border border-line-1` with `hover:border-line-2`
- Border radius: `rounded-lg`
- Padding: Standard input padding (`px-3 py-2`)
- Focus state: Standard focus border styling

**Dropdown Menu:**
- Container: Standard dropdown background using project conventions
- List items: Standard dropdown item height and spacing
- Selected item: Highlighted background using standard selection color
- Checkbox: Standard checkbox styling using project's checkbox component

**Field Card (TicketTagsFieldCard):**
- Container: `rounded-lg bg-area-platform px-4 py-3` (matching other field cards)
- Label: `text-body-sm text-color-support` (matching AssigneeFieldCard pattern)
- Content area: Flex layout with gap utilities

### Interaction Behavior

1. **Focus on input**: Opens dropdown showing available tags
2. **Type to filter**: Dropdown filters tags as user types
3. **Click tag in dropdown**: Adds tag to selection, closes dropdown
4. **Type + Enter**: Creates new tag if it doesn't exist
5. **Click × on badge**: Removes tag from selection
6. **Click outside**: Closes dropdown

### Architecture

**View-Controller Pattern (Private):**

The `TicketTagsSelector` component SHALL use a private view-controller following the Manager pattern:

```typescript
// Internal organization (not exported):
component/
  └── ticket-tags-selector.tsx          // Public component (props interface)
      ├── TicketTagsSelectorViewController  // Private VC (internal logic)
      └── (implementation)
```

**View-Controller Responsibilities:**

1. **Tag Data Fetching** - Uses `createAutoKeyMiniQueryClient` (NOT `useAutoKeyQuery`)
   - Reference: `.project-rules/frontend/utility-managers.md`
   - Stable function reference for `fn` parameter
   - Query client store added to `combinedStore`

2. **Selection Management** - Uses `MapSelectionManager` for selected tags
   - Reference: `.project-rules/frontend/utility-managers.md`
   - Provides `hasKey()`, `toggle()`, `selectMap`, `size` methods
   - Selection store added to `combinedStore`

3. **State Management** - Uses Zustand store with `state` getter
   - Reference: `.project-rules/frontend/architecture.md`
   - Search keyword state
   - Dropdown open/close state
   - All state combined via `createCombinedStore`

4. **Business Logic Methods** - All operations in VC (no hooks)
   - `setKeyword(keyword: string)` - Update search filter
   - `handleTagSelect(tag: Tag)` - Add tag to selection
   - `handleTagRemove(tagId: string)` - Remove tag from selection
   - `handleCreateTag(name: string)` - Create new tag via API
   - `get filteredTags()` - Computed property for filtered options

**External Props Interface:**

```typescript
interface TicketTagsSelectorProps {
  projectId: string;           // Project to fetch tags from
  value: string[];             // Selected tag IDs (controlled)
  onChange: (tagIds: string[]) => void;  // Change callback
  disabled?: boolean;          // Optional disabled state (grays out, shows cursor-not-allowed)
  readonly?: boolean;          // Read-only mode (displays tags without edit controls)
}
```

**Read-Only Mode Behavior:**
- When `readonly=true`, the component displays selected tags as badges only
- No input field is shown
- No dropdown interaction is available
- No remove (×) buttons on tags
- Use this for display-only scenarios where tags should not be modified

**Component Structure:**

```tsx
// ticket-tags-selector.tsx
export function TicketTagsSelector(props: TicketTagsSelectorProps) {
  const { projectId, value, onChange, disabled, readonly } = props;

  // Create private VC internally (not exported)
  const [vc] = useState(() => new TicketTagsSelectorViewController(projectId, value, onChange));

  // Sync external value changes
  useEffect(() => {
    vc.syncExternalValue(value);
  }, [value, vc]);

  // Lifecycle
  useEffect(() => {
    vc.bootstrap();
    return () => vc.dispose();
  }, [vc]);

  // Read state from combinedStore
  const { selectedTags, availableTags, keyword, isLoading } = useCombinedStore(
    vc.combinedStore,
    () => ({ /* ... */ })
  );

  // Render UI
  if (readonly) {
    // Read-only mode: show tags as badges without edit controls
    return (
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <span key={tag.id} className="tag-badge">
            {tag.name}
          </span>
        ))}
      </div>
    );
  }

  // Edit mode: show tags with remove buttons + input field
  return (/* ... */);
}
```

### Reference Implementation

**Primary Reference:**
- `webserver/frontend/feature/mushroom/sub-feature/project-management/manager/tags/tags-view-controller.ts` - VC pattern
  - `createAutoKeyMiniQueryClient` usage for data fetching
  - `MapSelectionManager` for selection state
  - `createCombinedStore` for state composition
  - `get state()` pattern for state access

**Secondary Reference:**
- `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/tags-page/tags-content-panel.tsx` - Component usage
  - `useCombinedStore` pattern for reading state
  - Direct VC method calls (no wrapper hooks)
  - `vc.selectionManager` usage

**Component Reference:**
- `webserver/frontend/feature/mushroom/sub-feature/project-management/block/tag-filter-dropdown-button.tsx` - Dropdown patterns

### Integration Pattern

**TicketTagsFieldCard Implementation:**

```tsx
// In detail-fields-section.tsx
function TicketTagsFieldCard({ ticket, projectId, isClientViewMode, isUpdating, onTagsChange }) {
  if (!ticket) {
    // No ticket - show empty state
    return (/* ... */);
  }

  if (isUpdating) {
    // Loading state
    return (/* ... */);
  }

  // Client view mode - use readonly prop for display-only
  if (isClientViewMode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-area-platform px-4 py-3">
        <span className="font-medium text-body-sm text-color-support">Tags</span>
        <TicketTagsSelector
          projectId={projectId}
          value={ticket.tag_ids || []}
          onChange={() => {}}
          readonly={true}
        />
      </div>
    );
  }

  // Internal view mode - editable
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-area-platform px-4 py-3">
      <span className="font-medium text-body-sm text-color-support">Tags</span>
      <TicketTagsSelector
        projectId={projectId}
        value={ticket.tag_ids || []}
        onChange={onTagsChange}
      />
    </div>
  );
}
```

**Update Logic (in DetailFieldsSection component):**

```tsx
// No useTicketFieldHandlers hook - logic stays in component
const [isUpdatingTags, setIsUpdatingTags] = useState(false);

const handleTagsChange = async (tagIds: string[]) => {
  setIsUpdatingTags(true);
  try {
    await updateTicket(ticket.id, { tags: tagIds });
    await assetPreviewVC.assetTicketManager.refetch();
    fireTicketModified({ type: 'update', ticketId, projectId });
    Toast.success('Tags updated successfully');
  } catch (error) {
    Toast.error('Failed to update tags');
  } finally {
    setIsUpdatingTags(false);
  }
};
```

## Impact
- Affected specs: `ticket-tags` (new spec)
- Affected code:
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/block/section/detail-fields-section.tsx` (add new field card)
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/component/ticket-tags-selector.tsx` (new component with internal VC)
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/api/ticket.api.ts` (may need update for tags)
