import { ProjectGrid } from './components/ProjectGrid'
import { ThemeProvider } from './contexts/ThemeContext'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <div className="w-full h-screen overflow-hidden">
        <ProjectGrid />
      </div>
    </ThemeProvider>
  )
}

export default App
