import type { MetadataRoute } from "next";
import { models } from "@/content/models";
import { site } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/models", "/projects", "/projects/blindassist", "/projects/gene-anomaly", "/projects/caterpillar", "/projects/voice-assistant", "/projects/amazon-ml-challenge", "/projects/fraud", "/research", "/research/solar-forecasting", "/research/patents/wearable-navigation", "/research/patents/sensor-fusion", "/open-source", "/learn", "/about"];
  const zoo = models.filter((m) => m.status === "live").map((m) => `/models/${m.slug}`);
  return [...pages, ...zoo].map((path) => ({ url: `${site.url}${path}` }));
}
