/** Whether motion is currently allowed, honouring prefers-reduced-motion. */
export function motionAllowed(): boolean;
/** Forces motion on or off. `null` hands control back to the OS preference. */
export function setMotionAllowed(value: boolean | null): void;
export function pause(): void;
export function play(): void;
/** Subscribes to changes, including the OS preference changing mid-session. */
export function onMotionChange(fn: (allowed: boolean) => void): () => void;
/** Test seam: drops every subscriber and any override. */
export function resetMotion(): void;
