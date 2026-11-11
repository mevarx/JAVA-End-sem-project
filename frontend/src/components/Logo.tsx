export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="HAES logo"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
