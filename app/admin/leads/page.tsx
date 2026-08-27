import type { Metadata } from "next";
import LeadsAdmin from "../../components/LeadsAdmin";

export const metadata: Metadata = {
  title: "Leads | UniEDD",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LeadsPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <LeadsAdmin />
    </main>
  );
}
