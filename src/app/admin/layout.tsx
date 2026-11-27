import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "管理画面",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="h-dvh overflow-y-auto overscroll-y-contain">{children}</div>;
}
