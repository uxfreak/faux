import React, { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className="minimal-canvas">
      {/* Gradient orb */}
      <div className="orb" aria-hidden="true"></div>
      
      {/* Center content */}
      <div className="canvas-content">
        <div className="time-display">
          {time.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          })}
        </div>
        <div className="date-display">
          {time.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Minimal hint */}
      <div className="bottom-hint">
        <span>Start building</span>
      </div>
    </main>
  )
}

export default App