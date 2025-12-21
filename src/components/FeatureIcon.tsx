type Props = {
  type: "register" | "manage" | "search" | "trade";
  active?: boolean;
};

export default function FeatureIcon({ type, active }: Props) {
  const common = {
    className: active ? "iconActive" : "",
  };

  switch (type) {
    case "register":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 4h16v16H4z" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case "manage":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4-4" />
        </svg>
      );
    case "trade":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 2v20M5 7h14M5 17h14" />
        </svg>
      );
  }
}
