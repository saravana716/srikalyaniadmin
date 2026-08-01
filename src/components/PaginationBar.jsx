import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../assets/styles/PaginationBar.css';

/**
 * Footer controls for client-side pagination (10 items per page by default).
 */
export default function PaginationBar({
    totalCount,
    pageStart,
    pageEnd,
    currentPage,
    totalPages,
    setCurrentPage,
}) {
    if (totalCount === 0) return null;

    return (
        <div className="pagination-bar">
            <span className="pagination-bar-info">
                Showing {pageStart}–{pageEnd} of {totalCount}
            </span>
            <div className="pagination-bar-nav">
                <button
                    type="button"
                    className="pagination-bar-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="pagination-bar-label">
                    Page {currentPage} / {totalPages}
                </span>
                <button
                    type="button"
                    className="pagination-bar-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
