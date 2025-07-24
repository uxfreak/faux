# Faux - Designer-Focused UX Project Tool

## Project Overview

Faux is an Electron application designed for product designers and UX designers to embrace "vibe-coding" workflows for their UX projects. Each project is essentially a Vite+Storybook+Tailwind project running under the hood, with designers interacting through a visual interface without exposure to code.

## Architecture

### Technology Stack
- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron with better-sqlite3 database
- **Styling**: Tailwind CSS with custom design tokens
- **Animations**: Framer Motion
- **Project Structure**: Each project = Vite + Storybook + Tailwind

### Design System

#### Design Tokens
Located in `src/styles/tokens.css`, providing consistent theming across light/dark/system modes:
- Colors: Primary, secondary, tertiary text colors
- Backgrounds: Primary, secondary, overlay backgrounds  
- Borders: Primary, secondary, focus border colors
- Surfaces: Hover, active, selected surface colors
- Shadows: Small, medium, large shadow definitions
- **Border Radius**: All set to 0 for sharp, minimal aesthetic

#### Component Architecture
```
src/components/
├── ProjectGrid.tsx          # Main dashboard with project management
├── ProjectViewer.tsx        # Full-screen project view container
├── ProjectHeader.tsx        # Project navigation and mode toggle
├── MainContent.tsx          # Embedded Vite/Storybook content area
├── TerminalPane.tsx         # Right-docked AI terminal
├── ModeToggle.tsx           # Three-state toggle (Preview/Components/AI)
├── ProjectCard.tsx          # Project thumbnail cards
├── CreateProjectModal.tsx   # Project creation interface
├── Dropdown.tsx             # Reusable dropdown component
└── ThemeToggle.tsx          # System/light/dark theme selector
```

## UI Navigation Flow

### Dashboard View (ProjectGrid)
**Purpose**: Project management and overview
**Layout**: 3-column grid with search, sort, and create functionality
**Semantic Structure**:
```
[data-component="dashboard"]
├── [data-section="header"]
│   ├── [data-section="title-bar"] 
│   └── [data-section="controls"]
│       ├── [data-control="search"]
│       ├── [data-control="sort"]
│       └── [data-control="theme"]
└── [data-section="content"]
    └── [data-grid="projects"]
        └── [data-item="project-card"] (multiple)
```

### Project View (ProjectViewer)
**Purpose**: Individual project workspace with embedded Vite/Storybook
**Layout**: Header + main content + optional terminal pane
**Semantic Structure**:
```
[data-component="project-viewer"]
├── [data-section="header"]
│   ├── [data-section="navigation"]
│   │   ├── [data-control="back"]
│   │   └── [data-section="project-info"]
│   └── [data-section="controls"]
│       └── [data-control="mode-toggle"]
│           ├── [data-mode="preview"]
│           ├── [data-mode="components"] 
│           └── [data-mode="ai"]
└── [data-section="content"]
    ├── [data-section="main-content"]
    │   └── [data-content="embedded-view"]
    │       ├── [data-view="preview"]      # Vite dev server
    │       ├── [data-view="components"]   # Storybook interface
    │       └── [data-view="ai"]           # Preview + terminal
    └── [data-section="terminal"] (conditional)
        └── [data-component="terminal-pane"]
```

## View Modes

### Preview Mode (Default)
- **Purpose**: Live preview of the Vite development server
- **Content**: Embedded Vite app interface
- **State**: `data-mode="preview"`

### Components Mode  
- **Purpose**: Component library exploration via Storybook
- **Content**: Embedded Storybook interface
- **State**: `data-mode="components"`

### AI Mode
- **Purpose**: AI-assisted development with terminal access
- **Content**: Preview + right-docked terminal pane
- **State**: `data-mode="ai"`
- **Terminal**: Right-docked, 30% width, slides in/out

## Component Details

### ProjectViewer
**Responsibility**: Main project workspace container
**Key Features**:
- Conditional terminal pane rendering (30%/70% split)
- Smooth view mode transitions
- Project context management
- Framer Motion page transitions

### ProjectHeader  
**Responsibility**: Project navigation and mode switching
**Layout**: Flexbox with back button + project info (left) and mode toggle + theme (right)
**Interactive Elements**:
- Back navigation to dashboard
- Three-state mode toggle
- Theme switcher integration

### ModeToggle
**Responsibility**: Three-state toggle for view modes
**Design**: Grouped buttons with active state styling
**States**: Preview (default), Components, AI
**Behavior**: AI mode automatically opens terminal pane

### MainContent
**Responsibility**: Content embedding area for external servers
**Responsive**: Adjusts width based on terminal pane visibility
**Content Types**:
- Preview: Vite development server (placeholder)
- Components: Storybook interface (placeholder)  
- AI: Preview mode with terminal sidebar

### TerminalPane
**Responsibility**: AI-powered terminal interface
**Layout**: Header + content + input areas
**Features**:
- Project context awareness (starts in project directory)
- Close button with smooth hide animation
- Terminal-style dark theme
- Command input placeholder

## Data Flow

### Project State Management
```typescript
// Project selection state
const [currentProject, setCurrentProject] = useState<Project | null>(null);

// View mode state  
const [viewMode, setViewMode] = useState<ViewMode>('preview');

// Terminal visibility
const [isTerminalOpen, setIsTerminalOpen] = useState(false);
```

### Navigation Flow
1. **Dashboard → Project**: Click project card → `handleOpenProject()` → `setCurrentProject()`
2. **Project → Dashboard**: Click back button → `handleBackToGrid()` → `setCurrentProject(null)`
3. **Mode Switching**: Toggle mode → `handleModeChange()` → Updates view + terminal state

## Responsive Design

### Layout Principles
- **Flexbox everywhere**: No CSS Grid except for project cards
- **Semantic containers**: Every div has semantic significance
- **Minimal nesting**: Fewest possible container layers
- **Data attributes**: All elements have semantic selectors

### Breakpoint Behavior
- **Terminal Pane**: Fixed 30% width, slides in/out
- **Main Content**: Responsive width (70% with terminal, 100% without)
- **Project Grid**: Fixed 3-column layout
- **Header Elements**: Flexible spacing with gaps

## Styling Guidelines

### Design Tokens Usage
```css
/* Colors */
color: var(--color-text-primary);
background-color: var(--color-bg-secondary);
border-color: var(--color-border-primary);

/* Interactive States */  
background-color: var(--color-surface-hover);
border-color: var(--color-border-focus);

/* Shadows */
box-shadow: var(--shadow-sm);
```

### Animation Patterns
```typescript
// Page transitions
initial={{ opacity: 0, x: 20 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -20 }}

// Terminal pane slide
initial={{ width: 0, opacity: 0 }}
animate={{ width: '30%', opacity: 1 }}
exit={{ width: 0, opacity: 0 }}

// Button interactions
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

## Future Implementation Notes

### Server Integration (Phase 2)
- Each project will spawn Vite + Storybook servers
- MainContent will embed actual server content via webView/BrowserView
- Port management system for concurrent projects
- Server lifecycle tied to project view state

### Terminal Integration (Phase 3)  
- Replace placeholder with xterm.js + node-pty
- Real terminal sessions in project directories
- AI command processing and assistance
- Process cleanup on project close

### Project Scaffolding (Phase 4)
- Integration with setup script for Vite+Storybook+Tailwind
- Template system for different project types
- Automatic dependency management
- Git repository initialization

## Development Guidelines

### Code Style
- **TypeScript**: Strict typing for all components
- **Props**: Interface definitions with data-attribute support
- **Naming**: Semantic BEM-style class names
- **Structure**: Single responsibility components

### Data Attributes
Every interactive element must have semantic data attributes:
```typescript
data-component="component-name"    // Top-level component identifier
data-section="section-name"        // Major layout sections  
data-control="control-name"        // Interactive elements
data-info="info-type"             // Informational content
data-state="current-state"        // Dynamic state indicators
```

### Testing Considerations
- Data attributes enable reliable test selectors
- Component isolation for unit testing
- State management testing via hooks
- Animation testing with reduced motion support