import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/terminal/", "/account/", "/app/", "/post-login/", "/subscribe/"],
      },
    ],
    sitemap: "https://price-vault.com/sitemap.xml",
  };
}
