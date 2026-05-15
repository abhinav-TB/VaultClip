import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAppSelector } from './store/hooks'
import type { GenerationSettings } from './types/generation'
import LandingPage from './pages/LandingPage'
import { AppPage } from './pages/AppPage'
import { LandingLayout, AppLayout } from './pages/Layout'

function App() {
  const ragReady = useAppSelector((state) => state.rag.status === 'ready')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    experienceMode: 'normal',
    maxNewTokens: 128,
    retrievalMode: 'hybrid',
    embeddingModelId: 'onnx-community/all-MiniLM-L6-v2-ONNX',
    transcriptMaxNewTokens: 512,
    maxVideoSizeMb: 100,
    maxVideoDurationMinutes: 10,
    audioSampleRate: 16000,
    audioFormat: 'wav',
    transcriptChunkSeconds: 30,
    transcriptOverlapSeconds: 0.1,
    frameSamplingMode: 'count',
    frameIntervalSeconds: 5,
    targetFrameCount: 20,
    maxFrameSamples: 60,
    frameMaxWidth: 512,
    frameImageFormat: 'jpeg',
    frameImageQuality: 0.72,
  })

  return (
    <Routes>
      <Route path="/" element={<LandingLayout><LandingPage /></LandingLayout>} />
      <Route
        path="/app"
        element={
          <AppLayout
            settings={generationSettings}
            onSettingsChange={setGenerationSettings}
            settingsOpen={settingsOpen}
            onSettingsClose={() => setSettingsOpen(false)}
          />
        }
      >
        <Route index element={<AppPage ragReady={ragReady} settings={generationSettings} />} />
      </Route>
    </Routes>
  )
}

export default App
