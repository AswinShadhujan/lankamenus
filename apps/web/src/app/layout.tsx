import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MainLayout } from "@/components/layout/MainLayout";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteName = "Lankamenus";

function resolveMetadataBase(): URL {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return new URL(site);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
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
      <head>
        {/* Set theme before paint so CSS variables + Tailwind `dark:` match stored preference (avoids OS/light mismatch). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='lankamenus-theme';var s=localStorage.getItem(k);var dark=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',dark?'dark':'light');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${plusJakartaSans.variable} font-sans antialiased`}>
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
