import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class DatabaseService {
  constructor() {
    // Database file will be stored in app's userData directory
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'projects.db');
    
    console.log('Database path:', dbPath);
    
    this.db = new Database(dbPath);
    
    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    
    this.initializeTables();
  }

  initializeTables() {
    // Create projects table
    const createProjectsTable = `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        thumbnail TEXT,
        path TEXT NOT NULL,
        deploymentUrl TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `;
    
    this.db.exec(createProjectsTable);
    
    // Add path column to existing tables if it doesn't exist
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN path TEXT');
      console.log('Added path column to existing projects table');
    } catch (error) {
      // Column already exists, ignore error
    }
    
    // Add deploymentUrl column to existing tables if it doesn't exist
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN deploymentUrl TEXT');
      console.log('Added deploymentUrl column to existing projects table');
    } catch (error) {
      // Column already exists, ignore error
    }
    
    // Add lastDeployedAt column to existing tables if it doesn't exist
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN lastDeployedAt INTEGER');
      console.log('Added lastDeployedAt column to existing projects table');
    } catch (error) {
      // Column already exists, ignore error
    }
    
    // Add storybookUrl column to existing tables if it doesn't exist
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN storybookUrl TEXT');
      console.log('Added storybookUrl column to existing projects table');
    } catch (error) {
      // Column already exists, ignore error
    }
    
    // Add viewportMode column to existing tables if it doesn't exist
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN viewportMode TEXT DEFAULT "desktop"');
      console.log('Added viewportMode column to existing projects table');
    } catch (error) {
      // Column already exists, ignore error
    }
    
    // Add viewSettings column to existing tables if it doesn't exist
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN viewSettings TEXT');
      console.log('Added viewSettings column to existing projects table');
    } catch (error) {
      // Column already exists, ignore error
    }
    
    console.log('Database tables initialized');
  }

  // Get all projects
  getAllProjects() {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC');
    const rows = stmt.all();
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      thumbnail: row.thumbnail,
      path: row.path,
      deploymentUrl: row.deploymentUrl,
      storybookUrl: row.storybookUrl,
      viewportMode: row.viewportMode || 'desktop',
      viewSettings: row.viewSettings ? JSON.parse(row.viewSettings) : null,
      lastDeployedAt: row.lastDeployedAt ? new Date(row.lastDeployedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  // Add a new project
  addProject(project) {
    const now = Date.now();
    const newProject = {
      ...project,
      id: `project-${now}`,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, thumbnail, path, deploymentUrl, viewportMode, viewSettings, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newProject.id,
      newProject.name,
      newProject.description || null,
      newProject.thumbnail || null,
      newProject.path,
      newProject.deploymentUrl || null,
      newProject.viewportMode || 'desktop',
      newProject.viewSettings ? JSON.stringify(newProject.viewSettings) : null,
      now,
      now
    );

    console.log('Project added:', newProject.name);
    return newProject;
  }

  // Update a project
  updateProject(id, updates) {
    const now = Date.now();
    
    // Build dynamic update query based on provided fields
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    
    if (updates.thumbnail !== undefined) {
      fields.push('thumbnail = ?');
      values.push(updates.thumbnail);
    }
    
    if (updates.path !== undefined) {
      fields.push('path = ?');
      values.push(updates.path);
    }
    
    if (updates.deploymentUrl !== undefined) {
      fields.push('deploymentUrl = ?');
      values.push(updates.deploymentUrl);
    }
    
    if (updates.lastDeployedAt !== undefined) {
      fields.push('lastDeployedAt = ?');
      values.push(updates.lastDeployedAt ? updates.lastDeployedAt.getTime() : null);
    }
    
    if (updates.viewportMode !== undefined) {
      fields.push('viewportMode = ?');
      values.push(updates.viewportMode);
    }
    
    if (updates.viewSettings !== undefined) {
      fields.push('viewSettings = ?');
      values.push(updates.viewSettings ? JSON.stringify(updates.viewSettings) : null);
    }
    
    // Always update updatedAt
    fields.push('updatedAt = ?');
    values.push(now);
    
    // Add id for WHERE clause
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE projects 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    console.log('Project updated:', id, result.changes > 0);
    
    return result.changes > 0;
  }

  // Rename project with filesystem folder rename
  async renameProject(id, newName) {
    const project = this.getProject(id);
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }

    console.log('Renaming project:', project.name, '→', newName);

    // Generate new filesystem-safe folder name
    const safeName = newName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    const baseDir = path.join(os.homedir(), 'faux-projects');
    const newPath = path.join(baseDir, safeName);
    const oldPath = project.path;

    try {
      // Check if new path already exists (filesystem conflict)
      if (oldPath !== newPath) {
        const pathExists = await fs.access(newPath).then(() => true).catch(() => false);
        if (pathExists) {
          throw new Error(`Folder "${safeName}" already exists. Please choose a different name.`);
        }

        // Rename the actual folder on filesystem
        if (oldPath && await fs.access(oldPath).then(() => true).catch(() => false)) {
          console.log('Renaming folder:', oldPath, '→', newPath);
          await fs.rename(oldPath, newPath);
          console.log('Folder renamed successfully');
        } else {
          console.warn('Original folder not found, skipping filesystem rename');
        }
      }

      // Update database with new name and path
      const updateData = { name: newName };
      if (oldPath !== newPath) {
        updateData.path = newPath;
      }

      const result = this.updateProject(id, updateData);
      
      if (result) {
        console.log('Project renamed successfully in database');
        return {
          success: true,
          oldName: project.name,
          newName,
          oldPath,
          newPath: oldPath !== newPath ? newPath : oldPath
        };
      } else {
        throw new Error('Failed to update project in database');
      }

    } catch (error) {
      console.error('Failed to rename project:', error);
      
      // Rollback filesystem changes if database update failed
      if (oldPath && newPath && oldPath !== newPath) {
        try {
          const newPathExists = await fs.access(newPath).then(() => true).catch(() => false);
          if (newPathExists) {
            console.log('Rolling back filesystem rename...');
            await fs.rename(newPath, oldPath);
            console.log('Filesystem rollback completed');
          }
        } catch (rollbackError) {
          console.error('Failed to rollback filesystem changes:', rollbackError);
        }
      }
      
      throw error;
    }
  }

  // Update project thumbnail only
  updateProjectThumbnail(id, thumbnailData) {
    const now = Date.now();
    
    const stmt = this.db.prepare(`
      UPDATE projects 
      SET thumbnail = ?, updatedAt = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(thumbnailData, now, id);
    // console.log('Project thumbnail updated:', id, result.changes > 0);
    
    return result.changes > 0;
  }

  // Clear all thumbnails (useful for regeneration with new settings)
  clearAllThumbnails() {
    const stmt = this.db.prepare(`
      UPDATE projects 
      SET thumbnail = NULL, updatedAt = ?
    `);
    
    const result = stmt.run(Date.now());
    console.log('All thumbnails cleared:', result.changes, 'projects updated');
    
    return result.changes;
  }

  // Duplicate a project with smart name resolution
  duplicateProject(sourceId, customName = null) {
    // First get the source project
    const sourceProject = this.getProject(sourceId);
    if (!sourceProject) {
      throw new Error(`Source project not found: ${sourceId}`);
    }

    console.log('Duplicating project:', sourceProject.name);
    
    // Generate unique name using smart resolution
    const duplicateName = customName || this.generateUniqueName(sourceProject.name);
    
    // Generate unique path
    const duplicatePath = this.generateUniquePath(duplicateName);
    
    // Create new project data
    const now = Date.now();
    const duplicateProject = {
      id: `project-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: duplicateName,
      description: sourceProject.description ? `Copy of ${sourceProject.description}` : '',
      thumbnail: null, // Will be regenerated later
      path: duplicatePath,
      deploymentUrl: null, // New project has no deployment
      createdAt: now,
      updatedAt: now
    };

    // Insert into database
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, thumbnail, path, deploymentUrl, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        duplicateProject.id,
        duplicateProject.name,
        duplicateProject.description,
        duplicateProject.thumbnail,
        duplicateProject.path,
        duplicateProject.deploymentUrl,
        duplicateProject.createdAt,
        duplicateProject.updatedAt
      );

      console.log('Project duplicated in database:', duplicateProject.name);
      return {
        success: true,
        sourceProject,
        duplicateProject
      };
    } catch (error) {
      console.error('Failed to duplicate project in database:', error);
      throw error;
    }
  }

  // Generate unique project name with smart conflict resolution
  generateUniqueName(baseName) {
    const allProjects = this.getAllProjects();
    const existingNames = new Set(allProjects.map(p => p.name.toLowerCase()));
    
    // Try "Copy of X" first
    let candidateName = `Copy of ${baseName}`;
    if (!existingNames.has(candidateName.toLowerCase())) {
      return candidateName;
    }
    
    // Try "X 2", "X 3", etc.
    let counter = 2;
    do {
      candidateName = `${baseName} ${counter}`;
      counter++;
    } while (existingNames.has(candidateName.toLowerCase()) && counter < 1000);
    
    if (counter >= 1000) {
      // Fallback to timestamp-based name
      candidateName = `${baseName} ${Date.now()}`;
    }
    
    console.log('Generated unique name:', candidateName);
    return candidateName;
  }

  // Generate unique project path
  generateUniquePath(projectName) {
    
    // Convert name to filesystem-safe format
    const safeName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    const baseDir = path.join(os.homedir(), 'faux-projects');
    const projectPath = path.join(baseDir, safeName);
    
    console.log('Generated project path:', projectPath);
    return projectPath;
  }

  // Delete a project
  async deleteProject(id) {
    // First get the project to find its path
    const project = this.getProject(id);
    if (!project) {
      console.log('Project not found:', id);
      return false;
    }

    try {
      // Delete project files from filesystem if path exists
      if (project.path) {
        const projectExists = await fs.access(project.path).then(() => true).catch(() => false);
        if (projectExists) {
          console.log('Removing project directory:', project.path);
          
          // Try multiple approaches for better compatibility
          try {
            // First try using fs.rm (Node.js v14.14.0+)
            if (typeof fs.rm === 'function') {
              await fs.rm(project.path, { recursive: true, force: true });
              console.log('Project directory removed successfully using fs.rm');
            } else {
              throw new Error('fs.rm not available, trying alternative method');
            }
          } catch (fsError) {
            console.log('fs.rm failed, trying shell command:', fsError.message);
            try {
              // Use shell command for maximum compatibility and reliability
              await execAsync(`rm -rf "${project.path}"`);
              console.log('Project directory removed successfully using shell command');
            } catch (shellError) {
              console.error('Shell command also failed:', shellError.message);
              throw shellError;
            }
          }
        } else {
          console.log('Project directory does not exist:', project.path);
        }
      }
    } catch (error) {
      console.error('Error removing project directory:', error);
      // Continue with database deletion even if file removal fails
    }

    // Delete from database
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(id);
    
    console.log('Project deleted from database:', id, result.changes > 0);
    return result.changes > 0;
  }

  // Get a single project by ID
  getProject(id) {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id);
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      thumbnail: row.thumbnail,
      path: row.path,
      deploymentUrl: row.deploymentUrl,
      viewportMode: row.viewportMode || 'desktop',
      viewSettings: row.viewSettings ? JSON.parse(row.viewSettings) : null,
      lastDeployedAt: row.lastDeployedAt ? new Date(row.lastDeployedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }

  // Close database connection
  close() {
    this.db.close();
  }
}

// Singleton instance
let dbInstance = null;

export const getDatabase = () => {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
};