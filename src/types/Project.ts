export interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string; // Base64 or file path
  path: string; // Full path to project directory
  deploymentUrl?: string; // Netlify site URL if deployed
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFilters {
  search: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

export interface ProjectStore {
  projects: Project[];
  filters: ProjectFilters;
}