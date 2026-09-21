// AdminPagination.jsx — small reusable Prev/Next pager for Admin tables.
// Renders nothing when everything fits on one page.
export default function AdminPagination({ page, setPage, total, pageSize = 10 }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-4 pb-1">
      <button
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page === 1}
        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 dark:border-zinc-700 disabled:opacity-40 text-gray-600 dark:text-gray-300"
      >
        Previous
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
      <button
        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 dark:border-zinc-700 disabled:opacity-40 text-gray-600 dark:text-gray-300"
      >
        Next
      </button>
    </div>
  );
}
