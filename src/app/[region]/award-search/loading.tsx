export default function AwardSearchLoading() {
  return (
    <div className="pm-shell py-10 space-y-6 animate-pulse">
      <div className="h-8 w-72 rounded bg-[#dce9e2]" />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-[#dce9e2] bg-white p-6 space-y-3">
          <div className="h-10 rounded bg-[#edf5f1]" />
          <div className="h-10 rounded bg-[#edf5f1]" />
          <div className="h-10 rounded bg-[#edf5f1]" />
          <div className="h-10 rounded bg-[#edf5f1]" />
        </div>
        <div className="rounded-2xl border border-[#dce9e2] bg-white p-6 space-y-3">
          <div className="h-24 rounded bg-[#edf5f1]" />
          <div className="h-24 rounded bg-[#edf5f1]" />
          <div className="h-24 rounded bg-[#edf5f1]" />
        </div>
      </div>
    </div>
  )
}
