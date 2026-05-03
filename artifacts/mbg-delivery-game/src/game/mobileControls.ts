/**
 * mobileControls.ts
 * Plain mutable object shared between MobileControls.tsx (writer)
 * and Player.tsx (reader inside useFrame).
 *
 * Intentionally NOT reactive — Player reads it each frame directly,
 * no Zustand or React state needed. Zero render overhead.
 */
export const mobileInput = {
  forward: false,
  back:    false,
  left:    false,
  right:   false,
};
