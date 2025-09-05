import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run the build script
console.log('Building Vite app...');
exec('vite build', async (error, stdout, stderr) => {
  if (error) {
    console.error(`Build error: ${error.message}`);
    return;
  }
  
  console.log(stdout);
  if (stderr) console.error(stderr);
  
  console.log('Build completed. Ensuring all service files are available...');
  
  // Create services directory in dist
  const servicesDir = path.join(__dirname, 'dist', 'services');
  try {
    await fs.mkdir(servicesDir, { recursive: true });
  } catch (err) {
    console.log('Services directory already exists or could not be created');
  }
  
  // Copy service files
  try {
    const sourceDir = path.join(__dirname, 'src', 'services');
    const files = await fs.readdir(sourceDir);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        await fs.copyFile(
          path.join(sourceDir, file),
          path.join(servicesDir, file)
        );
        console.log(`Copied ${file} to dist/services/`);
      }
    }
    
    console.log('Service files copied successfully');
  } catch (err) {
    console.error('Error copying service files:', err);
  }
});