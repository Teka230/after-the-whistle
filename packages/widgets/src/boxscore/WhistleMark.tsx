/** Inline brand mark — whistle + sound wave, no external assets (CSP-safe). */

interface Props {
  size?: number;
  className?: string;
}

export function WhistleMark({ size = 28, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id="atw-whistle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="color-mix(in srgb, var(--accent) 18%, transparent)" />
      <path
        d="M10 14c0-2.2 1.6-4 3.6-4.3l1.1-2.2h3.4l.9 1.8c2 .3 3.5 2 3.5 4.2v.2c0 2.4-2 4.3-4.5 4.3h-4.5C11.6 18 10 16.2 10 14z"
        fill="url(#atw-whistle)"
      />
      <path
        d="M21 12c2 0 3.5.8 4.5 2 .8 1 1.2 2.2 1.2 3.2"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M23 9c2.8.5 5 2.2 6.2 4.5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="14.5" cy="14.5" r="1.2" fill="#0f1115" opacity="0.35" />
    </svg>
  );
}
