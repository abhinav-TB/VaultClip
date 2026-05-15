import { GemmaChat } from '../components/GemmaChat'
import { VideoUploadPanel } from '../components/VideoUploadPanel'
import { WorkflowStep } from '../components/WorkflowStep'
import { getWorkflowState } from '../lib/workflowUi'
import { useAppSelector } from '../store/hooks'
import type { GenerationSettings } from '../types/generation'

interface AppPageProps {
  ragReady: boolean
  settings: GenerationSettings
}

export function AppPage({ ragReady, settings }: AppPageProps) {
  const workflow = useAppSelector(getWorkflowState)

  return (
    <div className={`mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8 ${ragReady ? 'lg:min-h-0 lg:flex-1' : ''}`}>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(620px,1.22fr)] lg:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wide text-purple-400">Private media workspace</p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-100 sm:text-4xl">Analyze recordings with a clear, local workflow.</h2>
          <p className="mt-3 text-base leading-7 text-slate-500">
            {workflow.summary}
          </p>
        </div>
        <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
          {workflow.steps.map((step) => (
            <WorkflowStep key={step.label} state={step.state} detail={step.detail} label={step.label} />
          ))}
        </div>
      </section>
      {settings.experienceMode === 'normal' && !ragReady ? (
        <section className="mx-auto w-full max-w-5xl">
          <VideoUploadPanel settings={settings} />
        </section>
      ) : (
        <section className="grid w-full gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.28fr)_minmax(480px,0.92fr)] lg:items-start lg:overflow-hidden">
          <VideoUploadPanel settings={settings} />
          <GemmaChat settings={settings} />
        </section>
      )}
    </div>
  )
}