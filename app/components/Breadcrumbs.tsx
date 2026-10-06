import Link from "next/link";
import { FaChevronRight } from "react-icons/fa";
import JsonLd from "./JsonLd";
import { SITE_URL } from "../lib/site";

export interface Crumb {
  name: string;
  href: string;
}

// Visible breadcrumb trail plus matching BreadcrumbList structured data.
// The last crumb is the current page.
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail = [{ name: "Home", href: "/" }, ...items];

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
          {trail.map((crumb, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-[var(--foreground)] font-medium">
                    {crumb.name}
                  </span>
                ) : (
                  <Link href={crumb.href} className="hover:text-[var(--brand-blue)] transition-colors">
                    {crumb.name}
                  </Link>
                )}
                {!last && <FaChevronRight size={8} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((crumb, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: crumb.name,
            item: `${SITE_URL}${crumb.href === "/" ? "" : crumb.href}`,
          })),
        }}
      />
    </>
  );
}
