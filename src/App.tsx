import { Routes, Route } from 'react-router-dom'
import { useAppSelector } from './store/hooks'
import { useWorker } from './store/hooks/useWorker'

const WorkerDebug = () => {
  const { startTask, cancelWork } = useWorker()
  const { status, progress, error } = useAppSelector((state) => state.processing)

  const handleStart = () => {
    startTask('SIMULATE_WORK', { duration: 5000 }).catch(console.error)
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <h2 className="text-2xl font-semibold text-white">Worker Infrastructure Test</h2>

      <div className="flex gap-4">
        <button
          onClick={handleStart}
          disabled={status !== 'idle' && status !== 'complete'}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          Start 5s Background Task
        </button>

        <button
          onClick={cancelWork}
          className="rounded-lg bg-red-600 px-6 py-2 font-medium transition-colors hover:bg-red-500"
        >
          Cancel Work (Kill Worker)
        </button>
      </div>

      <div className="w-full max-w-md space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Status: {status}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {error && <p className="text-center text-sm text-red-400">Error: {error}</p>}
      </div>
    </div>
  )
}

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
                <WorkerDebug />
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
