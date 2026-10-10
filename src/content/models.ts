export type ModelStatus = "live" | "planned";

export type ModelEntry = {
  slug: string;
  title: string;
  family: string;
  dataset: string;
  summary: string;
  status: ModelStatus;
  date?: string;
};

// The zoo, as a ladder: each model introduces the problem the next one exists to solve.
export const models: ModelEntry[] = [
  {
    slug: "mlp-numpy",
    title: "MLP in NumPy",
    family: "Multilayer perceptron",
    dataset: "MNIST",
    summary: "784 → 128 → 64 → 10 with backpropagation written by hand and checked against finite differences. The network in the hero.",
    status: "live",
    date: "Oct 2026",
  },
  {
    slug: "cnn-mnist",
    title: "Small CNN",
    family: "Convolutional network",
    dataset: "MNIST",
    summary: "Five convolutions and no dense layer: 14x fewer parameters than the MLP and fewer mistakes. Shows its feature maps live.",
    status: "live",
    date: "Oct 2026",
  },
  {
    slug: "cnn-cifar10",
    title: "CNN on CIFAR-10",
    family: "Convolutional network",
    dataset: "CIFAR-10",
    summary: "Colour photos in ten classes. Pick a test image or upload your own, and see which part of it decided the answer.",
    status: "live",
    date: "Oct 2026",
  },
  {
    slug: "resnet-cifar10",
    title: "ResNet on CIFAR-10",
    family: "Residual network",
    dataset: "CIFAR-10",
    summary: "Plain and residual nets at 20 and 56 layers, same recipe: why skip connections make depth trainable, measured.",
    status: "live",
    date: "Oct 2026",
  },
  {
    slug: "vae-mnist",
    title: "Variational autoencoder",
    family: "Generative",
    dataset: "MNIST",
    summary: "Every digit squeezed into two numbers. Drag through that space and watch one digit turn into another.",
    status: "live",
    date: "Oct 2026",
  },
  {
    slug: "dcgan-mnist",
    title: "DCGAN",
    family: "Generative",
    dataset: "MNIST",
    summary: "A generator and a discriminator trained against each other. New digits on every click, judged by the CNN above.",
    status: "live",
    date: "Oct 2026",
  },
  { slug: "lstm-load", title: "LSTM forecaster", family: "Recurrent", dataset: "Delhi load", summary: "A sequence model for electricity demand, the problem from my forecasting paper.", status: "planned" },
  {
    slug: "mini-gpt",
    title: "Mini-GPT",
    family: "Transformer",
    dataset: "Shakespeare",
    summary: "A character-level transformer that writes in your browser. Click any character to see what each attention head looked at.",
    status: "live",
    date: "Oct 2026",
  },
  {
    slug: "vit-cifar10",
    title: "ViT-Tiny",
    family: "Vision transformer",
    dataset: "CIFAR-10",
    summary: "Attention instead of convolution, trained from scratch on the same data as the ResNets, and where it falls short.",
    status: "live",
    date: "Oct 2026",
  },
];

export const modelBySlug = (slug: string) => models.find((m) => m.slug === slug);
