"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Navbar from "@/components/ui/Navbar";
import Sidebar from "@/components/ui/Sidebar";
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.push("/auth/login"); }, [user, loading, router]);
  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>;
  if (!user) return null;
  return <><Navbar /><div className="admin-layout"><Sidebar /><main className="admin-content">{children}</main></div></>;
}
