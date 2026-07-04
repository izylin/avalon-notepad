import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "阿瓦隆笔记本",
  description: "阿瓦隆现场笔记与任务记录工具"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
