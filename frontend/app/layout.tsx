import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/app-frame";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northstar ERP",
  description: "AI-powered enterprise resource planning system with executive dashboards and predictive intelligence."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-[family-name:var(--font-body)] antialiased">
        <AuthProvider>
          <AppFrame>{children}</AppFrame>
        </AuthProvider>
      </body>
    </html>
  );
}
