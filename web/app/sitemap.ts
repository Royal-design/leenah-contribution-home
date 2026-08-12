import type { MetadataRoute } from "next"

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://leenah-contribution-home-web.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const publicRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    {
      url: `${siteUrl}/forgot-password`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]

  const dashboardRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/dashboard`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/contributions`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/savings`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/transactions`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/notifications`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ]

  return [...publicRoutes, ...dashboardRoutes]
}