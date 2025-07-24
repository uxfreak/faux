import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

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
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `;
    
    this.db.exec(createProjectsTable);
    
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
      INSERT INTO projects (id, name, description, thumbnail, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newProject.id,
      newProject.name,
      newProject.description || null,
      newProject.thumbnail || null,
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

  // Delete a project
  deleteProject(id) {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(id);
    
    console.log('Project deleted:', id, result.changes > 0);
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