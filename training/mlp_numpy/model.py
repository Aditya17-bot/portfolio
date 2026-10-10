"""A multilayer perceptron with hand-written backpropagation. NumPy only, no autograd."""

import numpy as np


class MLP:
    def __init__(self, sizes=(784, 128, 64, 10), seed=0):
        rng = np.random.default_rng(seed)
        self.sizes = sizes
        # He initialisation: keeps ReLU activations at a stable scale through depth.
        self.W = [rng.normal(0, np.sqrt(2 / n_in), (n_out, n_in)).astype(np.float32) for n_in, n_out in zip(sizes[:-1], sizes[1:])]
        self.b = [np.zeros(n_out, np.float32) for n_out in sizes[1:]]

    def params(self):
        return self.W + self.b

    def forward(self, x):
        """x: [B, 784] in 0..1. Returns logits and the cache backward needs."""
        acts = [x]
        pre = []
        h = x
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            z = h @ W.T + b
            pre.append(z)
            h = np.maximum(z, 0) if i < len(self.W) - 1 else z
            acts.append(h)
        return h, (acts, pre)

    @staticmethod
    def loss(logits, y):
        """Mean softmax cross-entropy, and its gradient with respect to the logits."""
        z = logits - logits.max(axis=1, keepdims=True)
        p = np.exp(z)
        p /= p.sum(axis=1, keepdims=True)
        n = len(y)
        loss = -np.log(p[np.arange(n), y] + 1e-12).mean()
        grad = p
        grad[np.arange(n), y] -= 1
        return loss, grad / n

    def backward(self, dlogits, cache):
        """Chain rule, layer by layer from the output back. Returns grads in params() order."""
        acts, pre = cache
        dW = [None] * len(self.W)
        db = [None] * len(self.b)
        d = dlogits
        for i in reversed(range(len(self.W))):
            dW[i] = d.T @ acts[i]
            db[i] = d.sum(axis=0)
            if i > 0:
                d = (d @ self.W[i]) * (pre[i - 1] > 0)
        return dW + db

    def predict(self, x):
        return self.forward(x)[0].argmax(axis=1)
