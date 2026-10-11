// The forward pass the hero network is showing, shared with the flat layer readouts beside it.
// The 3D scene writes it every frame; readouts read it in their own animation frames, so
// nothing here triggers a React render.

/** A neuron: layer 0-3 as in ARCH, or LIBRARY_LAYER for the libraries beyond the output. */
export type HeroFocus = { layer: number; index: number };

export const LIBRARY_LAYER = 4;

export const heroPass = {
  /** The input currently travelling through the network. Null until the scene starts. */
  input: null as Float32Array | null,
  /** Bumped whenever `input` changes. */
  version: 0,
  /** How lit each layer is right now, 0..1, input first: the pulse's position in the pass. */
  lit: [0, 0, 0, 0],
  /** A neuron the visitor is pointing at in a readout; the scene marks it. */
  focus: null as HeroFocus | null,
  /** Labels drawn over the network, by exhibit id; the scene positions them every frame. */
  labels: new Map<string, HTMLElement>(),
  /** The neuron each label is pinned to, set by the scene. */
  anchors: new Map<string, HeroFocus>(),
  /** Screen boxes of the copy cards, refreshed on scroll and resize; labels keep clear of them. */
  cards: [] as DOMRect[],
  /** Asks the scene to draw a frame when it only renders on demand. */
  invalidate: () => {},
};
