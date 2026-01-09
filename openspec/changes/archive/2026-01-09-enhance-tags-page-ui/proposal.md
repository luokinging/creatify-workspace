# Change: Enhance Tags Page UI with Search and Bulk Edit

## Why
The current tags management page lacks search functionality and efficient bulk editing capabilities. Users need to quickly find specific tags and perform batch operations on multiple tags to improve their workflow efficiency.

## What Changes
- Add a search input above the "Your Tags" section for filtering all displayed tags (client-side filtering)
- Add a "Bulk Edit" button in the panel's top-right action menu
- When Bulk Edit is active, transform the button into a button group with "[Delete (count)]" and "[X]" buttons
- Allow tag selection during bulk edit mode with visual feedback (background color change + checkmark icon similar to ClosableWrapper)
- Remove the redundant "Delete All Unused" button from the panel header (keep only in Unused Tags group)
- Refactor Create Tag Dialog to use Input component instead of Textarea, use BasicDialog as base, and set all footer buttons to size="md"
- Add backend API endpoint for bulk delete operations

## Impact
- Affected specs: `tag-management`
- Affected code:
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/tags-page/tags-content-panel.tsx`
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/component/tag-create-dialog.tsx`
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/component/tag-item.tsx`
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/manager/tags/tags-view-controller.ts`
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/api/tags.api.ts`
  - Backend: New bulk delete endpoint for tags
