import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
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
      INSERT INTO projects (id, name, description, thumbnail, path, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newProject.id,
      newProject.name,
      newProject.description || null,
      newProject.thumbnail || null,
      newProject.path,
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

  // Update project thumbnail only
  updateProjectThumbnail(id, thumbnailData) {
    const now = Date.now();
    
    const stmt = this.db.prepare(`
      UPDATE projects 
      SET thumbnail = ?, updatedAt = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(thumbnailData, now, id);
    console.log('Project thumbnail updated:', id, result.changes > 0);
    
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