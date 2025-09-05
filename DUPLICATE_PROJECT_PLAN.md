# Duplicate Project Implementation Plan

## 🎯 Goal
Add functionality to duplicate existing projects with all files, configurations, and proper setup.

## 📋 Implementation Steps

### 1. Database Layer
- [ ] Add `duplicateProject(sourceId, newName?)` method to database.js
- [ ] Generate new unique ID and timestamps
- [ ] Handle name conflict resolution ("Copy of X", "X 2", etc.)
- [ ] Clear thumbnail field (will be regenerated later)

### 2. File System Operations
- [ ] Create `duplicateProjectFiles(sourcePath, destPath)` in projectScaffold.js
- [ ] Implement directory copying with exclusions:
  - `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, `.cache/`
- [ ] Add atomic operations with rollback on failure
- [ ] Validate disk space before copying

### 3. Project Configuration Updates
- [ ] Update `package.json` name field in duplicated project
- [ ] Update any hardcoded paths in configs
- [ ] Ensure no port conflicts in Vite/Storybook configs
- [ ] Reset any cached configurations

### 4. UI Components
- [ ] Add "Duplicate" option to ProjectCard dropdown menu
- [ ] Create progress modal for duplication process
- [ ] Add name input dialog for custom duplicate names
- [ ] Handle error states with user-friendly messages

### 5. IPC & API Layer
- [ ] Add `project:duplicate` IPC handler in main.js
- [ ] Add duplicate API to preload.js
- [ ] Add TypeScript declarations
- [ ] Add progress events for UI feedback

### 6. Frontend Integration
- [ ] Add duplicate handler to ProjectGrid.tsx
- [ ] Integrate with existing project store
- [ ] Add loading states and error handling
- [ ] Auto-refresh project list after duplication

### 7. Error Handling & Edge Cases
- [ ] Insufficient disk space validation
- [ ] Permission denied errors
- [ ] Source project currently running (servers/terminals)
- [ ] Invalid characters in project names
- [ ] Rollback mechanism for failed duplications

### 8. Testing & Polish
- [ ] Test with various project sizes
- [ ] Test name conflict resolution
- [ ] Test error scenarios
- [ ] Ensure thumbnail regeneration works
- [ ] Performance testing with large projects

## 🔧 Technical Details

### Name Resolution Strategy
```
"MyProject" → "Copy of MyProject"
"Copy of MyProject" → "MyProject 2"  
"MyProject 2" → "MyProject 3"
```

### File Exclusion Patterns
```javascript
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build', 
  '.next',
  '.cache',
  '.turbo',
  'coverage'
];
```

### Duplication Flow
1. Validate source project exists
2. Generate unique name and path
3. Check disk space
4. Copy files with exclusions
5. Update project configurations
6. Save to database
7. Regenerate thumbnail
8. Refresh UI

## 🎨 UI Mockup
```
ProjectCard Dropdown:
├── Rename
├── Duplicate  ← NEW
└── Delete
```

Progress Modal:
```
Duplicating "MyProject"...
📁 Copying files... (1.2MB / 5.4MB)
⚙️ Updating configurations...
✅ Complete!
```

## 🚨 Risk Mitigation
- Atomic operations with cleanup on failure
- Disk space validation before starting
- Progress indication for user feedback
- Detailed error messages with suggested actions
- Rollback mechanism for partial failures

## 📝 Implementation Priority
1. **Core functionality** (database + file copying)
2. **UI integration** (dropdown + progress)
3. **Error handling** (validation + rollback)
4. **Polish** (thumbnails + optimization)