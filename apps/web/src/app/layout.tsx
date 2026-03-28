import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MainLayout } from "@/components/layout/MainLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const siteName = "Lankamenus";

export const metadata: Metadata = {
  title: {
    default: "Lankamenus – Restaurant menus in Sri Lanka",
    template: `%s | ${siteName}`,
  },
  description:
    "Discover restaurant menus across Sri Lanka. Search by dish, location, and more.",
  openGraph: {
    type: "website",
    siteName,
    title: "Lankamenus – Restaurant menus in Sri Lanka",
    description:
      "Discover restaurant menus across Sri Lanka. Search by dish, location, and more.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: siteName }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lankamenus – Restaurant menus in Sri Lanka",
    description:
      "Discover restaurant menus across Sri Lanka. Search by dish, location, and more.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
                <p className="text-[var(--text-secondary)]">Loading…</p>
              </div>
            }
          >
            <MainLayout>{children}</MainLayout>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
