import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import AppUserDetailModal from '../components/AppUserDetailModal';
import EditAppUserModal from '../components/EditAppUserModal';
import { subscribeAppUsers, updateAppUser, deleteAppUser } from '../services/appUsersService';
import { formatToIST } from '../utils/dateUtils';
import { getPaginationRange } from '../utils/paginationUtils';
import {
  FiSearch,
  FiFilter,
  FiX,
  FiDownload,
  FiSettings,
  FiBell,
  FiMenu,
} from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';
const PAGE_SIZE = 10;

function formatDisplayDate(ts) {
  if (!ts) return '—';
  if (typeof ts?.toDate === 'function') return formatToIST(ts.toDate().toISOString());
  return formatToIST(ts);
}

const AppUsers = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProfile, setFilterProfile] = useState('all'); // all | completed | pending
  const [filterGender, setFilterGender] = useState('all'); // all | male | female

  // Modals & Actions
  const [viewUser, setViewUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Action Menu
  const [openActionId, setOpenActionId] = useState(null);
  const [actionAnchorEl, setActionAnchorEl] = useState(null);
  const [openCardActionId, setOpenCardActionId] = useState(null);
  const [cardActionAnchorEl, setCardActionAnchorEl] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsub = subscribeAppUsers((data) => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (filterProfile === 'completed' && !u.profileCompleted) return false;
      if (filterProfile === 'pending' && u.profileCompleted) return false;
      if (filterGender !== 'all' && String(u.gender || '').toLowerCase() !== filterGender) return false;

      if (q) {
        const text = [
          u.name,
          u.cusId,
          u.mobile,
          u.email,
          u.city,
          u.state,
          u.pincode,
          u.address,
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [users, searchQuery, filterProfile, filterGender]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterProfile, filterGender]);

  // Pagination slices
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  // Handlers
  const handleSaveEdit = async (id, data) => {
    setEditError(null);
    setSavingEdit(true);
    try {
      await updateAppUser(id, data);
      setEditUser(null);
    } catch (err) {
      console.error('Update app user failed', err);
      setEditError(err?.message || 'Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete app user "${user.name || user.cusId}"?`)) return;
    setDeleting(true);
    try {
      await deleteAppUser(user);
      setOpenActionId(null);
      setOpenCardActionId(null);
      setActionAnchorEl(null);
      setCardActionAnchorEl(null);
    } catch (err) {
      console.error('Delete app user failed', err);
      alert(err?.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    if (filteredUsers.length === 0) {
      alert('No user data to export');
      return;
    }
    const headers = ['S.NO', 'Cus ID', 'Joined Date', 'Name', 'Mobile', 'Email', 'City', 'State', 'Status'];
    const rows = filteredUsers.map((u, i) => [
      i + 1,
      `"${u.cusId || ''}"`,
      `"${formatDisplayDate(u.createdAt || u.joinedDate)}"`,
      `"${u.name || ''}"`,
      `"${u.mobile || ''}"`,
      `"${u.email || ''}"`,
      `"${u.city || ''}"`,
      `"${u.state || ''}"`,
      u.profileCompleted ? 'Completed' : 'Pending',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `app_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.container} className="dashboard-container customers-page app-users-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      {/* View Modal */}
      {viewUser && (
        <AppUserDetailModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          onEdit={(u) => setEditUser(u)}
        />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditAppUserModal
          user={editUser}
          onClose={() => { if (!savingEdit) { setEditUser(null); setEditError(null); } }}
          onSave={handleSaveEdit}
          saving={savingEdit}
          error={editError}
        />
      )}

      <main style={styles.main} className="dashboard-main customers-main app-users-main">
        {/* Header */}
        <header style={styles.header} className="dashboard-header customers-header">
          <div style={styles.headerRow}>
            <button
              style={styles.hamburger}
              className="mobile-hamburger"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>App Users</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <div style={styles.headerIcons}>
              <button style={styles.iconButton} aria-label="Settings"><FiSettings /></button>
              <button style={styles.iconButton} aria-label="Notifications">
                <span style={styles.notifBadge}>1</span>
                <FiBell />
              </button>
              <img src="https://ui-avatars.com/api/?name=Admin&background=random" alt="Profile" style={styles.avatar} />
            </div>
          </div>
        </header>

        {/* Toolbar - styled exactly like Customers.jsx */}
        <div style={styles.toolbar} className="customers-toolbar">
          <div style={styles.filters}>
            {/* Filter by Profile */}
            <div style={styles.selectWrap}>
              <FiFilter style={styles.selectIcon} />
              <select
                style={styles.select}
                className="filter-select"
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
                aria-label="Filter by Profile"
              >
                <option value="all">All Profiles</option>
                <option value="completed">Completed Only</option>
                <option value="pending">Pending Only</option>
              </select>
            </div>

            {/* Filter by Gender */}
            <div style={styles.selectWrap}>
              <FiFilter style={styles.selectIcon} />
              <select
                style={styles.select}
                className="filter-select"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                aria-label="Filter by Gender"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {/* Search Input Toggle */}
            {searchOpen && (
              <div style={styles.searchFilterWrap}>
                <FiSearch style={styles.selectIcon} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, mobile, ID…"
                  style={styles.searchFilterInput}
                  autoFocus
                  aria-label="Search app users"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    style={styles.searchClearBtn}
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <FiX size={16} />
                  </button>
                ) : null}
              </div>
            )}

            <button
              type="button"
              style={{
                ...styles.filterIconBtn,
                ...(searchOpen ? styles.filterIconBtnActive : {}),
              }}
              aria-label="Toggle search"
              title="Search"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <FiSearch />
            </button>
          </div>

          <Button type="button" onClick={exportCSV}>
            <FiDownload size={16} style={{ marginRight: 4 }} /> Export CSV
          </Button>
        </div>

        {!loading && (
          <p style={styles.resultMeta}>
            Showing {pagedUsers.length} of {filteredUsers.length} app user
            {filteredUsers.length === 1 ? '' : 's'}
            {filteredUsers.length !== users.length ? ` (filtered from ${users.length})` : ''}
          </p>
        )}

        {/* Action Menu (Portal) */}
        <ActionMenu
          isOpen={!!openActionId}
          onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
          anchorEl={actionAnchorEl}
          busy={deleting}
          onView={() => {
            const row = users.find((u) => u.id === openActionId);
            if (row) setViewUser(row);
          }}
          onEdit={() => {
            const row = users.find((u) => u.id === openActionId);
            if (row) setEditUser(row);
          }}
          onDelete={() => {
            const row = users.find((u) => u.id === openActionId);
            if (row) return handleDelete(row);
          }}
        />
        <ActionMenu
          isOpen={!!openCardActionId}
          onClose={() => { setOpenCardActionId(null); setCardActionAnchorEl(null); }}
          anchorEl={cardActionAnchorEl}
          busy={deleting}
          onView={() => {
            const row = users.find((u) => u.id === openCardActionId);
            if (row) setViewUser(row);
          }}
          onEdit={() => {
            const row = users.find((u) => u.id === openCardActionId);
            if (row) setEditUser(row);
          }}
          onDelete={() => {
            const row = users.find((u) => u.id === openCardActionId);
            if (row) return handleDelete(row);
          }}
        />

        {/* Table View (Desktop) - matched to customers-table-wrap */}
        <div style={styles.tableWrap} className="customers-table-wrap app-users-table-wrap">
          <table style={styles.table} className="customers-table">
            <thead>
              <tr>
                <th style={styles.th}><span className="th-content">S.NO <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Cus ID <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Joined Date <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Name <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Mobile Number <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Email <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">City / State <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Status</span></th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ ...styles.td, textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                    Loading app users…
                  </td>
                </tr>
              ) : pagedUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...styles.td, textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                    {searchQuery || filterProfile !== 'all' || filterGender !== 'all'
                      ? 'No users match the search filters.'
                      : 'No app users found in the database.'}
                  </td>
                </tr>
              ) : (
                pagedUsers.map((user, idx) => {
                  const sno = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  const isCompleted = Boolean(user.profileCompleted);

                  return (
                    <tr key={user.id} style={styles.tr}>
                      <td style={styles.td}>{sno}</td>
                      <td style={{ ...styles.td, fontWeight: '500' }}>{user.cusId || '—'}</td>
                      <td style={styles.td}>{formatDisplayDate(user.createdAt || user.joinedDate)}</td>
                      <td style={{ ...styles.td, fontWeight: '500' }}>{user.name || '—'}</td>
                      <td style={styles.td}>{user.mobile || '—'}</td>
                      <td style={styles.td}>{user.email || '—'}</td>
                      <td style={styles.td}>
                        {user.city ? `${user.city}${user.state ? `, ${user.state}` : ''}` : user.state || '—'}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            backgroundColor: isCompleted ? '#dcfce7' : '#fef3c7',
                            color: isCompleted ? '#15803d' : '#b45309',
                          }}
                        >
                          {isCompleted ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                      <td style={styles.tdAction}>
                        <div style={styles.actionCellWrap}>
                          <button
                            type="button"
                            style={styles.actionTrigger}
                            onClick={() => setViewUser(user)}
                          >
                            View More
                          </button>
                          <button
                            type="button"
                            style={styles.actionMenuTrigger}
                            onClick={(e) => {
                              const id = user.id;
                              setOpenActionId(openActionId === id ? null : id);
                              setActionAnchorEl(openActionId === id ? null : e.currentTarget);
                            }}
                            aria-haspopup="true"
                            aria-expanded={openActionId === user.id}
                          >
                            ⋮
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View - matched to customers-cards */}
        <div style={styles.cardsWrap} className="customers-cards app-users-cards-wrap">
          {pagedUsers.map((user) => (
            <div key={user.id} style={styles.card} className="customer-card">
              <div style={styles.cardRow}>
                <span style={styles.cardLabel}>Cus ID:</span>
                <span style={{ fontWeight: '500' }}>{user.cusId || '—'}</span>
              </div>
              <div style={styles.cardRow}>
                <span style={styles.cardLabel}>Name:</span>
                <span style={{ fontWeight: '500' }}>{user.name || '—'}</span>
              </div>
              <div style={styles.cardRow}>
                <span style={styles.cardLabel}>Mobile:</span>
                <span>{user.mobile || '—'}</span>
              </div>
              <div style={styles.cardRow}>
                <span style={styles.cardLabel}>Email:</span>
                <span>{user.email || '—'}</span>
              </div>
              <div style={styles.cardRow}>
                <span style={styles.cardLabel}>City:</span>
                <span>{user.city || '—'}</span>
              </div>
              <div style={styles.cardRow}>
                <span style={styles.cardLabel}>Status:</span>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: user.profileCompleted ? '#dcfce7' : '#fef3c7',
                    color: user.profileCompleted ? '#15803d' : '#b45309',
                  }}
                >
                  {user.profileCompleted ? 'Completed' : 'Pending'}
                </span>
              </div>
              <div style={styles.cardActionWrap}>
                <button
                  type="button"
                  style={styles.actionTrigger}
                  onClick={() => setViewUser(user)}
                >
                  View More
                </button>
                <button
                  type="button"
                  style={styles.actionMenuTrigger}
                  onClick={(e) => {
                    const id = user.id;
                    setOpenCardActionId(openCardActionId === id ? null : id);
                    setCardActionAnchorEl(openCardActionId === id ? null : e.currentTarget);
                  }}
                  aria-haspopup="true"
                  aria-expanded={openCardActionId === user.id}
                >
                  ⋮
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination - identical to customers-pagination */}
        <div style={styles.pagination} className="customers-pagination">
          <span style={styles.pageInfo}>Showing page {currentPage} / {totalPages}</span>
          <div style={styles.paginationControls} className="pagination-controls">
            <button
              style={styles.pagBtn}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {getPaginationRange(currentPage, totalPages).map((page, idx) => (
              typeof page === 'number' ? (
                <button
                  key={`page-${page}`}
                  style={{
                    ...styles.pagBtn,
                    ...(currentPage === page ? styles.pagBtnActive : {}),
                  }}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ) : (
                <span key={`dots-${idx}`} style={{ padding: '0 6px', color: '#666', fontSize: '14px', alignSelf: 'center', userSelect: 'none' }}>
                  ...
                </span>
              )
            ))}
            <button
              style={styles.pagBtn}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#fff',
    maxWidth: '100vw',
  },
  main: {
    marginLeft: '260px',
    flex: 1,
    padding: '24px 40px',
    backgroundColor: '#fff',
    maxWidth: 'calc(100vw - 260px)',
    width: 'calc(100% - 260px)',
    minWidth: 0,
    transition: 'margin-left 0.3s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    gap: '20px',
    flexWrap: 'wrap',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  hamburger: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'none',
    padding: 0,
  },
  pageTitle: {
    fontSize: '28px',
    color: MAROON,
    fontWeight: '700',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerIcons: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  iconButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: LIGHT_GRAY,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666',
    fontSize: '18px',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: '6px',
    right: '8px',
    minWidth: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#ff4444',
    color: '#fff',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  avatar: {
    width: '45px',
    height: '45px',
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '16px',
    flexWrap: 'wrap',
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  selectWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: LIGHT_GRAY,
    borderRadius: '8px',
    padding: '0 4px 0 12px',
  },
  selectIcon: {
    color: '#666',
    fontSize: '16px',
  },
  select: {
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '0',
    padding: '10px 14px 10px 4px',
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer',
    minWidth: '100px',
  },
  filterIconBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: LIGHT_GRAY,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666',
    fontSize: '18px',
  },
  filterIconBtnActive: {
    backgroundColor: '#fce7f0',
    color: MAROON,
  },
  searchFilterWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: LIGHT_GRAY,
    borderRadius: '8px',
    padding: '0 8px 0 12px',
    minWidth: '220px',
    flex: '1 1 220px',
    maxWidth: '320px',
  },
  searchFilterInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '14px',
    color: '#333',
    padding: '10px 0',
    width: '100%',
  },
  searchClearBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    display: 'flex',
    padding: 4,
  },
  resultMeta: {
    margin: '0 0 12px',
    fontSize: '13px',
    color: '#6b7280',
  },
  tableWrap: {
    overflowX: 'auto',
    marginBottom: '20px',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '8px',
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '900px',
  },
  th: {
    textAlign: 'left',
    padding: '14px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    backgroundColor: '#fafafa',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  tr: {
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: '#333',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '600',
  },
  tdAction: {
    padding: '14px 16px',
    fontSize: '14px',
    position: 'relative',
  },
  actionCellWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  actionTrigger: {
    color: MAROON,
    fontWeight: '500',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontSize: '14px',
  },
  actionMenuTrigger: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 4px',
    fontSize: '18px',
    color: '#666',
    lineHeight: 1,
  },
  cardsWrap: {
    display: 'none',
  },
  card: {
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: '#fff',
  },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
  },
  cardLabel: {
    color: '#666',
    marginRight: '8px',
  },
  cardActionWrap: {
    position: 'relative',
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  pageInfo: {
    fontSize: '14px',
    color: '#333',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  pagBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: LIGHT_GRAY,
    color: '#333',
    fontSize: '14px',
    cursor: 'pointer',
    minWidth: '36px',
  },
  pagBtnActive: {
    backgroundColor: MAROON,
    color: '#fff',
  },
};

export default AppUsers;
