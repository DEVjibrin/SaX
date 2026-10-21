interface WordmarkProps {
  className?: string;
}

export default function Wordmark({ className = '' }: WordmarkProps) {
  return (
    <span role="img" aria-label="SaX" className={`select-none font-semibold leading-none tracking-tighter text-white ${className}`}>
      Sa<span className="text-white/40">X</span>
    </span>
  );
}
