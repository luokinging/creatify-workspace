# Change: Add Tag List Management Page

## Why
Users need a centralized interface to view, manage, and clean up tags within a project. Currently, tags can only be managed indirectly through evaluation tickets, making it difficult to see all tags, identify unused ones, and perform bulk cleanup operations.

## What Changes
- Add new route `/mushroom/project/tags` with `projectId` query parameter
- Add "Label" icon button in sidebar panel (left of Member button) to navigate to tags page
- Create tags management page with three tag groups:
  - **Your Tags**: Tags attached at least once by current user
  - **All Tags**: All tags in the project
  - **Unused Tags**: Tags not attached to any bookmarks, with bulk delete button
- Implement hover-to-show delete interaction with confirmation dialog (only for unused tags)
- Add "Create Tag" button in the page top-right area (left of Bulk Edit button if present)
- Implement tag creation dialog with input field for tag name
- Backend enhancements to support tag filtering and usage counting

## Impact
- **Affected specs**: New capability `tag-management`
- **Affected code**:
  - Frontend: `webserver/frontend/feature/mushroom/sub-feature/project-management/`
    - `page/desktop/sidebar/sidebar-panel.tsx` (add label button)
    - New tags page components
  - Backend: `webserver/backend/mushroom/views/tags.py` (enhance filtering and add usage endpoint)
- **Migration**: No database migrations required (MushroomTag model already exists)
