export default function NorthstarMark() {
  return (
    <svg
      className="northstar-mark"
      viewBox="0 0 180 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse
        className="northstar-mark-orbit"
        cx="72"
        cy="54"
        rx="68"
        ry="22"
        transform="rotate(-18 72 54)"
      />

      <g className="northstar-mark-trail">
        <path
          d="M0 -2.2 L0.7 -0.7 L2.2 0 L0.7 0.7 L0 2.2 L-0.7 0.7 L-2.2 0 L-0.7 -0.7 Z"
          transform="translate(34 32)"
        />
        <path
          d="M0 -2.4 L0.8 -0.8 L2.4 0 L0.8 0.8 L0 2.4 L-0.8 0.8 L-2.4 0 L-0.8 -0.8 Z"
          transform="translate(46 27)"
        />
        <path
          d="M0 -2.7 L0.8 -0.8 L2.7 0 L0.8 0.8 L0 2.7 L-0.8 0.8 L-2.7 0 L-0.8 -0.8 Z"
          transform="translate(58 23)"
        />
        <path
          d="M0 -2.7 L0.8 -0.8 L2.7 0 L0.8 0.8 L0 2.7 L-0.8 0.8 L-2.7 0 L-0.8 -0.8 Z"
          transform="translate(70 20)"
        />
        <path
          d="M0 -3 L0.9 -0.9 L3 0 L0.9 0.9 L0 3 L-0.9 0.9 L-3 0 L-0.9 -0.9 Z"
          transform="translate(82 17)"
        />
      </g>

      <path
        className="northstar-mark-main-star"
        d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z"
        transform="translate(126 28)"
      />
    </svg>
  );
}
