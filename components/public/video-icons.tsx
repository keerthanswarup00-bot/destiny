type IconProps = {
  className?: string;
};

/** Shared player glyphs so every Destiny video surface uses identical iconography. */
export function PlayIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24">
      <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24">
      <path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" fill="currentColor" />
    </svg>
  );
}

export function SoundIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path d="M16 9.2a4 4 0 0 1 0 5.6M18.4 6.8a7.5 7.5 0 0 1 0 10.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export function MutedIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path d="m16 9 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export function FullscreenIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24">
      <path d="M4 9V4h5v2.2H6.2V9H4Zm11-5h5v5h-2.2V6.2H15V4ZM4 15h2.2v2.8H9V20H4v-5Zm13.8 0H20v5h-5v-2.2h2.8V15Z" fill="currentColor" />
    </svg>
  );
}
