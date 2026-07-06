import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import "@/styles/globals.css";
export const metadata: Metadata = { title: "AR Timecapsule", description: "空間に記憶を埋める ARタイムカプセルプラットフォーム" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ja"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
