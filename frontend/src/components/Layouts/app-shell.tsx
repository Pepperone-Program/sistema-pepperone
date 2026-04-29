"use client";

import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <main className="min-h-screen bg-gray-2 dark:bg-[#020d1a]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="w-full bg-gray-2 dark:bg-[#020d1a]">
        <Header />

        <main className="isolate mx-auto w-full max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
