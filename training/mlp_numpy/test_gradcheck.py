"""The hand-written backward pass must agree with finite differences."""

import numpy as np

from model import MLP


def test_backward_matches_finite_differences():
    rng = np.random.default_rng(1)
    net = MLP((12, 7, 5, 3), seed=2)
    net.W = [w.astype(np.float64) for w in net.W]
    net.b = [b.astype(np.float64) for b in net.b]
    x = rng.random((4, 12))
    y = rng.integers(0, 3, 4)

    logits, cache = net.forward(x)
    _, dlogits = MLP.loss(logits, y)
    grads = net.backward(dlogits, cache)

    eps = 1e-6
    for p, g in zip(net.params(), grads):
        for idx in np.ndindex(p.shape):
            old = p[idx]
            p[idx] = old + eps
            lp, _ = MLP.loss(net.forward(x)[0], y)
            p[idx] = old - eps
            lm, _ = MLP.loss(net.forward(x)[0], y)
            p[idx] = old
            numeric = (lp - lm) / (2 * eps)
            assert abs(numeric - g[idx]) < 1e-6, (idx, numeric, g[idx])
