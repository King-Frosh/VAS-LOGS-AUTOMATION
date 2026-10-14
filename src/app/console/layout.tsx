import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  CalendarRange,
  Building2,
  Cable,
  FileSpreadsheet,
  Send,
  History,
  Unlink,
  Settings,
  ScrollText,
  LogOut,
  Mail,
  Clock,
  KeyRound,
} from "lucide-react";
import { requireUser, ROLE_LABEL } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { ensureSeeded } from "@/lib/seed";
import { Wordmark } from "@/components/Brand";
import { Silk } from "@/components/console-ui";

const NAV: {
  group: string;
  items: { href: string; label: string; icon: typeof LayoutDashboard; roles?: string[] }[];
}[] = [
  {
    group: "OPERATIONS",
    items: [
      { href: "/console", label: "Dashboard", icon: LayoutDashboard },
      { href: "/console/uploads", label: "Upload Logs", icon: UploadCloud },
      { href: "/console/processing", label: "Date Range & Processing", icon: CalendarRange },
      { href: "/console/reports", label: "Generated Reports", icon: FileSpreadsheet },
    ],
  },
  {
    group: "REGISTERS",
    items: [
      { href: "/console/partners", label: "Partner Register", icon: Building2 },
      { href: "/console/services", label: "Service Mapping", icon: Cable },
      { href: "/console/unmatched", label: "Unmatched Records", icon: Unlink },
    ],
  },
  {
    group: "DISTRIBUTION",
    items: [
      { href: "/console/email", label: "Email Centre", icon: Send },
      { href: "/console/delivery", label: "Delivery History", icon: History },
    ],
  },
  {
    group: "CONFIGURATION",
    items: [
      { href: "/console/settings/smtp", label: "Email Settings", icon: KeyRound },
      { href: "/console/settings/templates", label: "Email Templates", icon: Mail },
      { href: "/console/settings/automation", label: "Automation Settings", icon: Clock },
      { href: "/console/audit", label: "Audit Logs", icon: ScrollText },
      { href: "/console/system", label: "System Settings", icon: Settings },
    ],
  },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  await ensureSeeded();
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-charcoal">
      {/* fixed instrument rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col border-r border-rule bg-charcoal-900 lg:flex">
        <div className="flex h-[68px] items-center border-b border-rule px-6">
          <Link href="/console">
            <Wordmark />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-6">
          {NAV.map((group) => (
            <div key={group.group} className="mb-7">
              <Silk className="px-3 pb-3 text-slate-warm-dark">{group.group}</Silk>
              <ul className="space-y-[2px]">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink href={item.href} label={item.label} Icon={item.icon} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-rule p-4">
          <div className="flex items-center gap-3 border border-rule bg-panel px-3.5 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber/40 bg-amber/10">
              <span className="num text-[11px] font-semibold text-amber">
                {user.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-cream">{user.name}</div>
              <Silk className="mt-1 truncate text-slate-warm-dark">
                {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL]}
              </Silk>
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost mt-3 w-full justify-center">
              <LogOut size={12} strokeWidth={2.2} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* mobile rail */}
      <div className="sticky top-0 z-40 border-b border-rule bg-charcoal-900/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-5 py-3.5">
          <Link href="/console">
            <Wordmark />
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost" aria-label="Sign out">
              <LogOut size={12} strokeWidth={2.2} />
            </button>
          </form>
        </div>
        <nav className="scroll-thin flex gap-1 overflow-x-auto border-t border-rule px-3 py-2">
          {NAV.flatMap((g) => g.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[2px] border border-rule px-3 py-2 text-[11px] font-medium text-slate-warm transition-colors hover:border-amber hover:text-cream"
            >
              <item.icon size={13} strokeWidth={1.7} className="text-slate-warm-dark" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="lg:pl-[268px]">
        <div className="border-b border-rule bg-charcoal-900/60 px-5 py-2.5 lg:px-9">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Silk className="text-amber-dark">BRICCS VAS REVENUE CONSOLE</Silk>
            <Silk className="text-slate-warm-dark">
              {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL]} · {user.email}
            </Silk>
            <Silk className="text-slate-warm-dark">TZ AFRICA/LAGOS</Silk>
          </div>
        </div>
        <div className="px-5 py-8 lg:px-9 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[2px] border-l-2 border-transparent px-3 py-2.5 text-[12.5px] font-medium text-slate-warm transition-colors hover:border-amber hover:bg-amber/8 hover:text-cream"
    >
      <Icon size={15} strokeWidth={1.7} className="shrink-0 text-slate-warm-dark group-hover:text-amber" />
      {label}
    </Link>
  );
}
