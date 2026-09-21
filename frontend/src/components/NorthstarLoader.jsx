import { useEffect, useState } from "react";

const statuses = [
  "Thinking",
  "Analyzing your question",
  "Finding relevant policies",
  "Reviewing the context",
  "Preparing an answer",
];

export default function NorthstarLoader() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((current) => (current + 1) % statuses.length);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="northstar-loader"
      role="status"
      aria-live="polite"
      aria-label="Northstar is processing your question"
    >
      <div className="northstar-loader-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <span className="northstar-loader-text">{statuses[statusIndex]}</span>
    </div>
  );
}
