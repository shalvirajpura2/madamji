import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StudyRoom } from "@/components/room/study-room";
import { chapterById, chapters, chaptersForGrade } from "@/lib/content";

export function generateStaticParams() {
  return chapters.map((c) => ({ chapter: c.id }));
}

export default function RoomPage({ params }: PageProps<"/room/[chapter]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="m-auto text-ink-soft">Opening the classroom…</p>}>
        <Room params={params} />
      </Suspense>
    </main>
  );
}

async function Room({ params }: { params: Promise<{ chapter: string }> }) {
  const { chapter: id } = await params;
  const chapter = chapterById(id);
  if (!chapter) notFound();
  const siblings = chaptersForGrade(chapter.grade);
  const next = siblings[siblings.findIndex((c) => c.id === chapter.id) + 1];
  return <StudyRoom chapter={chapter} nextChapter={next ? { id: next.id, title: next.title } : null} />;
}
