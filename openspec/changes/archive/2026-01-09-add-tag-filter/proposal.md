# Change: Add Tag Filter to Content Toolbar

## Why

Users need to filter assets/folders by tags in the project management content view, similar to how they can filter by date. The tag filter allows users to quickly find assets with specific tags, improving navigation and organization within large projects.

## What Changes

- Add a new `TagFilterDropdownButton` component positioned to the right of the Date filter in the content toolbar
- Implement tag filtering state in `ProjectViewStateManager` (add `tagFilter` state)
- Update `ProjectDataQueryManager` to include tag filter in asset/folder queries
- Create a FlexibleDropdown-based component that displays available tags with checkbox selection
- Support multi-tag selection (filter by any selected tag)
- Display selected tag count in the trigger button
- Follow the same UI pattern as the existing Date filter (text button with icon)

## Impact

- Affected specs: `project-asset-filtering` (new capability)
- Affected code:
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/content-toolbar.tsx` - Add TagFilterDropdownButton
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/manager/project-file/project-view-state-manager.ts` - Add tagFilter state
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/manager/project-file/project-data-query-manager.ts` - Apply tag filter to queries
  - `webserver/frontend/feature/mushroom/sub-feature/project-management/block/tag-filter-dropdown-button.tsx` - New component
