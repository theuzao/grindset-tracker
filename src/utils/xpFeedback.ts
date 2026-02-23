export interface XPFeedbackEvent {
  xp: number;
  source: string;
  label: string;
}

export function dispatchXPFeedback(data: XPFeedbackEvent): void {
  window.dispatchEvent(new CustomEvent('xp-feedback', { detail: data }));
}

export function onXPFeedback(handler: (data: XPFeedbackEvent) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<XPFeedbackEvent>).detail);
  window.addEventListener('xp-feedback', listener);
  return () => window.removeEventListener('xp-feedback', listener);
}
