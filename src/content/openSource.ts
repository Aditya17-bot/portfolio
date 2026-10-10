export type PullRequest = {
  repo: string;
  repoBlurb: string;
  stars: string;
  number: number;
  title: string;
  state: "merged" | "open";
  date: string;
  bug: string;
  fix: string;
  test: string;
};

// Status as of the date below; refresh with `gh search prs --author Aditya17-bot`.
export const checked = "10 Oct 2026";

export const pullRequests: PullRequest[] = [
  {
    repo: "kornia/kornia",
    repoBlurb: "Differentiable computer vision for PyTorch",
    stars: "11k",
    number: 5563,
    title: "Keep focal_loss gradients finite for fractional gamma",
    state: "merged",
    date: "Oct 2026",
    bug: "With 0 < γ < 1, (1 − p)^γ has an infinite derivative at p = 1. As soon as a softmax probability saturated, the chain rule multiplied that infinity by zero and every logit of the pixel got a NaN gradient, including when the saturated class was the wrong one.",
    fix: "The double-where pattern: saturated entries take their value from a detached copy and their gradient from a safe base, so forward values are unchanged and the gradient becomes its true limit, 0. Clamp was avoided because its derivative at the bound differs across torch versions.",
    test: "Saturated rows on the correct and the wrong class, γ in {0, 0.25, 0.5, 0.75, 1, 2}, every reduction: loss and gradient must match the γ = 0 case. Plus a torch.compile vs eager check.",
  },
  {
    repo: "kornia/kornia",
    repoBlurb: "Differentiable computer vision for PyTorch",
    stars: "11k",
    number: 5564,
    title: "Weight the dice_loss micro intersection once",
    state: "merged",
    date: "Oct 2026",
    bug: "In micro averaging, the class weight was applied to both the scores and the one-hot target, so it entered the intersection squared. A perfect prediction with weight [2, 2, 2] scored −0.999998 instead of 0.",
    fix: "Pair the weighted scores with the unweighted target in the intersection; keep both weighted in the cardinality. Unweighted and macro losses are unchanged. Merged as a breaking change, since results move for weighted users.",
    test: "A uniform weight must equal no weight for both averages; weights [1, 2, 3] are checked against the weighted Dice computed directly. An existing test that had encoded the squared weight was corrected.",
  },
  {
    repo: "deepset-ai/haystack",
    repoBlurb: "LLM and RAG orchestration framework",
    stars: "26k",
    number: 13143,
    title: "Write EvaluationRunResult CSV reports as UTF-8",
    state: "merged",
    date: "Oct 2026",
    bug: "The CSV writer used the locale encoding. On Windows that is cp1252, so evaluation data in Japanese, Chinese or Greek stopped the report halfway with a charmap error, and accented text was written as mojibake.",
    fix: "Pass encoding=\"utf-8\" in the one writer that all three report types go through.",
    test: "Patches open to default to cp1252, so the bug reproduces on Linux CI, then writes a Spanish and Japanese report and reads it back as UTF-8.",
  },
  {
    repo: "huggingface/pytorch-image-models",
    repoBlurb: "timm, the PyTorch image model library",
    stars: "37k",
    number: 2839,
    title: "Read class map .txt and write hub README as UTF-8",
    state: "merged",
    date: "Oct 2026",
    bug: "On Windows a UTF-8 class map was decoded as cp1252, so non-ASCII class names (café) no longer matched their folders and those images were silently dropped from the dataset. The generated model card had the same problem on upload.",
    fix: "encoding=\"utf-8\" on both reads and writes. A two-line change; the reproduction was the work.",
    test: "Builds a two-folder dataset with a non-ASCII class under a cp1252 default. Without the fix it finds one class instead of two.",
  },
  {
    repo: "kornia/kornia",
    repoBlurb: "Differentiable computer vision for PyTorch",
    stars: "11k",
    number: 5669,
    title: "Filter integer images in float32",
    state: "open",
    date: "Oct 2026",
    bug: "Integer images cast kernels and sigma to their own dtype: a uint8 Gaussian blur returned all zeros, box sums wrapped mod 256, and bilateral differences wrapped (10 − 250 = 16).",
    fix: "Following the maintainers' convention, integer and bool inputs are promoted to float32 before any kernel is cast, across nine filtering functions.",
    test: "Seven tests that documented the defect became convention tests against the same call on image.float(); they now run on MPS too.",
  },
  {
    repo: "qdrant/fastembed",
    repoBlurb: "Lightweight embedding inference",
    stars: "3k",
    number: 786,
    title: "Read model text files as UTF-8 regardless of platform locale",
    state: "open",
    date: "Oct 2026",
    bug: "BM25 with Russian, Greek or Arabic stopwords failed to load on Windows; German and French loaded with every accented stopword garbled, so they were never filtered.",
    fix: "encoding=\"utf-8\" on all 15 text-mode open() calls in the package.",
    test: "Stopwords in five languages, vocab round trips and special tokens with ▁; the project's Windows CI guards it.",
  },
  {
    repo: "qdrant/fastembed",
    repoBlurb: "Lightweight embedding inference",
    stars: "3k",
    number: 785,
    title: "Unit tests for the image transform helpers",
    state: "open",
    date: "Oct 2026",
    bug: "Padding, cropping, resizing and tiling helpers used by Jina CLIP and Idefics3 were only exercised through model tests that download weights.",
    fix: "Pins their behaviour against the reference implementation in transformers.",
    test: "Coverage of functional.py 57% → 82%, operators.py 43% → 62%.",
  },
  {
    repo: "dottxt-ai/outlines",
    repoBlurb: "Structured generation for LLMs",
    stars: "16k",
    number: 2067,
    title: "Read grammar and JSON schema files as UTF-8",
    state: "open",
    date: "Oct 2026",
    bug: "A UTF-8 JSON schema with \"café\" was read as \"cafÃ©\" on Windows, so generation was constrained to the mojibake string, without any error.",
    fix: "encoding=\"utf-8\" in the three file readers.",
    test: "Writes UTF-8 files under a cp1252 default so the failure reproduces on Linux CI.",
  },
  {
    repo: "stanfordnlp/dspy",
    repoBlurb: "Programming language models",
    stars: "38k",
    number: 10589,
    title: "Build the subprocess PYTHONPATH with os.pathsep",
    state: "open",
    date: "Oct 2026",
    bug: "A test joined paths with \":\", which Windows reads as part of C:\\, so the child process could not find the test module.",
    fix: "os.pathsep.",
    test: "All 33 tests in the file pass on Windows 11.",
  },
];
