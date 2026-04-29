type Props = {
  value: unknown;
};

export function StatusBadge({ value }: Props) {
  const text = String(value ?? "");
  const active = text === "S" || text.toLowerCase() === "ativo";

  if (!text) {
    return <span className="text-dark-4">-</span>;
  }

  return (
    <span
      className={
        active
          ? "inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300"
          : "inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300"
      }
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}
