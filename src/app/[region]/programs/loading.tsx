export default function ProgramsLoading() {
  return (
    <div className="pm-shell py-10 space-y-6 animate-pulse">
      <div className="h-8 w-72 rounded bg-[#dce9e2]" />
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="h-20 rounded-2xl border border-[#dce9e2] bg-white" />
        ))}
      </div>
    </div>
  )
}
