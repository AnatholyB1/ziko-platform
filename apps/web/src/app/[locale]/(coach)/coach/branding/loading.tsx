export default function BrandingLoading() {
  return (
    <div className="px-8 py-10 max-w-[1200px] mx-auto flex flex-col gap-8">
      <div className="h-8 w-48 bg-border rounded-lg animate-pulse" />
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left column — three skeleton section cards */}
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-8 border border-border shadow-sm">
              <div className="h-4 w-32 bg-border rounded animate-pulse mb-4" />
              <div className="h-4 w-full bg-border rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Right column — preview card */}
        <div className="bg-white rounded-2xl border border-border shadow-md h-48 animate-pulse" />
      </div>
    </div>
  );
}
