import { useState, useEffect, useCallback } from 'react';
import { Project, ProjectFilters, ProjectStore } from '../types/Project';
import '../types/electron';

const defaultFilters: ProjectFilters = {
  search: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc'
};

const defaultStore: ProjectStore = {
  projects: [],
  filters: defaultFilters
};

// Check if we're running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

// Generate sample projects for development (Note: These are placeholder projects for development)
const generateSampleProjects = (): Project[] => {
  const names = ['Dashboard App', 'E-commerce Site', 'Portfolio', 'Blog Platform', 'Chat App', 'Analytics Tool'];
  
  return names.map((name, index) => ({
    id: `project-${index + 1}`,
    name,
    description: `A modern ${name.toLowerCase()} built with React`,
    path: `/Users/${process.env.USER || 'user'}/faux-projects/${name.toLowerCase().replace(/\s+/g, '-')}`,
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
  }));
};

export const useProjectStore = () => {
  const [store, setStore] = useState<ProjectStore>(defaultStore);

  // Load projects from database on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        if (isElectron) {
          console.log('Loading projects from SQLite database');
          const projects = await window.electronAPI.db.getAllProjects();
          console.log('Loaded projects from database:', projects.length);
          setStore(prev => ({ ...prev, projects }));
          
          // If no projects exist, add sample data
          if (projects.length === 0) {
            console.log('No projects found, initializing with sample data');
            const sampleProjects = generateSampleProjects();
            for (const project of sampleProjects) {
              await window.electronAPI.db.addProject(project);
            }
            // Reload projects after adding samples
            const updatedProjects = await window.electronAPI.db.getAllProjects();
            setStore(prev => ({ ...prev, projects: updatedProjects }));
          }
        } else {
          // Fallback to localStorage for web/development
          console.log('Running in web mode, using localStorage');
          const saved = localStorage.getItem('foux-projects');
          if (saved) {
            const parsed = JSON.parse(saved);
            const projects = parsed.projects.map((p: any) => ({
              ...p,
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt),
              path: p.path || `/Users/${process.env.USER || 'user'}/faux-projects/${p.name.toLowerCase().replace(/\s+/g, '-')}`
            }));
            setStore({ ...parsed, projects });
          } else {
            const sampleProjects = generateSampleProjects();
            const initialStore = { ...defaultStore, projects: sampleProjects };
            setStore(initialStore);
            localStorage.setItem('foux-projects', JSON.stringify(initialStore));
          }
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        // Fallback to sample data
        const sampleProjects = generateSampleProjects();
        setStore({ ...defaultStore, projects: sampleProjects });
      }
    };

    loadProjects();
  }, []);

  // Function to refresh projects (useful after thumbnail updates)
  const refreshProjects = useCallback(async () => {
    try {
      if (isElectron) {
        console.log('🔄 Refreshing projects from database...');
        const projects = await window.electronAPI.db.getAllProjects();
        console.log('📊 Received projects from database:', projects?.length || 0, 'projects');
        setStore(prev => ({
          ...prev,
          projects: projects || []
        }));
        console.log('✅ Projects store updated successfully');
      }
    } catch (error) {
      console.error('❌ Failed to refresh projects:', error);
    }
  }, [isElectron]);

  // Save to localStorage for web mode
  useEffect(() => {
    if (!isElectron && store.projects.length > 0) {
      try {
        localStorage.setItem('foux-projects', JSON.stringify(store));
      } catch (error) {
        console.error('Failed to save projects to localStorage:', error);
      }
    }
  }, [store]);

  const addProject = async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (isElectron) {
        const newProject = await window.electronAPI.db.addProject(project);
        console.log('Project added to database:', newProject.name);
        
        // Generate fallback thumbnail for new projects immediately
        if (window.electronAPI.thumbnail) {
          try {
            console.log('🎨 Generating fallback thumbnail for new project:', newProject.name);
            await window.electronAPI.thumbnail.generateFallback(
              newProject.id, 
              newProject.name
            );
            console.log('✅ Fallback thumbnail generated successfully');
          } catch (error) {
            console.warn('⚠️ Failed to generate fallback thumbnail:', error);
          }
        }
        
        setStore(prev => ({
          ...prev,
          projects: [newProject, ...prev.projects]
        }));
        return newProject;
      } else {
        // Fallback for web mode
        const newProject: Project = {
          ...project,
          id: `project-${Date.now()}`,  
          path: project.path || `/Users/${process.env.USER || 'user'}/faux-projects/${project.name.toLowerCase().replace(/\s+/g, '-')}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setStore(prev => ({
          ...prev,
          projects: [newProject, ...prev.projects]
        }));
        return newProject;
      }
    } catch (error) {
      console.error('Failed to add project:', error);
      throw error;
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      if (isElectron) {
        const success = await window.electronAPI.db.updateProject(id, updates);
        if (success) {
          console.log('Project updated in database:', id);
          setStore(prev => ({
            ...prev,
            projects: prev.projects.map(p =>
              p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
            )
          }));
        }
      } else {
        // Fallback for web mode
        setStore(prev => ({
          ...prev,
          projects: prev.projects.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
          )
        }));
      }
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      if (isElectron) {
        const success = await window.electronAPI.db.deleteProject(id);
        if (success) {
          console.log('Project deleted from database:', id);
          setStore(prev => ({
            ...prev,
            projects: prev.projects.filter(p => p.id !== id)
          }));
        }
      } else {
        // Fallback for web mode
        setStore(prev => ({
          ...prev,
          projects: prev.projects.filter(p => p.id !== id)
        }));
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  };

  const setFilters = (filters: Partial<ProjectFilters>) => {
    setStore(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters }
    }));
  };

  // Filter and sort projects
  const filteredProjects = store.projects
    .filter(project =>
      store.filters.search === '' ||
      project.name.toLowerCase().includes(store.filters.search.toLowerCase()) ||
      project.description?.toLowerCase().includes(store.filters.search.toLowerCase())
    )
    .sort((a, b) => {
      const { sortBy, sortOrder } = store.filters;
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return {
    projects: filteredProjects,
    totalProjects: store.projects.length,
    filters: store.filters,
    addProject,
    updateProject,
    deleteProject,
    setFilters,
    refreshProjects
  };
};