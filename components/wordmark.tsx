/**
 * Drop's mark.
 *
 * Drawn as SVG rather than shipped as an image: it must stay crisp at 22px,
 * and an <img> here would be one more asset that can 404 during exactly the
 * outage this application exists to demonstrate.
 *
 * The shape is a falling drop over a baseline — a release landing.
 */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="wordmark">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2.5c3.4 4 5.4 6.7 5.4 9.2a5.4 5.4 0 0 1-10.8 0c0-2.5 2-5.2 5.4-9.2Z"
          fill="currentColor"
        />
        <rect x="3" y="19.5" width="18" height="2" rx="1" fill="currentColor" opacity="0.35" />
      </svg>
      <span>Drop</span>
    </span>
  );
}
