export type CameraStop = {
  pos: [number, number, number];
  /** The subject of this stop; the projection is offset so it lands clear of the copy. */
  look: [number, number, number];
};

// One stop per chapter. Layers sit at z = -6, -2, 2, 6 (input, hidden 1, hidden 2, output).
// Every camera looks roughly down +z, so grids and output labels read left to right.
export const CAMERA_STOPS: CameraStop[] = [
  { pos: [-8.4, 4.2, -10.2], look: [0, 0, 0] },
  { pos: [2.6, 1, -10.8], look: [0, 0, -6] },
  { pos: [5.5, 2, -7.6], look: [0, 0, -2] },
  { pos: [4.6, 1.8, -3.2], look: [0, 0, 2] },
  { pos: [3.6, 1.4, 1.2], look: [0, 0, 6] },
  { pos: [11, 7, -15], look: [0, 0, 0.5] },
];
