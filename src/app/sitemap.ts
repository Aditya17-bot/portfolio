import type { MetadataRoute } from "next";
import { explainers } from "@/content/learn";
import { models } from "@/content/models";
import { site } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/models", "/projects", "/projects/blindassist", "/projects/gene-anomaly", "/projects/caterpillar", "/projects/voice-assistant", "/projects/amazon-ml-challenge", "/projects/fraud", "/research", "/research/solar-forecasting", "/research/patents/wearable-navigation", "/research/patents/sensor-fusion", "/open-source", "/learn", "/about"];
  const zoo = models.filter((m) => m.status === "live").map((m) => `/models/${m.slug}`);
  const learn = explainers.map((e) => `/learn/${e.slug}`);
  return [...pages, ...zoo, ...learn].map((path) => ({ url: `${site.url}${path}` }));
}
