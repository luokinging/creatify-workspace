## 1. Frontend Implementation

- [x] 1.1 Update `TagsContentPanel` to add search input above "Your Tags" section
  - Add Input component with icon="search" and placeholder="Search"
  - Implement client-side filter logic for all tag groups
  - Store search query state in TagsViewController

- [x] 1.2 Add Bulk Edit mode to `TagsContentPanel`
  - Add "Bulk Edit" button in top-right action menu
  - Transform button to button group "[Delete (count)] [X]" when bulk edit is active
  - Add bulk edit state management to TagsViewController

- [x] 1.3 Update `TagItem` component to support selection mode
  - Add visual feedback for selected state (background color change)
  - Add checkmark icon in top-right corner when selected (similar to ClosableWrapper)
  - Handle click events for selection during bulk edit mode
  - Store selected tag IDs in TagsViewController

- [x] 1.4 Remove redundant "Delete All Unused" button from panel header
  - Keep the button only in the Unused Tags group footer

- [x] 1.5 Refactor `TagCreateDialog`
  - Replace Textarea with Input component
  - Change base from Dialog to BasicDialog
  - Set all footer buttons to size="md"

## 2. Backend Implementation

- [x] 2.1 Create bulk delete API endpoint
  - Add DELETE endpoint `/api/mushroom/tags/bulk-delete/`
  - Accept list of tag IDs in request body
  - Delete all specified tags
  - Return success response with count of deleted tags

## 3. Integration and Testing

- [x] 3.1 Wire up bulk delete functionality
  - Add bulk delete API call to tags.api.ts
  - Integrate with TagsViewController
  - Show confirmation dialog before bulk delete

- [x] 3.2 Test search functionality
  - Verify filtering works across all tag groups
  - Test search query persistence during bulk operations

- [x] 3.3 Test bulk edit workflow
  - Verify tag selection/deselection works correctly
  - Verify delete count updates in real-time
  - Test cancel bulk edit functionality

- [x] 3.4 Test Create Tag Dialog changes
  - Verify Input component works correctly
  - Verify button sizes are consistent
  - Test dialog behavior with BasicDialog
