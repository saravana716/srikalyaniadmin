import { useState, useEffect, useMemo } from 'react';

export const DEFAULT_PAGE_SIZE = 10;

/**
 * Client-side pagination for arrays.
 * @param {unknown[]} items
 * @param {number} [pageSize]
 * @param {string} [resetKey] When this value changes, current page resets to 1 (e.g. `${tab}|${search}`).
 */
export function usePagination(items, pageSize = DEFAULT_PAGE_SIZE, resetKey = '') {
    const [currentPage, setCurrentPage] = useState(1);
    const list = Array.isArray(items) ? items : [];

    useEffect(() => {
        setCurrentPage(1);
    }, [resetKey]);

    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return list.slice(start, start + pageSize);
    }, [list, currentPage, pageSize]);

    const pageStart = list.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const pageEnd = Math.min(currentPage * pageSize, list.length);

    return {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems,
        pageStart,
        pageEnd,
        totalCount: list.length,
    };
}
