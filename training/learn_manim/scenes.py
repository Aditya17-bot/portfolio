"""Animations for the Learn explainers, rendered with Manim Community.

    .venv/Scripts/python -m manim -qm --format=mp4 training/learn_manim/scenes.py Backprop Convolution
    (then copy media/videos/scenes/720p30/*.mp4 to public/learn/)

Colours follow the site: near-black background, cyan for activations, amber for gradients and signals.
"""

import numpy as np
from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Arrow,
    Circle,
    Create,
    FadeIn,
    FadeOut,
    Line,
    ReplacementTransform,
    Scene,
    Square,
    Text,
    VGroup,
    config,
    rate_functions,
)

BG = "#05070d"
CYAN = "#5ce1e6"
AMBER = "#f5a524"
INK = "#e6eaf2"
MUTE = "#4a5468"
FONT = "Segoe UI"

config.background_color = BG


def label(s, size=26, color=INK):
    return Text(s, font=FONT, font_size=size, color=color)


class Backprop(Scene):
    """Forward pass lights up the network, the loss appears, then gradients run backwards and resize the weights."""

    def construct(self):
        sizes = [2, 3, 1]
        xs = [-4.6, -1.4, 1.8]
        layers = []
        for x, n in zip(xs, sizes):
            col = VGroup(*[Circle(radius=0.35, color=CYAN, stroke_width=3).set_fill(BG, 1).move_to([x, (i - (n - 1) / 2) * 1.6, 0]) for i in range(n)])
            layers.append(col)
        rng = np.random.default_rng(3)
        weights = []
        edges = VGroup()
        for a, b in zip(layers, layers[1:]):
            for na in a:
                for nb in b:
                    w = rng.uniform(0.3, 1.0)
                    e = Line(na.get_right(), nb.get_left(), color=MUTE, stroke_width=1 + 4 * w)
                    weights.append(w)
                    edges.add(e)
        title = label("A network learns by passing errors backwards", 30).to_edge(UP)
        self.play(FadeIn(title), Create(edges), *[FadeIn(l) for l in layers], run_time=1.5)

        inputs = VGroup(label("0.8", 24, CYAN).next_to(layers[0][0], LEFT), label("0.3", 24, CYAN).next_to(layers[0][1], LEFT))
        self.play(FadeIn(inputs))
        step = label("1. Forward: each neuron sums its weighted inputs", 24, INK).to_edge(DOWN)
        self.play(FadeIn(step))
        for layer in layers:
            self.play(*[n.animate.set_fill(CYAN, 0.55) for n in layer], run_time=0.5)
        out = label("prediction 0.62", 24, CYAN).next_to(layers[2][0], RIGHT)
        self.play(FadeIn(out))
        target = label("target 1.00", 24, INK).next_to(out, DOWN)
        loss = label("loss (1.00 - 0.62)² = 0.14", 24, AMBER).next_to(target, DOWN)
        self.play(FadeIn(target), FadeIn(loss))

        step2 = label("2. Backward: each weight gets its share of the blame", 24, INK).to_edge(DOWN)
        self.play(ReplacementTransform(step, step2))
        back = VGroup()
        for e in reversed(list(edges)):
            arrow = Arrow(e.get_end(), e.get_start(), buff=0.35, color=AMBER, stroke_width=3, max_tip_length_to_length_ratio=0.12)
            back.add(arrow)
        self.play(*[Create(a) for a in back[:3]], run_time=0.8)
        self.play(*[Create(a) for a in back[3:]], run_time=0.8)

        step3 = label("3. Update: move every weight a little against its gradient", 24, INK).to_edge(DOWN)
        self.play(ReplacementTransform(step2, step3), FadeOut(back))
        self.play(*[e.animate.set_stroke(width=1 + 4 * min(1, w * rng.uniform(0.7, 1.4)), color=CYAN if rng.random() > 0.5 else MUTE) for e, w in zip(edges, weights)], run_time=1.2)
        new = label("loss 0.14 → 0.09", 26, AMBER).move_to(loss)
        self.play(ReplacementTransform(loss, new))
        self.wait(1.5)


class Convolution(Scene):
    """A 3x3 filter slides over a small digit; each stop is one multiply-and-sum that fills the feature map."""

    def construct(self):
        digit = np.array(
            [
                [0, 0, 0, 0, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 0],
                [0, 0, 0, 0, 1, 0, 0],
                [0, 0, 0, 1, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
            ],
            dtype=float,
        )
        kernel = np.array([[-1, -1, -1], [0, 0, 0], [1, 1, 1]], dtype=float)  # responds to dark-above, bright-below edges
        s = 0.55
        grid = VGroup()
        for r in range(7):
            for c in range(7):
                sq = Square(side_length=s, stroke_color=MUTE, stroke_width=1).set_fill(INK, 0.9 * digit[r, c] + 0.04)
                sq.move_to([-6.0 + c * s, 1.6 - r * s, 0])
                grid.add(sq)
        title = label("Convolution: one small filter, slid over every position", 30).to_edge(UP)
        k_lbl = label("filter: finds\nhorizontal edges", 20, AMBER).move_to([0.45, -0.55, 0])
        kgrid = VGroup()
        for r in range(3):
            for c in range(3):
                v = kernel[r, c]
                sq = Square(side_length=0.45, stroke_color=AMBER, stroke_width=1.5).set_fill(AMBER if v > 0 else BG, 0.6 if v > 0 else 1)
                sq.move_to([-1.0 + c * 0.45, 0.9 - r * 0.45, 0])
                txt = label(f"{int(v):+d}" if v else "0", 18, INK).move_to(sq)
                kgrid.add(VGroup(sq, txt))
        kgrid.move_to([0.45, 0.55, 0])
        out_cells = VGroup()
        for r in range(5):
            for c in range(5):
                sq = Square(side_length=s, stroke_color=MUTE, stroke_width=1).set_fill(BG, 1)
                sq.move_to([3.3 + c * s, 1.05 - r * s, 0])
                out_cells.add(sq)
        o_lbl = label("feature map", 22, CYAN).next_to(out_cells, DOWN)
        self.play(FadeIn(title), FadeIn(grid), FadeIn(kgrid), FadeIn(k_lbl), FadeIn(out_cells), FadeIn(o_lbl), run_time=1.2)

        window = Square(side_length=3 * s, stroke_color=AMBER, stroke_width=4).move_to(grid[8])
        self.play(Create(window), run_time=0.4)
        resp = np.zeros((5, 5))
        for r in range(5):
            for c in range(5):
                resp[r, c] = float((digit[r : r + 3, c : c + 3] * kernel).sum())
        peak = max(1.0, np.abs(resp).max())
        spot = [0.45, -1.9, 0]
        readout = label("sum of 9 products", 22, INK).move_to(spot)
        for idx in range(25):
            r, c = divmod(idx, 5)
            centre = grid[(r + 1) * 7 + (c + 1)]
            v = resp[r, c]
            new_read = label(f"sum of 9 products = {v:+.0f}", 22, INK).move_to(spot)
            anims = [window.animate.move_to(centre), out_cells[idx].animate.set_fill(CYAN if v > 0 else AMBER, min(1, abs(v) / peak) * 0.9 + 0.05)]
            if idx < 6 or idx % 5 == 0:
                anims.append(ReplacementTransform(readout, new_read))
                readout = new_read
            self.play(*anims, run_time=0.32 if idx > 5 else 0.6, rate_func=rate_functions.smooth)
        note = label("Cyan: dark above, bright below.  Amber: the opposite edge.", 22, INK).to_edge(DOWN)
        self.play(FadeOut(window), ReplacementTransform(readout, note))
        self.wait(1.5)


# ---------------------------------------------------------------- data-driven scenes

import json  # noqa: E402
from pathlib import Path  # noqa: E402

from manim import ArcBetweenPoints, Dot, ImageMobject, Rectangle  # noqa: E402

SITE = Path(__file__).resolve().parents[2]
HUES = ["#5ce1e6", "#f5a524", "#ff5a4e", "#3ddc84", "#9b8cff", "#5b8def", "#e6eaf2", "#f472b6", "#a3e635", "#94a3b8"]


class Residual(Scene):
    """Per-layer gradient size in plain-56 and ResNet-56, measured during training (gradients.json)."""

    def construct(self):
        g = json.loads((SITE / "training/resnet_cifar10/gradients.json").read_text())
        title = label("How much training signal reaches each layer", 30).to_edge(UP)
        self.play(FadeIn(title))

        def bars(run, y0, color):
            v = np.array(g[run], dtype=float)
            v = v / np.median(v)
            n = len(v)
            w = 11.5 / n
            grp = VGroup()
            for i, x in enumerate(v):
                h = 0.12 + min(2.2, 0.55 * np.log1p(x) * 1.6)
                r = Rectangle(width=w * 0.8, height=h, stroke_width=0).set_fill(color, 0.9)
                r.move_to([-5.75 + i * w + w / 2, y0 + h / 2, 0])
                grp.add(r)
            return grp, v

        plain, pv = bars("plain-56", 0.4, MUTE)
        res, rv = bars("resnet-56", -2.6, CYAN)
        lp = label(f"plain-56: {pv.max() / pv.min():.0f}x from the weakest layer to the strongest", 22, INK).next_to(plain, UP, buff=0.15).align_to(plain, LEFT)
        lr = label(f"ResNet-56: {rv.max() / rv.min():.0f}x", 22, CYAN).next_to(res, UP, buff=0.15).align_to(res, LEFT)
        inp = label("input side", 18, MUTE).move_to([-5.2, -3.15, 0])
        outp = label("output side", 18, MUTE).move_to([5.2, -3.15, 0])
        self.play(*[Create(b) for b in plain], FadeIn(lp), run_time=2.2, lag_ratio=0.03)
        self.play(*[Create(b) for b in res], FadeIn(lr), FadeIn(inp), FadeIn(outp), run_time=2.2, lag_ratio=0.03)
        note = label("Skip connections give the signal a direct path, so every layer gets a similar share", 22, AMBER).to_edge(DOWN, buff=0.2)
        self.play(FadeIn(note))
        self.wait(2)


class Attention(Scene):
    """One word looks back over the sentence: scores, softmax, weighted mix."""

    def construct(self):
        words = ["The", "cat", "sat", "on", "the", "mat", "because", "it", "was", "tired"]
        weights = np.array([0.03, 0.46, 0.08, 0.02, 0.03, 0.17, 0.05, 0.16, 0.0, 0.0])
        title = label("Attention: each word decides which earlier words matter", 30).to_edge(UP)
        row = VGroup(*[label(w, 30, INK) for w in words]).arrange(RIGHT, buff=0.35).move_to([0, -0.2, 0])
        self.play(FadeIn(title), FadeIn(row))
        q = row[7]
        box = Rectangle(width=q.width + 0.3, height=q.height + 0.3, color=AMBER).move_to(q)
        self.play(Create(box), q.animate.set_color(AMBER))
        expl = label("The word 'it' asks a question (its query); every earlier word offers a key", 22, INK).to_edge(DOWN)
        self.play(FadeIn(expl))
        arcs = VGroup()
        for i in range(7):
            w = weights[i]
            a = ArcBetweenPoints(q.get_top() + np.array([0, 0.12, 0]), row[i].get_top() + np.array([0, 0.12, 0]), angle=1.0, color=CYAN, stroke_width=1.5 + 10 * w)
            a.set_fill(opacity=0)
            a.set_stroke(opacity=0.25 + 0.75 * w / weights.max())
            arcs.add(a)
        bars = VGroup()
        for i in range(8):
            h = 0.05 + 2.2 * weights[i]
            r = Rectangle(width=0.45, height=h, stroke_width=0).set_fill(CYAN if i != 7 else AMBER, 0.85)
            r.move_to([row[i].get_center()[0], -2.75 + h / 2, 0])
            bars.add(r)
        self.play(*[Create(a) for a in arcs], run_time=1.5)
        expl2 = label("Softmax turns the matches into weights that add up to 1", 22, INK).to_edge(DOWN)
        self.play(ReplacementTransform(expl, expl2), *[FadeIn(b) for b in bars])
        top = label("46% of its new meaning comes from 'cat'", 24, AMBER).move_to([3.4, -1.6, 0])
        self.play(row[1].animate.set_color(CYAN), FadeIn(top))
        self.wait(2)


class Latent(Scene):
    """The trained VAE's 2-D latent map, and digits decoded as a point moves across it."""

    def construct(self):
        import onnxruntime as ort

        lat = json.loads((SITE / "public/models/vae-mnist/latent.json").read_text())
        pts = np.array(lat["points"])
        title = label("A VAE squeezes every digit into two numbers", 30).to_edge(UP)

        def sx(z):
            return [-5.6 + (z[0] + 3) / 6 * 5.2, -2.9 + (z[1] + 3) / 6 * 5.2, 0]

        dots = VGroup(*[Dot(sx(p), radius=0.03, color=HUES[int(p[2])]).set_opacity(0.8) for p in pts[:1200]])
        self.play(FadeIn(title), FadeIn(dots), run_time=1.5)
        dec = ort.InferenceSession(str(SITE / "public/models/vae-mnist/decoder.onnx"), providers=["CPUExecutionProvider"])
        path = np.stack([np.linspace(-1.9, 1.6, 40), np.linspace(1.4, -1.8, 40)], 1).astype(np.float32)
        imgs = dec.run(None, {"z": path})[0][:, 0]
        cursor = Circle(radius=0.12, color=AMBER, stroke_width=4).move_to(sx(path[0]))

        def pic(a):
            rgb = (np.clip(a, 0, 1)[..., None] * np.array([230, 234, 242])).astype(np.uint8)
            m = ImageMobject(rgb)
            m.height = 3.2
            return m.move_to([3.6, 0.1, 0])

        img = pic(imgs[0])
        cap = label("decoded from the point", 22, AMBER).move_to([3.6, -2.0, 0])
        self.play(Create(cursor), FadeIn(img), FadeIn(cap))
        for k in range(1, 40):
            nxt = pic(imgs[k])
            self.remove(img)
            self.add(nxt)
            self.play(cursor.animate.move_to(sx(path[k])), run_time=0.14)
            img = nxt
        note = label("Neighbouring points decode to similar digits, so the space is continuous", 22, INK).to_edge(DOWN)
        self.play(FadeIn(note))
        self.wait(1.5)


class Overfitting(Scene):
    """Training loss keeps falling; validation loss turns upward once the model starts memorising."""

    def construct(self):
        title = label("Overfitting: when the model starts memorising", 30).to_edge(UP)
        ax = VGroup(Line([-5.5, -2.6, 0], [5.5, -2.6, 0], color=MUTE), Line([-5.5, -2.6, 0], [-5.5, 2.4, 0], color=MUTE))
        xl = label("training time", 20, MUTE).next_to(ax[0], DOWN, buff=0.15)
        yl = label("loss", 20, MUTE).next_to(ax[1], LEFT, buff=0.15)
        t = np.linspace(0, 1, 80)
        train = 2.2 * np.exp(-4.2 * t) + 0.1
        val = 2.2 * np.exp(-4.2 * t) + 0.45 + 1.4 * np.maximum(0, t - 0.38) ** 1.6

        def P(tt, v):
            return [-5.5 + tt * 11, -2.6 + v * 1.9, 0]

        tr = VGroup(*[Line(P(t[i], train[i]), P(t[i + 1], train[i + 1]), color=CYAN, stroke_width=4) for i in range(79)])
        va = VGroup(*[Line(P(t[i], val[i]), P(t[i + 1], val[i + 1]), color=AMBER, stroke_width=4) for i in range(79)])
        self.play(FadeIn(title), Create(ax), FadeIn(xl), FadeIn(yl))
        lt = label("training data", 22, CYAN).move_to([4.2, -1.9, 0])
        lv = label("data it has never seen", 22, AMBER).move_to([3.6, 1.2, 0])
        self.play(Create(tr), Create(va), run_time=3, rate_func=rate_functions.linear)
        self.play(FadeIn(lt), FadeIn(lv))
        best = int(np.argmin(val))
        mark = Line(P(t[best], 0), P(t[best], 2.4), color=INK, stroke_width=2).set_opacity(0.6)
        ml = label("stop here", 22, INK).next_to(mark, UP, buff=0.1)
        self.play(Create(mark), FadeIn(ml))
        note = label("Past this point it learns the training set's quirks, not the pattern", 22, INK).to_edge(DOWN, buff=0.15)
        self.play(FadeIn(note))
        self.wait(2)
