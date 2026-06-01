export default function UserAvatar({ className = '' }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-slate-200 overflow-hidden border border-slate-300 text-slate-400 ${className}`.trim()}
      aria-hidden="true"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[70%] h-[70%]">
        <path d="M12 12.75a4.75 4.75 0 1 0-4.75-4.75A4.76 4.76 0 0 0 12 12.75Zm0 1.5c-4.42 0-8 2.91-8 6.5a.75.75 0 0 0 .75.75h14.5a.75.75 0 0 0 .75-.75c0-3.59-3.58-6.5-8-6.5Z" />
      </svg>
    </div>
  )
}