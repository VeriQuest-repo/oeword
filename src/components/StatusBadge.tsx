import { type ServerStatus, serverStatusLabel } from "../lib/health";

const dotColor: Record<ServerStatus, string> = {
  checking: "bg-slate-400",
  ok: "bg-emerald-500",
  "no-database": "bg-amber-500",
  offline: "bg-rose-500",
};

export default function StatusBadge({ status }: { status: ServerStatus }) {
  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200"
    >
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dotColor[status]}`} />
      {serverStatusLabel[status]}
    </p>
  );
}
