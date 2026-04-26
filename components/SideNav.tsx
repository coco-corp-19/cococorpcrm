"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string; group: string };

const sideNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", group: "Overview" },
  { href: "/leads", label: "Leads", icon: "🎯", group: "CRM" },
  { href: "/customers", label: "Customers", icon: "👥", group: "CRM" },
  { href: "/quotes", label: "Quotes", icon: "📝", group: "CRM" },
  { href: "/products", label: "Products", icon: "📦", group: "Catalog" },
  { href: "/invoices", label: "Invoices", icon: "🧾", group: "Finance" },
  { href: "/billing", label: "Billing", icon: "📅", group: "Finance" },
  { href: "/costs", label: "Costs", icon: "📤", group: "Finance" },
  { href: "/marketing", label: "Marketing", icon: "📣", group: "Marketing" },
  { href: "/accounting", label: "Accounting", icon: "📋", group: "Analytics" },
  { href: "/performance", label: "Snapshots", icon: "📈", group: "Analytics" },
  { href: "/settings", label: "Settings", icon: "⚙️", group: "Config" },
];

const groups = ["Overview", "CRM", "Catalog", "Finance", "Marketing", "Analytics", "Config"];

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-3 space-y-4">
      {groups.map(group => {
        const items = sideNav.filter(n => n.group === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1 px-2" style={{ color: "var(--muted2)" }}>{group}</p>
            {items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors mb-0.5"
                  style={{
                    background: isActive ? "var(--accent)" : "transparent",
                    color: isActive ? "#fff" : "var(--muted)",
                  }}>
                  <span className="text-sm w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

const botNav = [
  { href: "/dashboard", label: "Home", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "🎯" },
  { href: "/billing", label: "Billing", icon: "📅" },
  { href: "/customers", label: "Clients", icon: "👥" },
];

export function BotNav() {
  const pathname = usePathname();
  return (
    <>
      {botNav.map(item => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors"
            style={{ color: isActive ? "var(--accent)" : "var(--muted2)" }}>
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
      <Link href="/costs"
        className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--muted2)" }}>
        <span className="text-lg">☰</span>
        More
      </Link>
    </>
  );
}
