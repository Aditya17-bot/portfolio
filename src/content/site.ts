export const site = {
  name: "Aditya Sridhar",
  title: "Aditya Sridhar — ML engineer",
  description:
    "Machine learning work by Aditya Sridhar: models trained from scratch and runnable in your browser, research, patents and open-source contributions.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://adityasridhar.vercel.app",
  email: "adityasridhar718@gmail.com",
  github: "https://github.com/Aditya17-bot",
  linkedin: "https://www.linkedin.com/in/aditya-sridhar-45103226a/",
};

export type NavItem = { href: string; label: string; blurb: string };

export const nav: NavItem[] = [
  { href: "/models", label: "Models", blurb: "Every model trained from scratch and runnable in your browser." },
  { href: "/projects", label: "Projects", blurb: "Systems built end to end." },
  { href: "/research", label: "Research", blurb: "Papers and patents." },
  { href: "/open-source", label: "Open source", blurb: "Merged fixes in libraries people depend on." },
  { href: "/learn", label: "Learn", blurb: "Ideas taken apart step by step." },
  { href: "/about", label: "About", blurb: "Who I am and how to reach me." },
];
