export default function EarningCalculatorLoading() {
  return (
    <div className="pm-shell py-10 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-[#dce9e2]" />
      <div className="rounded-2xl border border-[#dce9e2] bg-white p-6 space-y-4">
        <div className="h-10 rounded bg-[#edf5f1]" />
        <div className="h-10 rounded bg-[#edf5f1]" />
        <div className="h-10 rounded bg-[#edf5f1]" />
      </div>
      <div className="rounded-2xl border border-[#dce9e2] bg-white p-6 space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-10 rounded bg-[#edf5f1]" />
        ))}
      </div>
    </div>
  )
}
