import type { Metadata } from "next";
import { AdminNav } from "./admin-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vitex 管理后台",
  description: "微信小程序业务后台与管理控制台"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AdminNav />
        <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
