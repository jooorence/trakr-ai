import { AuthGate } from './components/AuthGate'

export default function App() {
  return (
    <AuthGate>
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="text-3xl font-extrabold tracking-[0.16em] text-fg">
          TRAKR
        </div>
        <div className="text-sm text-fg-dim">
          React migration · Phase 0 shell
        </div>
      </div>
    </AuthGate>
  )
}
