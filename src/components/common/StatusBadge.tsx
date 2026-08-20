import { getStatusMeta } from "../../utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Renders a team member's presence status (available/busy/in_meeting/offline).
 * Extracted from TeamDashboard/TeamNowWidget, which previously reimplemented
 * the same switch/case + markup byte-for-byte.
 */
export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const meta = getStatusMeta(status);
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.classes} ${className}`.trim()}>
      {meta.label}
    </span>
  );
}
