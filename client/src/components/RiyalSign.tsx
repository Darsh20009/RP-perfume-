import riyalIconUrl from "@assets/dummy_1777292322734.png";

interface RiyalSignProps {
  className?: string;
  size?: string | number;
}

export function RiyalSign({ className = "", size }: RiyalSignProps) {
  const style: React.CSSProperties = {
    height: size ? (typeof size === "number" ? `${size}px` : size) : "0.85em",
    width: "auto",
    display: "inline-block",
    verticalAlign: "-0.08em",
    marginInlineStart: "0.18em",
    marginInlineEnd: "0.05em",
    objectFit: "contain",
  };
  return (
    <img
      src={riyalIconUrl}
      alt="ر.س"
      aria-label="ريال سعودي"
      draggable={false}
      style={style}
      className={className}
      data-testid="icon-riyal"
    />
  );
}

export default RiyalSign;
