import type { MetadataRoute } from "next";
import { models } from "@/content/models";
import { site } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/models", "/projects", "/projects/fraud", "/research", "/open-source", "/learn", "/about"];
  const zoo = models.filter((m) => m.status === "live").map((m) => `/models/${m.slug}`);
  return [...pages, ...zoo].map((path) => ({ url: `${site.url}${path}` }));
}
