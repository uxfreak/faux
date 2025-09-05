import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { 
  fileExists, 
  directoryExists, 
  createDirectory, 
  readFile, 
  writeFile,
  curry,
  pipe
} from './serverUtils';

const execAsync = promisify(exec);

// === Types ===

export interface ScaffoldStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  message?: string;
}

export interface ScaffoldProgress {
  steps: ScaffoldStep[];
  currentStep?: string;
  progress: number;
  message?: string;
  error?: string;
}

export interface ScaffoldOptions {
  projectName: string;
  targetPath?: string;
  skipExisting?: boolean;
  onProgress?: (progress: ScaffoldProgress) => void;
}

export interface ScaffoldResult {
  success: boolean;
  projectPath: string;
  error?: string;
  steps: ScaffoldStep[];
}

// === Progress Management ===

const createInitialSteps = (): ScaffoldStep[] => [
  { id: 'create', label: 'Creating React project', status: 'pending' },
  { id: 'install', label: 'Installing dependencies', status: 'pending' },
  { id: 'tailwind', label: 'Setting up Tailwind CSS', status: 'pending' },
  { id: 'storybook', label: 'Installing Storybook', status: 'pending' },
  { id: 'customize', label: 'Customizing components', status: 'pending' },
  { id: 'finalize', label: 'Finalizing setup', status: 'pending' }
];

const updateStepStatus = curry((stepId: string, status: ScaffoldStep['status'], steps: ScaffoldStep[]) =>
  steps.map(step => 
    step.id === stepId ? { ...step, status } : step
  )
);

const calculateProgress = (steps: ScaffoldStep[]): number => {
  const completed = steps.filter(step => step.status === 'completed').length;
  return Math.round((completed / steps.length) * 100);
};

// === Validation ===

const validateProjectName = (name: string): { valid: boolean; error?: string } => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Project name cannot be empty' };
  }
  
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    return { valid: false, error: 'Project name can only contain letters, numbers, hyphens, and underscores' };
  }
  
  if (name.length > 50) {
    return { valid: false, error: 'Project name must be 50 characters or less' };
  }
  
  return { valid: true };
};

const getProjectsDirectory = (): string => {
  const homeDir = os.homedir();
  return path.join(homeDir, 'faux-projects');
};

// === Scaffold Steps ===

const createReactProject = curry((projectPath: string, projectName: string) => async (): Promise<void> => {
  if (await directoryExists(projectPath)) {
    console.log(`Project ${projectName} already exists, skipping creation`);
    return;
  }

  const parentDir = path.dirname(projectPath);
  await createDirectory(parentDir);
  
  await execAsync(`npm create vite@latest ${projectName} -- --template react-ts`, {
    cwd: parentDir,
    timeout: 60000
  });
});

const installDependencies = curry((projectPath: string) => async (): Promise<void> => {
  await execAsync('npm install', {
    cwd: projectPath,
    timeout: 120000
  });
});

const setupTailwind = curry((projectPath: string) => async (): Promise<void> => {
  // Install Tailwind
  await execAsync('npm install tailwindcss @tailwindcss/vite', {
    cwd: projectPath,
    timeout: 60000
  });
  
  // Update vite.config.ts
  const viteConfigPath = path.join(projectPath, 'vite.config.ts');
  const currentConfig = await readFile(viteConfigPath);
  
  const newConfig = currentConfig
    .replace(
      "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'",
      "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'"
    )
    .replace(
      'plugins: [react()]',
      'plugins: [react(), tailwindcss()]'
    );
  
  await writeFile(viteConfigPath, newConfig);
  
  // Update index.css
  const indexCssPath = path.join(projectPath, 'src', 'index.css');
  const currentCss = await readFile(indexCssPath);
  const newCss = `@import "tailwindcss";\n\n${currentCss}`;
  await writeFile(indexCssPath, newCss);
});

const setupStorybook = curry((projectPath: string) => (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    // Check if already installed
    if (await directoryExists(path.join(projectPath, '.storybook'))) {
      console.log('Storybook already configured');
      resolve();
      return;
    }
    
    const storybookProcess = spawn('npx', ['storybook@latest', 'init'], {
      cwd: projectPath,
      stdio: 'pipe'
    });
    
    let output = '';
    const timeout = setTimeout(() => {
      storybookProcess.kill();
      reject(new Error('Storybook setup timeout'));
    }, 180000); // 3 minutes
    
    storybookProcess.stdout?.on('data', (data) => {
      output += data.toString();
      if (output.includes('Storybook was successfully installed') || 
          output.includes('successfully installed')) {
        clearTimeout(timeout);
        storybookProcess.kill();
        resolve();
      }
    });
    
    storybookProcess.stderr?.on('data', (data) => {
      console.log('Storybook output:', data.toString());
    });
    
    storybookProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0 || output.includes('successfully installed')) {
        resolve();
      } else {
        reject(new Error(`Storybook setup failed with code ${code}`));
      }
    });
    
    // Auto-answer prompts
    setTimeout(() => {
      if (!storybookProcess.killed) {
        storybookProcess.stdin?.write('\n');
      }
    }, 2000);
  });
});

const customizeComponents = curry((projectPath: string) => async (): Promise<void> => {
  const appPath = path.join(projectPath, 'src', 'App.tsx');
  
  const tailwindApp = `import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center gap-8 mb-8">
          <a href="https://vite.dev" target="_blank" className="hover:scale-110 transition-transform">
            <img src={viteLogo} className="w-16 h-16" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank" className="hover:scale-110 transition-transform">
            <img src={reactLogo} className="w-16 h-16 animate-spin" alt="React logo" />
          </a>
        </div>
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-8">
          Vite + React + Tailwind
        </h1>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
          <button 
            onClick={() => setCount((count) => count + 1)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg mb-4"
          >
            count is {count}
          </button>
          <p className="text-gray-600 mb-4">
            Edit <code className="bg-gray-100 px-2 py-1 rounded text-sm">src/App.tsx</code> and save to test HMR
          </p>
          <p className="text-sm text-gray-500">
            Click on the Vite and React logos to learn more
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
`;
  
  await writeFile(appPath, tailwindApp);
  
  // Add a sample story if Storybook is installed
  const storiesDir = path.join(projectPath, 'src', 'stories');
  if (await directoryExists(storiesDir)) {
    const buttonStoryPath = path.join(storiesDir, 'Button.stories.ts');
    if (await fileExists(buttonStoryPath)) {
      // Storybook already has stories configured
      return;
    }
  }
});

const finalizeSetup = curry((projectPath: string) => async (): Promise<void> => {
  // Create .gitignore if it doesn't exist
  const gitignorePath = path.join(projectPath, '.gitignore');
  if (!(await fileExists(gitignorePath))) {
    const gitignoreContent = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Storybook build outputs
storybook-static
build-storybook.log
`;
    await writeFile(gitignorePath, gitignoreContent);
  }
  
  // Initialize git if not already initialized
  try {
    await execAsync('git rev-parse --git-dir', { cwd: projectPath });
    console.log('Git already initialized');
  } catch {
    await execAsync('git init', { cwd: projectPath });
    await execAsync('git add .', { cwd: projectPath });
    await execAsync('git commit -m "Initial commit with Vite + React + Tailwind + Storybook"', { 
      cwd: projectPath 
    });
  }
});

// === Main Scaffold Function ===

export const scaffoldProject = async (options: ScaffoldOptions): Promise<ScaffoldResult> => {
  const { projectName, targetPath, skipExisting = false, onProgress } = options;
  
  // Validation
  const validation = validateProjectName(projectName);
  if (!validation.valid) {
    return {
      success: false,
      projectPath: '',
      error: validation.error,
      steps: []
    };
  }
  
  // Setup paths
  const baseDir = targetPath || getProjectsDirectory();
  const projectPath = path.join(baseDir, projectName);
  
  // Check if project exists
  if (await directoryExists(projectPath) && !skipExisting) {
    return {
      success: false,
      projectPath,
      error: 'Project already exists',
      steps: []
    };
  }
  
  let steps = createInitialSteps();
  
  const reportProgress = (currentStep?: string, message?: string) => {
    const progress = calculateProgress(steps);
    onProgress?.({
      steps,
      currentStep,
      progress,
      message
    });
  };
  
  try {
    // Step 1: Create React project
    steps = updateStepStatus('create', 'active', steps);
    reportProgress('create', 'Creating Vite + React project...');
    
    await createReactProject(projectPath, projectName)();
    
    steps = updateStepStatus('create', 'completed', steps);
    
    // Step 2: Install dependencies
    steps = updateStepStatus('install', 'active', steps);
    reportProgress('install', 'Installing npm dependencies...');
    
    await installDependencies(projectPath)();
    
    steps = updateStepStatus('install', 'completed', steps);
    
    // Step 3: Setup Tailwind
    steps = updateStepStatus('tailwind', 'active', steps);
    reportProgress('tailwind', 'Configuring Tailwind CSS...');
    
    await setupTailwind(projectPath)();
    
    steps = updateStepStatus('tailwind', 'completed', steps);
    
    // Step 4: Setup Storybook
    steps = updateStepStatus('storybook', 'active', steps);
    reportProgress('storybook', 'Installing and configuring Storybook...');
    
    await setupStorybook(projectPath)();
    
    steps = updateStepStatus('storybook', 'completed', steps);
    
    // Step 5: Customize components
    steps = updateStepStatus('customize', 'active', steps);
    reportProgress('customize', 'Adding custom components and styles...');
    
    await customizeComponents(projectPath)();
    
    steps = updateStepStatus('customize', 'completed', steps);
    
    // Step 6: Finalize
    steps = updateStepStatus('finalize', 'active', steps);
    reportProgress('finalize', 'Finalizing project setup...');
    
    await finalizeSetup(projectPath)();
    
    steps = updateStepStatus('finalize', 'completed', steps);
    
    reportProgress(undefined, 'Project setup completed successfully!');
    
    return {
      success: true,
      projectPath,
      steps
    };
    
  } catch (error) {
    const currentStep = steps.find(step => step.status === 'active');
    if (currentStep) {
      steps = updateStepStatus(currentStep.id, 'error', steps);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    onProgress?.({
      steps,
      progress: calculateProgress(steps),
      error: errorMessage
    });
    
    return {
      success: false,
      projectPath,
      error: errorMessage,
      steps
    };
  }
};

// === Utility Functions ===

export const getProjectInfo = async (projectPath: string) => {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (!(await fileExists(packageJsonPath))) {
    throw new Error('Not a valid Node.js project');
  }
  
  const packageJson = JSON.parse(await readFile(packageJsonPath));
  const hasStorybook = await directoryExists(path.join(projectPath, '.storybook'));
  const hasTailwind = packageJson.dependencies?.tailwindcss || packageJson.devDependencies?.tailwindcss;
  
  return {
    name: packageJson.name,
    version: packageJson.version,
    hasVite: !!packageJson.devDependencies?.vite,
    hasReact: !!packageJson.dependencies?.react,
    hasTailwind: !!hasTailwind,
    hasStorybook,
    scripts: packageJson.scripts || {}
  };
};

export const isValidFauxProject = async (projectPath: string): Promise<boolean> => {
  try {
    const info = await getProjectInfo(projectPath);
    return info.hasVite && info.hasReact && info.hasTailwind && info.hasStorybook;
  } catch {
    return false;
  }
};

export const cleanupFailedScaffold = async (projectPath: string): Promise<void> => {
  try {
    if (await directoryExists(projectPath)) {
      // Remove the directory if scaffold failed
      await execAsync(`rm -rf "${projectPath}"`);
    }
  } catch (error) {
    console.error('Failed to cleanup failed scaffold:', error);
  }
};