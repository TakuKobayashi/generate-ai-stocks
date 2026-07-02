import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "GitHub KV Chat",
  description: "Chat with data from your GitHub README",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
