export default function StatsBand() {
  const stats = [
    { value: "6", label: "Disciplines taught" },
    { value: "1:1", label: "Personalised coaching" },
    { value: "100%", label: "Live online sessions" },
    { value: "All ages", label: "Kids to adults" },
  ];

  return (
    <section className="px-6 py-6 bg-white">
      <div className="mx-auto max-w-7xl rounded-[28px] border border-[var(--border)] bg-gradient-to-r from-white via-white to-[#f7f9fc] p-6 shadow-sm sm:p-8">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[var(--border)] bg-white p-5 text-center">
              <p className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">{stat.value}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
