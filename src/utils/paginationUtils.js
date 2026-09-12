/**
 * Generate a smart pagination range array with ellipses for large page counts.
 * Example: for 24 pages at page 1 -> [1, 2, '...', 24]
 * Example: for 24 pages at page 12 -> [1, '...', 11, 12, 13, '...', 24]
 */
export function getPaginationRange(currentPage, totalPages) {
  const total = Number(totalPages) || 1;
  const current = Math.max(1, Math.min(Number(currentPage) || 1, total));

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [];
  pages.push(1);

  if (current > 3) {
    pages.push('...');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  if (current < total - 2) {
    pages.push('...');
  }

  if (!pages.includes(total)) {
    pages.push(total);
  }

  return pages;
}
