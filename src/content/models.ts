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
    status: "planned",
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
  { slug: "dcgan", title: "DCGAN", family: "Generative", dataset: "MNIST", summary: "Two networks trained against each other.", status: "planned" },
  { slug: "lstm-load", title: "LSTM forecaster", family: "Recurrent", dataset: "Delhi load", summary: "Sequence model on the data from my forecasting paper.", status: "planned" },
  { slug: "mini-gpt", title: "Mini-GPT", family: "Transformer", dataset: "Text", summary: "A character-level transformer with attention you can inspect.", status: "planned" },
  { slug: "vit-tiny", title: "ViT-Tiny", family: "Vision transformer", dataset: "CIFAR-10", summary: "Attention instead of convolution, next to the ResNet.", status: "planned" },
];

export const modelBySlug = (slug: string) => models.find((m) => m.slug === slug);
