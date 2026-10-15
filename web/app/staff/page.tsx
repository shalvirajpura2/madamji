import { StaffAlerts } from "@/components/staff-alerts";

export const metadata = { title: "Ustaad · Safety alerts" };

export default function StaffPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <StaffAlerts />
    </main>
  );
}
