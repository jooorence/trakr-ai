export function CoachBubble() {
  return (
    <button
      type="button"
      aria-label="Open CoachGPT"
      className="fixed bottom-6 z-[10002] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-none bg-coach active:scale-[0.93]"
      style={{
        right: 'max(24px, calc((100vw - 1100px) / 2 + 24px))',
        animation: 'bubblePulse 2.5s ease-in-out infinite',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#050f0e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
