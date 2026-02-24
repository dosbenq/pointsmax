export default function CardRecommenderLoading() {
  return (
    <div className="pm-shell py-10 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-[#dce9e2]" />
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-[#dce9e2] bg-white p-6 space-y-3">
          <div className="h-10 rounded bg-[#edf5f1]" />
          <div className="h-10 rounded bg-[#edf5f1]" />
          <div className="h-10 rounded bg-[#edf5f1]" />
          <div className="h-10 rounded bg-[#e1eee7]" />
        </div>
        <div className="space-y-3">
          <div className="h-28 rounded-2xl border border-[#dce9e2] bg-white" />
          <div className="h-28 rounded-2xl border border-[#dce9e2] bg-white" />
          <div className="h-28 rounded-2xl border border-[#dce9e2] bg-white" />
          <div className="h-28 rounded-2xl border border-[#dce9e2] bg-white" />
        </div>
      </div>
    </div>
  )
}
