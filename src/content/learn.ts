export type Explainer = {
  slug: string;
  title: string;
  question: string;
  group: string;
  /** The model page where the idea is used, trained for real. */
  model: { slug: string; label: string };
  idea: string[];
  /** Length of the animation, seconds. */
  seconds: number;
};

// Ordered as a path: each idea is needed by the next.
export const explainers: Explainer[] = [
  {
    slug: "backprop",
    title: "Backpropagation",
    question: "How does a wrong guess turn into better weights?",
    group: "Training",
    model: { slug: "mlp-numpy", label: "the MLP written in NumPy" },
    seconds: 14,
    idea: [
      "A network is a chain of simple steps: multiply by weights, add, squash. The forward pass runs the chain and produces a guess; the loss measures how far the guess is from the answer.",
      "The chain rule runs the same chain backwards. Starting from the loss, each step passes back how much its output mattered, so every weight receives a gradient: the direction and size of its share of the blame.",
      "Training is then one line repeated millions of times: move each weight a little against its gradient. Too small a step and learning crawls; too large and the loss jumps around instead of falling.",
    ],
  },
  {
    slug: "convolution",
    title: "Convolution",
    question: "Why does one small filter beat a weight for every pixel?",
    group: "Vision",
    model: { slug: "cnn-mnist", label: "the small CNN" },
    seconds: 14,
    idea: [
      "A fully connected layer gives every pixel its own weight, so a pattern learnt in one corner means nothing in another. A convolution learns one small filter, nine weights, and slides it over every position.",
      "At each stop the filter multiplies the nine pixels under it and adds them up. Where the image looks like the filter the sum is large; the grid of sums is a feature map showing where that pattern occurs.",
      "Stack layers and filters combine: edges into strokes, strokes into digits. The small CNN reads MNIST with 7,578 weights, fourteen times fewer than the MLP, and makes fewer mistakes.",
    ],
  },
  {
    slug: "residual",
    title: "Skip connections",
    question: "Why does a deeper network train worse, and what does a shortcut fix?",
    group: "Vision",
    model: { slug: "resnet-cifar10", label: "the ResNet experiment" },
    seconds: 8,
    idea: [
      "Adding layers should never hurt: the extra ones could just pass their input through. In practice a plain 56-layer network trains worse than a 20-layer one, even on its own training data. The problem is optimisation, not overfitting.",
      "A residual block adds its input back to its output, so each block only has to learn a correction, and the signal has a direct path through the whole stack in both directions.",
      "The measurements on this site show it: in plain-56 the training signal differs many-fold between layers, with shortcuts it stays within a few-fold, and the 56-layer ResNet ends up the most accurate of the four runs.",
    ],
  },
  {
    slug: "attention",
    title: "Attention",
    question: "How does a transformer decide which earlier words matter?",
    group: "Sequence",
    model: { slug: "mini-gpt", label: "Mini-GPT" },
    seconds: 9,
    idea: [
      "Each position turns its current meaning into three vectors: a query (what am I looking for), a key (what do I offer) and a value (what I pass on).",
      "A word's query is compared with every earlier key by a dot product. Softmax turns those scores into weights that add up to one, and the word's new representation is the weighted mix of the values.",
      "Nothing about position is built in: the model learns which relations matter, a pronoun to its noun, a closing bracket to its opening one. Several heads do this in parallel, each free to look for something different.",
    ],
  },
  {
    slug: "latent",
    title: "Latent space",
    question: "What does a model need so that every point between two digits makes sense?",
    group: "Generative",
    model: { slug: "vae-mnist", label: "the VAE" },
    seconds: 11,
    idea: [
      "An autoencoder squeezes an image through a narrow middle, here just two numbers, and learns to rebuild it. The two numbers become coordinates on a map of digits.",
      "A plain autoencoder leaves gaps: points between the training codes decode to nonsense. A variational autoencoder encodes each image as a small cloud, not a point, and is penalised for spreading the clouds out, which fills the map in.",
      "The result is a continuous space: move a point a little and the digit changes a little, which is what lets the decoder generate digits it has never seen.",
    ],
  },
  {
    slug: "overfitting",
    title: "Overfitting",
    question: "Why can a model be right on its training data and wrong on new data?",
    group: "Training",
    model: { slug: "vit-cifar10", label: "ViT-Tiny, which shows it plainly" },
    seconds: 9,
    idea: [
      "Training data has a pattern and noise. A flexible enough model can fit both, and the noise is exactly what will not repeat in new data.",
      "So training error alone always looks better with more capacity. The honest measure is error on data the model never saw, which falls, bottoms out and rises again as the model starts memorising.",
      "The cures follow: more data, a less flexible model, regularisation, augmentation, or stopping early. The ViT on this site reaches 98.6% on its training images and 82.7% on the test set, a gap a convolution's built-in assumptions largely avoid.",
    ],
  },
];

export const explainerBySlug = (slug: string) => explainers.find((e) => e.slug === slug);
