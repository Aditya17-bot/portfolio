export type Paper = {
  title: string;
  authors: string;
  role: string;
  venue: string;
  venueShort: string;
  date: string;
  status: string;
  summary: string[];
  facts: { label: string; value: string }[];
  explore?: { label: string; href: string };
};

export type Patent = {
  number: string;
  title: string;
  office: string;
  status: string;
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
];

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
];

export const patentSearch = "https://iprsearch.ipindia.gov.in/PublicSearch/";
