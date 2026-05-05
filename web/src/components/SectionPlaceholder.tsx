export function SectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="text-xl font-bold text-fg">{title}</div>
      <div className="text-xs text-fg-dim">
        Phase 1 placeholder · ports in upcoming phase
      </div>
    </div>
  )
}
