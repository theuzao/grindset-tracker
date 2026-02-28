export type XPFeedbackType = 'gain' | 'loss' | 'levelup' | 'leveldown';

export interface XPFeedbackEvent {
  xp: number;
  source: string;
  label: string;
  type?: XPFeedbackType;
  /** Para level-up/down: nível anterior e novo */
  levelChange?: { from: number; to: number; title: string };
}

export function dispatchXPFeedback(data: XPFeedbackEvent): void {
  window.dispatchEvent(new CustomEvent('xp-feedback', { detail: data }));
}

export function onXPFeedback(handler: (data: XPFeedbackEvent) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<XPFeedbackEvent>).detail);
  window.addEventListener('xp-feedback', listener);
  return () => window.removeEventListener('xp-feedback', listener);
}
