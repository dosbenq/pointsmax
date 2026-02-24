export default function CardsLoading() {
  return (
    <div className="pm-shell py-10 space-y-6 animate-pulse">
      <div className="h-8 w-72 rounded bg-[#dce9e2]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-32 rounded-2xl border border-[#dce9e2] bg-white" />
        ))}
      </div>
    </div>
  )
}
