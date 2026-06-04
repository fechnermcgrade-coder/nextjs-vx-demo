"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AdminNav() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const sync = () => setLoggedIn(Boolean(window.localStorage.getItem("admin_token")));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("vitex-admin-auth", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("vitex-admin-auth", sync);
    };
  }, []);

  if (!loggedIn) return null;

  const items = [
    { href: "/admin", label: "工作台", active: pathname === "/admin" },
    { href: "/admin/ai", label: "AI 对话", active: pathname === "/admin/ai" }
  ];

  return (
    <header className="border-b border-[#d9e1df] bg-[#fbfaf6]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/admin" className="text-lg font-black text-slate-950">
          Vitex 社区
        </Link>
        <nav className="flex items-center gap-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                item.active
                  ? "border-[#2f5d62] bg-[#2f5d62] text-white"
                  : "border-[#d9e1df] bg-white text-slate-800 hover:border-[#2f5d62]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
