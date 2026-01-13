import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { PhotoPickerFlow } from "@/components/GooglePhotoPicker/PhotoPickerFlow";

export const metadata = {
  title: "Select Photos | Google Photos Integration",
  description: "Select photos from your Google Photos library",
};

export default async function PhotosPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Select Your Photos
          </h1>
          <p className="text-gray-600">
            Choose photos from your Google Photos library to display in your gallery
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <PhotoPickerFlow />
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Your photos are securely accessed through Google&apos;s official API.
            <br />
            We only see the photos you explicitly select.
          </p>
        </div>
      </div>
    </main>
  );
}
