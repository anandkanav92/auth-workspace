import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { TTSWrapper } from "@/components/audio/TTSWrapper";
import { AuthProvider } from "@/lib/auth-provider";
import { MigrationProvider } from "@/components/MigrationProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nederlands A2 - Dutch Learning App",
  description: "Interactive Dutch A2 learning app based on Nederlands in gang",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex bg-slate-50 text-slate-900">
        <AuthProvider>
          <MigrationProvider>
            {/* Desktop sidebar — hidden on mobile */}
            <div className="hidden lg:block">
              <Sidebar />
            </div>

            <main className="flex-1 min-h-screen overflow-y-auto pb-20 lg:pb-0">
              <TTSWrapper>
                <div className="max-w-4xl mx-auto px-4 py-4 lg:px-8 lg:py-8">
                  {children}
                </div>
              </TTSWrapper>
            </main>

            {/* Mobile bottom nav — hidden on desktop */}
            <MobileNav />
          </MigrationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
