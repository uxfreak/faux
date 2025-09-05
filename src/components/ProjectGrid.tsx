import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectCard } from './ProjectCard';
import { CreateProjectModal } from './CreateProjectModal';
import { DuplicateProjectModal } from './DuplicateProjectModal';
import { RenameProjectModal } from './RenameProjectModal';
import { ProjectViewer } from './ProjectViewer';
import { ThemeToggle } from './ThemeToggle';
import { Dropdown } from './Dropdown';
import { ProjectFilters, Project } from '../types/Project';
import { useProjectStore } from '../hooks/useProjectStore';

export const ProjectGrid = () => {
  const { projects, totalProjects, filters, setFilters, deleteProject, updateProject, addProject, refreshProjects } = useProjectStore();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [projectToDuplicate, setProjectToDuplicate] = useState<Project | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const handleSearch = (search: string) => {
    setFilters({ search });
  };

  const toggleSearch = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (isSearchExpanded) {
      handleSearch('');
      setIsSearchExpanded(false);
      // Remove focus and reset hover state
      if (e?.currentTarget) {
        e.currentTarget.blur();
        e.currentTarget.style.color = 'var(--color-text-secondary)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }
    } else {
      setIsSearchExpanded(true);
    }
  };

  const closeSearch = () => {
    handleSearch('');
    setIsSearchExpanded(false);
  };

  // Handle click outside to collapse search when empty
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSearchExpanded && 
        !filters.search && 
        searchContainerRef.current && 
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchExpanded, filters.search]);

  // Listen for thumbnail updates and refresh projects
  useEffect(() => {
    console.log('🔗 Setting up thumbnail update listener in ProjectGrid');
    
    if (window.electronAPI?.onThumbnailUpdated) {
      const cleanup = window.electronAPI.onThumbnailUpdated((data) => {
        console.log('📸 ProjectGrid received thumbnail update for project:', data.projectId);
        console.log('🔄 Refreshing projects list...');
        // Always refresh the projects list to show the new thumbnail
        // This works even when we're in ProjectViewer mode
        refreshProjects();
      });

      console.log('✅ Thumbnail update listener setup complete');
      return cleanup;
    } else {
      console.warn('⚠️ Thumbnail update API not available');
    }
  }, []); // Remove refreshProjects dependency to prevent loop

  // Listen for thumbnails cleared event
  useEffect(() => {
    if (window.electronAPI?.onThumbnailsCleared) {
      const cleanup = window.electronAPI.onThumbnailsCleared((data) => {
        console.log('🧹 All thumbnails cleared, refreshing projects list...');
        refreshProjects();
      });

      return cleanup;
    }
  }, []); // Remove refreshProjects dependency to prevent loop


  // Global function to clear and regenerate all thumbnails (for testing)
  useEffect(() => {
    (window as any).clearAllThumbnails = async () => {
      if (window.electronAPI?.thumbnail.clearAll) {
        console.log('🧹 Clearing all thumbnails...');
        const result = await window.electronAPI.thumbnail.clearAll();
        console.log('Thumbnails cleared:', result);
      }
    };
  }, []);

  // Also refresh projects when currentProject changes (when navigating back)
  useEffect(() => {
    if (currentProject === null) {
      // We just navigated back to the grid
      console.log('📊 Back to grid - refreshing projects');
      setTimeout(() => refreshProjects(), 50);
    }
  }, [currentProject]); // Removed refreshProjects from dependencies to prevent loop

  const handleSort = (sortBy: ProjectFilters['sortBy']) => {
    const sortOrder = filters.sortBy === sortBy && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    setFilters({ sortBy, sortOrder });
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject(id);
    }
  };

  const handleOpenProject = (project: Project) => {
    console.log('Opening project:', project.name);
    setCurrentProject(project);
  };

  const handleBackToGrid = () => {
    console.log('🔙 Navigating back to project grid');
    setCurrentProject(null);
    // Refresh projects when returning to grid to show any thumbnail updates
    setTimeout(() => {
      console.log('🔄 Refreshing projects after returning to grid');
      refreshProjects();
    }, 100); // Small delay to ensure component is rendered
  };

  const handleRenameProject = (project: Project) => {
    console.log('Opening rename modal for:', project.name);
    setEditingProject(project);
  };

  const handleRenameComplete = async (project: Project, newName: string) => {
    try {
      console.log('Renaming project:', project.name, '→', newName);
      
      // Use the new rename API that handles both database and filesystem
      const result = await window.electronAPI.renameProject(project.id, newName);
      
      if (result.success) {
        console.log('Project renamed successfully:', result.newName);
        console.log('Folder path updated:', result.oldPath, '→', result.newPath);
        // Refresh projects to show the updated name and path
        refreshProjects();
      } else {
        throw new Error(result.error || 'Failed to rename project');
      }
    } catch (error) {
      console.error('Failed to rename project:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to rename project');
    }
  };

  const handleCloseRenameModal = () => {
    setEditingProject(null);
  };

  const handleDuplicateProject = (project: Project) => {
    console.log('Opening duplicate modal for:', project.name);
    setProjectToDuplicate(project);
    setIsDuplicateModalOpen(true);
  };

  const handleDuplicateComplete = (duplicatedProject: Project) => {
    console.log('Duplication completed:', duplicatedProject.name);
    // Refresh projects to show the new duplicate
    refreshProjects();
    setProjectToDuplicate(null);
  };

  const handleCloseDuplicateModal = () => {
    setIsDuplicateModalOpen(false);
    setProjectToDuplicate(null);
  };

  const handleCreateProject = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateProjectSubmit = (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    addProject(projectData);
    setIsCreateModalOpen(false);
  };


  // If a project is selected, show the ProjectViewer
  if (currentProject) {
    return (
      <ProjectViewer
        project={currentProject}
        onBack={handleBackToGrid}
        onProjectUpdate={(updatedProject) => {
          console.log('📝 ProjectGrid: Updating project state with deployment URL');
          setCurrentProject(updatedProject);
          // Also refresh the projects list to reflect the change in the grid
          refreshProjects();
        }}
      />
    );
  }

  return (
    <div 
      className="project-dashboard w-full h-full p-8 overflow-y-auto flex flex-col gap-12"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      data-component="dashboard"
    >
      {/* Header */}
      <div className="dashboard-header w-full flex-shrink-0 flex flex-col gap-6" data-section="header">
        <div className="header-title-bar flex items-center justify-between" data-section="title-bar">
          <div className="title-section flex items-center gap-4">
            <h1 className="dashboard-title text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Projects
            </h1>
          </div>
          
          <div className="header-actions flex items-center gap-4" data-section="actions">
            {/* Show search and sort only if there are projects */}
            {totalProjects > 0 && (
              <div className="project-controls flex items-center gap-1" data-section="controls">
                {/* Animated inline search */}
                <div className="search-container flex items-center relative" ref={searchContainerRef} data-control="search">
                  {/* Search toggle button */}
                  <motion.button
                    onClick={(e) => toggleSearch(e)}
                    className="search-trigger p-2 transition-colors focus:outline-none"
                    style={{
                      color: isSearchExpanded ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      backgroundColor: isSearchExpanded ? 'var(--color-surface-hover)' : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSearchExpanded) {
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    title={isSearchExpanded ? "Close search" : "Search projects"}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isSearchExpanded ? (
                      <motion.svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        initial={{ rotate: 0 }}
                        animate={{ rotate: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </motion.svg>
                    ) : (
                      <motion.svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        initial={{ rotate: 0 }}
                        animate={{ rotate: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </motion.svg>
                    )}
                  </motion.button>
                  
                  {/* Expanding search input - positioned absolutely to avoid layout shifts */}
                  <AnimatePresence>
                    {isSearchExpanded && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ 
                          duration: 0.3, 
                          ease: [0.25, 0.46, 0.45, 0.94] // easeOutQuart
                        }}
                        className="absolute right-full mr-2 top-0 overflow-hidden"
                        style={{ height: '40px' }}
                        data-control="search-input"
                      >
                        <input
                          type="text"
                          placeholder="Search projects..."
                          value={filters.search}
                          onChange={(e) => handleSearch(e.target.value)}
                          className="search-input w-full h-full px-3 py-2 text-sm border transition-all focus:outline-none"
                          style={{
                            backgroundColor: 'var(--color-bg-primary)',
                            borderColor: 'var(--color-border-secondary)',
                                  color: 'var(--color-text-primary)'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--color-border-focus)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'var(--color-border-secondary)';
                          }}
                          autoFocus
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sort dropdown */}
                <Dropdown
                  trigger={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                  }
                  options={[
                    {
                      value: 'updatedAt-desc',
                      label: 'Recently updated',
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )
                    },
                    {
                      value: 'updatedAt-asc',
                      label: 'Least recently updated',
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )
                    },
                    {
                      value: 'createdAt-desc',
                      label: 'Recently created',
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )
                    },
                    {
                      value: 'createdAt-asc',
                      label: 'Oldest first',
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )
                    },
                    {
                      value: 'name-asc',
                      label: 'Name A-Z',
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                        </svg>
                      )
                    },
                    {
                      value: 'name-desc',
                      label: 'Name Z-A',
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      )
                    }
                  ]}
                  value={`${filters.sortBy}-${filters.sortOrder}`}
                  onChange={(value) => {
                    const [sortBy, sortOrder] = value.split('-') as [ProjectFilters['sortBy'], 'asc' | 'desc'];
                    setFilters({ sortBy, sortOrder });
                  }}
                />
              </div>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Create button */}
            <button
              onClick={handleCreateProject}
              className="create-project-action px-4 py-2 transition-colors flex items-center gap-2"
              style={{
                backgroundColor: 'var(--color-action-primary)',
                color: 'var(--color-bg-primary)',
                border: '1px solid var(--color-action-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </div>
        </div>
      </div>

      {/* Project grid */}
      <div className="projects-content w-full flex-1 flex flex-col gap-6" data-section="content">
        {projects.length === 0 ? (
          <div className="empty-state flex items-center justify-center flex-1 min-h-96" data-state="empty">
            <div className="empty-state-content text-center" data-content="empty-message">
              <svg className="empty-state-icon w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-text-tertiary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="empty-state-title text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                {filters.search ? 'No projects found' : 'No projects yet'}
              </h3>
              <p className="empty-state-description mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                {filters.search 
                  ? `No projects match "${filters.search}". Try a different search term.`
                  : 'Get started by creating your first project.'
                }
              </p>
              {filters.search ? (
                <button
                  onClick={closeSearch}
                  className="empty-state-action clear-search-action px-4 py-2 transition-colors"
                  style={{
                    backgroundColor: 'var(--color-action-primary)',
                        color: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-action-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
                  }}
                >
                  Clear search
                </button>
              ) : (
                <button
                  onClick={handleCreateProject}
                  className="empty-state-action create-first-project-action px-4 py-2 transition-colors"
                  style={{
                    backgroundColor: 'var(--color-action-primary)',
                        color: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-action-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
                  }}
                >
                  Create your first project
                </button>
              )}
            </div>
          </div>
        ) : (
          <motion.div 
            className="projects-grid grid grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            data-grid="projects"
          >
            <AnimatePresence>
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ 
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: "easeOut"
                  }}
                  layout
                  data-item="project-card"
                >
                  <ProjectCard
                    project={project}
                    onRename={handleRenameProject}
                    onDuplicate={handleDuplicateProject}
                    onDelete={handleDeleteProject}
                    onOpen={handleOpenProject}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateProject={handleCreateProjectSubmit}
      />

      {/* Duplicate Project Modal */}
      <DuplicateProjectModal
        isOpen={isDuplicateModalOpen}
        project={projectToDuplicate}
        onClose={handleCloseDuplicateModal}
        onDuplicateComplete={handleDuplicateComplete}
      />

      {/* Rename Project Modal */}
      <RenameProjectModal
        isOpen={!!editingProject}
        project={editingProject}
        onClose={handleCloseRenameModal}
        onRename={handleRenameComplete}
        existingProjects={projects}
      />
    </div>
  );
};