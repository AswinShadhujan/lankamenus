'use client';

type Props = {
  message: string | string[] | null | undefined;
};

/** Consistent inline error for login / register (and similar auth forms). */
export function AuthFormErrorBanner({ message }: Props) {
  if (message == null) return null;
  const items = Array.isArray(message) ? message : [message];
  const lines = items.map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-small leading-relaxed text-red-800 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
      role="alert"
    >
      {lines.length === 1 ? (
        <p>{lines[0]}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
