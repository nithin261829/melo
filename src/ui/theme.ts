export const colors = {
  bg: '#0A0A0F',
  surface: '#15151D',
  surface2: '#20202B',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F5F7',
  sub: '#9C9CAB',
  faint: '#5E5E6E',
  accent: '#FF3D6E',
  accent2: '#8B5CFF',
};

export const gradient = [colors.accent, colors.accent2] as const;

export function formatTime(seconds?: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
