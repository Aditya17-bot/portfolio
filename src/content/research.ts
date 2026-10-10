export type Paper = {
  title: string;
  authors: string;
  role: string;
  venue: string;
  venueShort: string;
  date: string;
  status: "Presented" | "Under revision";
  summary: string[];
  facts?: { label: string; value: string }[];
  explore?: { label: string; href: string };
};

export type Patent = {
  /** Application number; filed applications get theirs listed once published. */
  number?: string;
  title: string;
  office: string;
  status: "Published" | "Filed";
  year: string;
};

export const papers: Paper[] = [
  {
    title:
      "Solar-Aware Machine Learning Framework for Short-Term Electricity Demand Forecasting in Delhi Using Weather and Calendar Variables",
    authors: "Aditya Sridhar",
    role: "First author",
    venue: "3rd International Conference on Signal Processing and Computer Vision (SIPCOV-2026), NIT Puducherry",
    venueShort: "SIPCOV-2026",
    date: "Oct 2026",
    status: "Presented",
    summary: [
      "Short-term forecasting of Delhi's electricity demand at 5-minute resolution, over 18 months of data, using only weather and calendar variables.",
      "Rooftop solar output is not measured, yet it shapes the daytime dip and evening ramp of the duck curve. A solar-availability proxy lets the models capture that shape without any PV data.",
      "Six models are benchmarked under leakage-free, time-aware validation. The best reached 0.77% MAPE and R² 0.9977, and the tabular learners beat the LSTM.",
    ],
    facts: [
      { label: "Data", value: "18 months, 5-minute load, Delhi" },
      { label: "Models compared", value: "6" },
      { label: "Best MAPE", value: "0.77%" },
      { label: "Best R²", value: "0.9977" },
    ],
    explore: { label: "Rerun on public data: try it", href: "/research/solar-forecasting" },
  },
  {
    title:
      "Cross-Layer Selective Abstention for Reliable Offline Assistive Perception with Tool-Mediated Voice Interaction for Visually Impaired Users",
    authors: "Aditya Sridhar and co-authors",
    role: "First author",
    venue: "ICMLDE, conference paper",
    venueShort: "ICMLDE",
    date: "2026",
    status: "Under revision",
    summary: [
      "The paper behind BlindAssist: for a blind user a confident wrong answer costs more than silence, so every layer of the system that can be wrong is able to decline to answer, each on its own terms rather than through one shared confidence score.",
    ],
    explore: { label: "The BlindAssist project", href: "/projects#blindassist" },
  },
];

// Filed applications are listed by subject only, in plain words, until they are published.
export const patents: Patent[] = [
  {
    number: "202641110070",
    title: "Wearable Navigation Apparatus with Inertially Adaptive Detection and Staged Announcement Scheduling",
    office: "Indian Patent Office",
    status: "Published",
    year: "2026",
  },
  {
    number: "202641115711",
    title:
      "Protected Adaptive Pairwise Sensor Fusion System for Sub-Threshold Compound Hazard Detection and Automated Mitigation",
    office: "Indian Patent Office",
    status: "Published",
    year: "2026",
  },
  ...[
    "Detecting coordinated malpractice in examination halls",
    "Detecting externally assisted malpractice at examination stations",
    "Reconstructing missing traffic counts in detector networks",
    "Recalibrating vehicle-length classification at roadside detectors",
    "Correcting the stage offset of river gauging stations",
    "Gas-hazard classification and mitigation in ventilated spaces",
    "Self-recalibrating water-content sensors for greenhouse irrigation",
  ].map((title): Patent => ({ title, office: "Indian Patent Office", status: "Filed", year: "2026" })),
];

export const patentSearch = "https://iprsearch.ipindia.gov.in/PublicSearch/";
