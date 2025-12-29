export default function PhotosLoading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="h-9 w-64 bg-gray-200 animate-pulse rounded mx-auto mb-2" />
          <div className="h-5 w-96 bg-gray-200 animate-pulse rounded mx-auto" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-40 bg-gray-200 animate-pulse rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}
