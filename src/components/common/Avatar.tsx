function getInitials(name?: string): string {
  if (!name) return "UL";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-20 h-20 text-2xl",
} as const;

interface AvatarProps {
  name?: string;
  url?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/** Profile photo when set, initials-on-teal circle otherwise — single source of truth for every avatar in the app. */
export default function Avatar({ name, url, size = "sm", className = "" }: AvatarProps) {
  const base = `${SIZE_CLASSES[size]} rounded-full shrink-0 overflow-hidden ${className}`;

  if (url) {
    return (
      <img
        src={url}
        alt={name ? `Foto de ${name}` : "Foto de perfil"}
        className={`${base} object-cover border border-teal-300 dark:border-teal-700/50 shadow-sm`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name ? `Iniciais de ${name}` : "Avatar"}
      className={`${base} bg-teal-100 dark:bg-teal-900/40 border border-teal-300 dark:border-teal-700/50 flex items-center justify-center text-teal-700 dark:text-teal-400 font-bold shadow-sm`}
    >
      {getInitials(name)}
    </div>
  );
}
