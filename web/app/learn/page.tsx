import { ChapterList } from "@/components/chapter-list";
import { chapters } from "@/lib/content";

export default function LearnPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:py-12">
      <ChapterList chapters={chapters} />
    </main>
  );
}
