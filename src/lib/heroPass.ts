// The forward pass the hero network is showing, shared with the flat layer readouts beside it.
// The 3D scene writes it every frame; readouts read it in their own animation frames, so
// nothing here triggers a React render.

export type HeroFocus = { layer: number; index: number };

export const heroPass = {
  /** The input currently travelling through the network. Null until the scene starts. */
  input: null as Float32Array | null,
  /** Bumped whenever `input` changes. */
  version: 0,
  /** How lit each layer is right now, 0..1, input first: the pulse's position in the pass. */
  lit: [0, 0, 0, 0],
  /** A neuron the visitor is pointing at in a readout; the scene marks it. */
  focus: null as HeroFocus | null,
  /** Asks the scene to draw a frame when it only renders on demand. */
  invalidate: () => {},
};
