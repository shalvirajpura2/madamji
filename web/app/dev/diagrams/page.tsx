import { notFound } from "next/navigation";
import { Diagram, diagramIds } from "@/components/room/diagrams";
import { TemplateArt, templateSamples } from "@/components/room/templates";

export default function DiagramsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {templateSamples.map((t, i) => (
        <div key={`t${i}`} className="chalkboard rounded-sm p-3">
          <p className="chalk relative z-10 text-sm opacity-70">
            template: {t.template} {JSON.stringify(t.params)}
          </p>
          <div className="relative z-10 h-44">
            <TemplateArt {...t} />
          </div>
        </div>
      ))}
      {diagramIds.map((id) => (
        <div key={id} className="chalkboard rounded-sm p-3">
          <p className="chalk relative z-10 text-sm opacity-70">{id}</p>
          <div className="relative z-10 h-44">
            <Diagram id={id} />
          </div>
        </div>
      ))}
    </main>
  );
}
