import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-700 bg-gray-800 p-4">
        <h1 className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-xl font-bold text-transparent">
          Clip Mind
        </h1>
      </header>

      <main className="flex flex-1 flex-col p-4">
        <Routes>
          <Route
            path="/"
            element={
              <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-gray-700 text-gray-400">
                Workspace Area...
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
