import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Preview } from "@/components/room/preview";
import { chapterById, chapters } from "@/lib/content";

// a scripted walk through the study room ui, for development only

export function generateStaticParams() {
  return chapters.map((c) => ({ chapter: c.id }));
}

export default function PreviewPage({ params }: PageProps<"/dev/room/[chapter]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense>
        <PreviewRoom params={params} />
      </Suspense>
    </main>
  );
}

async function PreviewRoom({ params }: { params: Promise<{ chapter: string }> }) {
  const { chapter: id } = await params;
  const chapter = chapterById(id);
  if (!chapter || process.env.NODE_ENV === "production") notFound();
  return <Preview chapter={chapter} />;
}
