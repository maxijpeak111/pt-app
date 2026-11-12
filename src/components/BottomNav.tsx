"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/planner",
    label: "Planner",
    icon: (
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    ),
  },
  {
    href: "/sessions",
    label: "Sessions",
    icon: <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />,
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-panel/95 pb-safe backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                  active ? "text-white" : "text-neutral-500"
                }`}
              >
                {active && <span className="absolute inset-x-8 top-0 h-0.5 bg-brand" />}
                <svg
                  viewBox="0 0 24 24"
                  className={`size-6 ${active ? "text-brand" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
