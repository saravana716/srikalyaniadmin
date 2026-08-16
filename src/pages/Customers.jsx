import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSearch, FiSettings, FiBell, FiMenu, FiFilter, FiX } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import { subscribeCustomers, addCustomer as addCustomerToDb, updateCustomer as updateCustomerInDb, deleteCustomer as deleteCustomerFromDb, creditCustomerAccount, subscribeCustomerLedger } from '../services/customersService';
import { formatToIST } from '../utils/dateUtils';
import { formatINR } from '../utils/currencyUtils';
import AddFundsModal from '../components/AddFundsModal';
import { useLatestMetalRates } from '../hooks/useLatestMetalRates';
import { formatSavedWeightForDisplay, savedWeightMeta } from '../utils/weightUtils';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';
const PAGE_SIZE = 10;
const DEFAULT_PLANS = ['Daily', 'Weekly', 'Monthly'];

const AddEditCustomerModal = ({ customer, onClose, onSave, error, saving }) => {
  const isEdit = !!customer;
  const [name, setName] = useState(customer?.name ?? '');
  const [password, setPassword] = useState(customer?.password ?? '');
  const [amount, setAmount] = useState(customer?.amount ?? '');
  const [plan, setPlan] = useState(customer?.plan ?? 'Daily');
  const [mobile, setMobile] = useState(customer?.mobile ?? '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave({ name, password, amount: Number(amount) || 0, plan, mobile }, customer?.id);
  };

  return (
    <div style={styles.modalOverlay} className="add-customer-modal-overlay" onClick={onClose}>
      <div style={styles.modalBox} className="add-customer-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          {isEdit && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Customer ID</label>
                <input type="text" value={customer.cusId || ''} style={{ ...styles.formInput, backgroundColor: '#f3f4f6' }} readOnly />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Joined Date (IST)</label>
                <input type="text" value={formatToIST(customer.joinedDate)} style={{ ...styles.formInput, backgroundColor: '#f3f4f6' }} readOnly />
              </div>
            </>
          )}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={styles.formInput} placeholder="Enter name" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Password</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.formInput} placeholder="Enter password" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Account Amount (₹)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.formInput} placeholder="Opening / account balance" min="0" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Plan</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} style={styles.formSelect}>
              <option value="Daily">Daily</option>
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Mobile Number</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              style={styles.formInput}
              placeholder="Enter 10-digit mobile number"
              required
              maxLength={10}
              inputMode="numeric"
              pattern="[0-9]{10}"
              title="Enter a 10-digit mobile number"
            />
          </div>
          <div style={styles.modalFooter} className="add-customer-modal-footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              type="submit"
              loading={saving}
              loadingText={isEdit ? 'Updating…' : 'Adding…'}
            >
              {isEdit ? 'Update Customer' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ViewCustomerModal = ({ customer, onClose, onEdit, onAddFunds }) => {
  const [ledger, setLedger] = useState([]);
  const { rates } = useLatestMetalRates();

  useEffect(() => {
    if (!customer?.id) return undefined;
    return subscribeCustomerLedger(customer.id, setLedger);
  }, [customer?.id]);

  if (!customer) return null;

  const balance = customer.accountBalance ?? customer.amount ?? 0;
  const weightInfo = savedWeightMeta(balance, rates, customer);
  const rows = [
    { label: 'Customer ID:', value: customer.cusId || '—' },
    { label: 'Joined Date (IST):', value: formatToIST(customer.joinedDate) },
    { label: 'Name:', value: customer.name },
    { label: 'Password:', value: customer.password },
    { label: 'Account Balance:', value: formatINR(balance) },
    {
      label: 'Saved Weight:',
      value: weightInfo.ratePerGram
        ? `${weightInfo.label} (${weightInfo.hint})`
        : weightInfo.hint,
    },
    { label: 'Plan:', value: customer.plan },
    { label: 'Mobile Number:', value: customer.mobile },
    { label: 'Last Payment Mode:', value: customer.lastPaymentMode || '—' },
  ];

  const formatLedgerTime = (ts) => {
    if (!ts) return '—';
    if (typeof ts?.toDate === 'function') return formatToIST(ts.toDate().toISOString());
    return formatToIST(ts);
  };

  return (
    <div style={styles.viewOverlay} className="view-more-modal-overlay" onClick={onClose}>
      <div style={styles.viewPanel} className="view-more-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Customer Details</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <h3 style={styles.modalSectionTitle}>Customer Information</h3>
          <div style={styles.modalDetails}>
            {rows.map(({ label, value }) => (
              <div key={label} style={styles.modalRow}>
                <span style={styles.modalLabel}>{label}</span>
                <span style={styles.modalValue}>{value}</span>
              </div>
            ))}
          </div>

          <h3 style={{ ...styles.modalSectionTitle, marginTop: 24 }}>Add Cash History</h3>
          {ledger.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>No cash additions yet.</p>
          ) : (
            <div style={styles.ledgerList}>
              {ledger.map((entry) => (
                <div key={entry.id} style={styles.ledgerItem}>
                  <div style={styles.ledgerTop}>
                    <strong style={{ color: '#16a34a' }}>+ {formatINR(entry.amount)}</strong>
                    <span style={styles.ledgerMode}>{entry.paymentMode || 'Cash'}</span>
                  </div>
                  <div style={styles.ledgerMeta}>
                    {formatLedgerTime(entry.createdAt)}
                    {entry.planName ? ` · ${entry.planName}` : ''}
                    {entry.balanceAfter != null ? ` · Bal ${formatINR(entry.balanceAfter)}` : ''}
                  </div>
                  {entry.note ? <div style={styles.ledgerNote}>{entry.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={styles.modalFooter} className="app-modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          <Button type="button" onClick={() => { onClose(); onAddFunds?.(customer); }}>Add Cash / Account</Button>
          <Button type="button" onClick={() => { onClose(); onEdit(customer); }}>Edit</Button>
        </div>
      </div>
    </div>
  );
};

const Customers = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionAnchorEl, setActionAnchorEl] = useState(null);
  const [openCardActionId, setOpenCardActionId] = useState(null);
  const [cardActionAnchorEl, setCardActionAnchorEl] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fundsCustomer, setFundsCustomer] = useState(null);
  const [fundsSaving, setFundsSaving] = useState(false);
  const [fundsError, setFundsError] = useState(null);
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const { rates } = useLatestMetalRates();

  useEffect(() => {
    const unsub = subscribeCustomers((list) => {
      setCustomers(list.map((row, i) => ({ ...row, sno: i + 1 })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const planOptions = useMemo(() => {
    const set = new Set(DEFAULT_PLANS);
    customers.forEach((c) => {
      if (c.plan && String(c.plan).trim()) set.add(String(c.plan).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (filterPlan !== 'all' && String(c.plan || '') !== filterPlan) return false;

        const bal = Number(c.accountBalance ?? c.amount ?? 0) || 0;
        if (filterStatus === 'active' && bal <= 0) return false;
        if (filterStatus === 'inactive' && bal > 0) return false;

        if (q) {
          const hay = [c.name, c.mobile, c.cusId, c.plan, c.password]
            .map((x) => String(x || '').toLowerCase())
            .join(' ');
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((row, i) => ({ ...row, sno: i + 1 }));
  }, [customers, filterPlan, filterStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [filterPlan, filterStatus, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(start, start + PAGE_SIZE);
  }, [filteredCustomers, currentPage]);

  const closeMenus = () => {
    setOpenActionId(null);
    setActionAnchorEl(null);
    setOpenCardActionId(null);
    setCardActionAnchorEl(null);
  };

  const handleView = (row) => {
    closeMenus();
    setViewCustomer(row);
  };

  const handleEdit = (row) => {
    closeMenus();
    setEditingCustomer(row);
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete customer "${row.name}"?`)) return;
    closeMenus();
    setDeleting(true);
    try {
      await deleteCustomerFromDb(row.id);
    } catch (e) {
      console.error('Delete customer failed', e);
      alert(e?.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveCustomer = async (data, id) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (id) {
        await updateCustomerInDb(id, data);
        setEditingCustomer(null);
      } else {
        await addCustomerToDb(data);
        setShowAddModal(false);
      }
    } catch (e) {
      console.error('Save customer failed', e);
      setSaveError(e?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFunds = async (credit) => {
    if (!fundsCustomer?.id) return;
    setFundsError(null);
    setFundsSaving(true);
    try {
      await creditCustomerAccount(fundsCustomer.id, credit);
      setFundsCustomer(null);
    } catch (e) {
      console.error('Credit account failed', e);
      setFundsError(e?.message || 'Failed to add funds');
    } finally {
      setFundsSaving(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container customers-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {showAddModal && (
        <AddEditCustomerModal
          onClose={() => { if (!saving) { setShowAddModal(false); setSaveError(null); } }}
          onSave={handleSaveCustomer}
          error={saveError}
          saving={saving}
        />
      )}
      {editingCustomer && (
        <AddEditCustomerModal
          customer={editingCustomer}
          onClose={() => { if (!saving) { setEditingCustomer(null); setSaveError(null); } }}
          onSave={handleSaveCustomer}
          error={saveError}
          saving={saving}
        />
      )}
      {viewCustomer && (
        <ViewCustomerModal
          customer={viewCustomer}
          onClose={() => setViewCustomer(null)}
          onEdit={(row) => setEditingCustomer(row)}
          onAddFunds={(row) => setFundsCustomer(row)}
        />
      )}
      {fundsCustomer && (
        <AddFundsModal
          customer={fundsCustomer}
          onClose={() => { if (!fundsSaving) { setFundsCustomer(null); setFundsError(null); } }}
          onSubmit={handleAddFunds}
          saving={fundsSaving}
          error={fundsError}
        />
      )}

      <main style={styles.main} className="dashboard-main customers-main">
        {/* Header */}
        <header style={styles.header} className="dashboard-header customers-header">
          <div style={styles.headerRow}>
            <button
              style={styles.hamburger}
              className="mobile-hamburger"
              onClick={() => setIsSidebarOpen(true)}
            >
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Customers</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <div style={styles.headerIcons}>
              <button style={styles.iconButton}><FiSettings /></button>
              <button style={styles.iconButton}>
                <span style={styles.notifBadge}>1</span>
                <FiBell />
              </button>
              <img src="https://ui-avatars.com/api/?name=User&background=random" alt="Profile" style={styles.avatar} />
            </div>
          </div>
        </header>

        {/* Filters & Add Customer */}
        <div style={styles.toolbar} className="customers-toolbar">
          <div style={styles.filters}>
            <div style={styles.selectWrap}>
              <FiFilter style={styles.selectIcon} />
              <select
                style={styles.select}
                className="filter-select"
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                aria-label="Filter by plan"
              >
                <option value="all">All Plans</option>
                {planOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div style={styles.selectWrap}>
              <FiFilter style={styles.selectIcon} />
              <select
                style={styles.select}
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active (Has Balance)</option>
                <option value="inactive">Inactive (Zero Balance)</option>
              </select>
            </div>

            {searchOpen ? (
              <div style={styles.searchFilterWrap}>
                <FiSearch style={styles.selectIcon} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, mobile, ID…"
                  style={styles.searchFilterInput}
                  autoFocus
                  aria-label="Search customers"
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
            ) : null}

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
          <Button type="button" onClick={() => setShowAddModal(true)}>+ Add Customer</Button>
        </div>

        {!loading && (
          <p style={styles.resultMeta}>
            Showing {pageCustomers.length} of {filteredCustomers.length} customer
            {filteredCustomers.length === 1 ? '' : 's'}
            {filteredCustomers.length !== customers.length ? ` (filtered from ${customers.length})` : ''}
          </p>
        )}

        {/* Table action menu (portal, outside table) */}
        <ActionMenu
          isOpen={!!openActionId}
          onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
          anchorEl={actionAnchorEl}
          busy={deleting}
          onView={() => { const row = filteredCustomers.find((r) => r.id === openActionId); if (row) handleView(row); }}
          onEdit={() => { const row = filteredCustomers.find((r) => r.id === openActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = filteredCustomers.find((r) => r.id === openActionId); if (row) return handleDelete(row); }}
        />

        {/* Table - desktop */}
        <div style={styles.tableWrap} className="customers-table-wrap">
          <table style={styles.table} className="customers-table">
            <thead>
              <tr>
                <th style={styles.th}><span className="th-content">S.NO <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Cus ID <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Joined Date <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Name <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Password <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Account <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Saved Weight <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Plan <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Mobile Number <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : pageCustomers).map((row) => (
                <tr key={row.id || row.sno} style={styles.tr}>
                  <td style={styles.td}>{row.sno}</td>
                  <td style={styles.td}>{row.cusId}</td>
                  <td style={styles.td}>{formatToIST(row.joinedDate)}</td>
                  <td style={styles.td}>{row.name}</td>
                  <td style={styles.td}>{row.password}</td>
                  <td style={styles.td}>{formatINR(row.accountBalance ?? row.amount ?? 0)}</td>
                  <td style={styles.td}>
                    {formatSavedWeightForDisplay(row.accountBalance ?? row.amount ?? 0, rates, row)}
                  </td>
                  <td style={styles.td}>{row.plan}</td>
                  <td style={styles.td}>{row.mobile}</td>
                  <td style={styles.tdAction}>
                    <div style={styles.actionCellWrap}>
                      <button
                        type="button"
                        style={styles.actionTrigger}
                        onClick={(e) => {
                          const id = row.id;
                          setOpenActionId(openActionId === id ? null : id);
                          setActionAnchorEl(openActionId === id ? null : e.currentTarget);
                        }}
                        aria-haspopup="true"
                        aria-expanded={openActionId === row.id}
                      >
                        View More
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && pageCustomers.length === 0 && (
                <tr>
                  <td style={{ ...styles.td, textAlign: 'center', padding: 24 }} colSpan={10}>
                    No customers match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Card action menu (portal) */}
        <ActionMenu
          isOpen={!!openCardActionId}
          onClose={() => { setOpenCardActionId(null); setCardActionAnchorEl(null); }}
          anchorEl={cardActionAnchorEl}
          busy={deleting}
          onView={() => { const row = filteredCustomers.find((r) => r.id === openCardActionId); if (row) handleView(row); }}
          onEdit={() => { const row = filteredCustomers.find((r) => r.id === openCardActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = filteredCustomers.find((r) => r.id === openCardActionId); if (row) return handleDelete(row); }}
        />

        {/* Cards - mobile only (hidden on desktop) */}
        <div className="customers-cards" style={styles.cardsWrap}>
          {(loading ? [] : pageCustomers).map((row) => (
            <div key={row.id || row.sno} style={styles.card} className="customer-card">
              <div style={styles.cardRow}><span style={styles.cardLabel}>S.NO</span><span>{row.sno}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Cus ID</span><span>{row.cusId}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Joined Date</span><span>{formatToIST(row.joinedDate)}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Name</span><span>{row.name}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Account</span><span>{formatINR(row.accountBalance ?? row.amount ?? 0)}</span></div>
              <div style={styles.cardRow}>
                <span style={styles.cardLabel}>Saved Weight</span>
                <span>{formatSavedWeightForDisplay(row.accountBalance ?? row.amount ?? 0, rates, row)}</span>
              </div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Plan</span><span>{row.plan}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Mobile</span><span>{row.mobile}</span></div>
              <div style={styles.cardActionWrap}>
                <button
                  type="button"
                  style={styles.actionTrigger}
                  onClick={(e) => {
                    const id = row.id;
                    setOpenCardActionId(openCardActionId === id ? null : id);
                    setCardActionAnchorEl(openCardActionId === id ? null : e.currentTarget);
                  }}
                >
                  View More
                </button>
              </div>
            </div>
          ))}
          {!loading && pageCustomers.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: 14 }}>No customers match your filters.</p>
          )}
        </div>

        {loading && <p style={{ marginBottom: 16, color: '#666' }}>Loading customers…</p>}

        {/* Pagination */}
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
            <button
              style={{ ...styles.pagBtn, ...(currentPage === 1 ? styles.pagBtnActive : {}) }}
              onClick={() => setCurrentPage(1)}
            >
              1
            </button>
            <button
              style={{ ...styles.pagBtn, ...(currentPage === 2 ? styles.pagBtnActive : {}) }}
              onClick={() => setCurrentPage(2)}
            >
              2
            </button>
            <button
              style={{ ...styles.pagBtn, ...(currentPage === 3 ? styles.pagBtnActive : {}) }}
              onClick={() => setCurrentPage(3)}
            >
              3
            </button>
            <button style={styles.pagBtn}>...</button>
            <button
              style={styles.pagBtn}
              disabled={currentPage === totalPages}
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
  },
  main: {
    marginLeft: '260px',
    flex: 1,
    padding: '24px 40px',
    backgroundColor: '#fff',
    maxWidth: '100vw',
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
  pageTitle: {
    fontSize: '28px',
    color: MAROON,
    fontWeight: '700',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  searchContainer: {
    position: 'relative',
    backgroundColor: LIGHT_GRAY,
    borderRadius: '24px',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    width: '300px',
  },
  searchIcon: {
    color: '#999',
    marginRight: '8px',
    fontSize: '18px',
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '14px',
    width: '100%',
    color: '#333',
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
  addBtn: {
    backgroundColor: MAROON,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tableWrap: {
    overflowX: 'auto',
    marginBottom: '20px',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '8px',
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
  tdAction: {
    padding: '14px 16px',
    fontSize: '14px',
    position: 'relative',
  },
  actionCellWrap: {
    position: 'relative',
    display: 'inline-block',
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
  actionDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    minWidth: '120px',
    backgroundColor: '#fafafa',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    padding: '8px 0',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
  },
  actionDropdownPos: {},
  actionDropdownPosCard: {
    top: 'auto',
    bottom: '100%',
    marginTop: 0,
    marginBottom: '4px',
  },
  actionItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#333',
  },
  cardActionWrap: {
    position: 'relative',
    marginTop: '12px',
    display: 'inline-block',
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
  hamburger: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'none',
    padding: 0,
  },

  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: '20px', fontWeight: '700', color: '#1f2937', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  form: { padding: '24px' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', color: '#333', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', color: '#333', backgroundColor: '#fff', cursor: 'pointer', boxSizing: 'border-box' },
  modalFooter: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', padding: '16px 24px 20px', marginTop: '8px', borderTop: `1px solid ${BORDER_GRAY}` },
  modalBtnCancel: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #9ca3af', backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  modalBtnPrimary: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  viewOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  viewPanel: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalBody: { padding: '24px' },
  modalSectionTitle: { fontSize: '16px', fontWeight: '700', color: MAROON, marginBottom: '16px' },
  ledgerList: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' },
  ledgerItem: { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, backgroundColor: '#fafafa' },
  ledgerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  ledgerMode: { fontSize: '12px', fontWeight: '700', color: MAROON, backgroundColor: '#fce7f0', padding: '2px 8px', borderRadius: '999px' },
  ledgerMeta: { marginTop: '4px', fontSize: '12px', color: '#6b7280' },
  ledgerNote: { marginTop: '4px', fontSize: '13px', color: '#374151' },
  modalDetails: { display: 'flex', flexDirection: 'column', gap: '12px' },
  modalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', fontSize: '14px' },
  modalLabel: { fontWeight: '500', color: '#4b5563' },
  modalValue: { fontWeight: '700', color: '#111', textAlign: 'right' },
};

export default Customers;
