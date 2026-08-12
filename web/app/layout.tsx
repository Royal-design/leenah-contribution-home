import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/components/providers"
import { cn } from "@/lib/utils"

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://leenah-contribution-home-web.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LCH – Contribution & Savings for Nigeria",
    template: "%s | LCH",
  },
  description:
    "LCH is a configurable contribution and savings platform for building better financial habits, together. Contribute in circles, grow your savings, and track every naira.",
  applicationName: "LCH",
  authors: [{ name: "LCH" }],
  creator: "LCH",
  publisher: "LCH",
  keywords: [
    "contribution platform",
    "savings app",
    "esusu",
    "ajo",
    "contribution and savings",
    "Nigeria savings",
    "group contribution",
    "financial habits",
    "LCH",
  ],
  category: "Finance",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: siteUrl,
    siteName: "LCH",
    title: "LCH – Contribution & Savings for Nigeria",
    description:
      "Contribute in circles, grow your savings, and track every naira — all in one place.",
    images: [
      {
        url: "/images/og-cover.png",
        width: 1200,
        height: 630,
        alt: "LCH – Contribution & Savings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LCH – Contribution & Savings for Nigeria",
    description:
      "Contribute in circles, grow your savings, and track every naira — all in one place.",
    images: ["/images/og-cover.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#16171a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}