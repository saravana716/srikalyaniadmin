import React, { useState, useEffect, useMemo } from 'react';
import {
  FiX,
  FiCalendar,
  FiDollarSign,
  FiCheckCircle,
  FiAlertCircle,
  FiLayers,
  FiCreditCard,
  FiRefreshCw,
  FiClock,
  FiArrowRight,
} from 'react-icons/fi';
import { MdSwapHoriz } from 'react-icons/md';
import Button from './Button';
import { formatINR } from '../utils/currencyUtils';
import { generateInstallmentSchedule, addDaysToDate, addMonthsToDate, formatPaidDate, toISODateString } from '../utils/dateUtils';
import { splitPlanInstallments } from '../services/planPurchasesService';
import { subscribePlanPaymentHistory } from '../services/customersService';

const MAROON = '#801A39';
const BORDER_GRAY = '#e5e7eb';
const LIGHT_BG = '#f9fafb';

const DAILY_PRESETS = [50, 100, 200, 500, 1000];
const MONTHLY_PRESETS = [500, 1000, 2000, 3000, 5000];

export default function EditPlanPurchaseModal({
  planPurchase,
  onClose,
  onSuccess,
  customers = [],
  plans = [],
  initialMode = 'edit', // 'edit' or 'split'
  initialTargetPayment = null, // specific payment to split
}) {
  const isEdit = !!planPurchase;

  // Basic Details
  const [customerId, setCustomerId] = useState(
    planPurchase?.customerId || planPurchase?.cusId || ''
  );
  const [cusId, setCusId] = useState(planPurchase?.cusId || '');
  const [customerName, setCustomerName] = useState(
    planPurchase?.customerName || planPurchase?.name || ''
  );
  const [mobile, setMobile] = useState(planPurchase?.mobile || '');
  const [planId, setPlanId] = useState(planPurchase?.planId || '');
  const [planName, setPlanName] = useState(planPurchase?.planName || '');
  const [nomineeName, setNomineeName] = useState(planPurchase?.nomineeName || '');
  const [startDate, setStartDate] = useState(
    planPurchase?.startDate || planPurchase?.joinedDate || new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState(planPurchase?.status || 'Active');

  // Plan Type & Split Configuration
  const initialPlanType =
    String(planPurchase?.plan || planPurchase?.planType || 'Daily').toLowerCase().includes('daily')
      ? 'Daily'
      : 'Monthly';
  const [planType, setPlanType] = useState(initialPlanType);

  // Paid amount (e.g. ₹2000)
  const existingPaid = Number(planPurchase?.savedAmount ?? planPurchase?.amount ?? 0) || 0;
  const [paidAmount, setPaidAmount] = useState(existingPaid > 0 ? String(existingPaid) : '2000');

  // Payment history discovery for splitting specific transactions (e.g. only the ₹2,000 payment)
  const [planPayments, setPlanPayments] = useState([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState(
    initialTargetPayment?.id || planPurchase?._targetPayment?.id || null
  );

  // Installment amount (e.g. ₹200 or ₹100)
  const initialInstallment =
    planPurchase?.dailyAmount ||
    planPurchase?.installmentAmount ||
    (initialPlanType === 'Daily' ? (existingPaid >= 2000 ? '200' : '100') : '1000');
  const [installmentAmount, setInstallmentAmount] = useState(String(initialInstallment));

  // Payment Mode for split installments
  const [paymentMode, setPaymentMode] = useState(
    planPurchase?.lastPaymentMode || 'Cash'
  );

  // Payment date from which consecutive daily/monthly installments start
  const [splitStartDate, setSplitStartDate] = useState(
    planPurchase?.startDate || new Date().toISOString().slice(0, 10)
  );

  // Duration in months (for monthly chits)
  const [durationMonths, setDurationMonths] = useState(
    String(planPurchase?.durationMonths || 11)
  );

  // Active view tab ('split' vs 'details')
  const [activeTab, setActiveTab] = useState(
    initialMode === 'split' || isEdit ? 'split' : 'details'
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Subscribe to payments for this plan to discover individual payment transactions
  useEffect(() => {
    if (!planPurchase) return undefined;
    const unsub = subscribePlanPaymentHistory(planPurchase, (list) => {
      setPlanPayments(list);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [planPurchase?.id, planPurchase?.cusId, planPurchase?.customerId]);

  const handleSelectPayment = (payment) => {
    if (!payment || payment === 'all') {
      setSelectedPaymentId('all');
      setPaidAmount(existingPaid > 0 ? String(existingPaid) : '2000');
      return;
    }
    setSelectedPaymentId(payment.id);
    const amt = Number(payment.paidAmount ?? payment.amount ?? 0) || 0;
    setPaidAmount(String(amt));
    if (payment.paymentMode || payment.mode) {
      setPaymentMode(payment.paymentMode || payment.mode);
    }
    const rawDate = payment.paidDate || payment.dueDate || payment.createdAt || payment.raw?.paidDate || payment.raw?.createdAt;
    if (rawDate) {
      const parsedIso = toISODateString(rawDate);
      if (parsedIso) {
        setSplitStartDate(parsedIso);
      }
    }
  };

  // Initial auto-selection of specific payment (prioritize targetPayment or payment >= ₹100)
  useEffect(() => {
    const target = initialTargetPayment || planPurchase?._targetPayment;
    if (target) {
      handleSelectPayment(target);
    } else if (planPayments.length > 0 && selectedPaymentId === null) {
      const toPick = planPayments.find((p) => Number(p.paidAmount ?? p.amount ?? 0) >= 100) || planPayments[0];
      if (toPick) {
        handleSelectPayment(toPick);
      } else {
        setSelectedPaymentId('all');
      }
    }
  }, [initialTargetPayment, planPurchase?._targetPayment, planPayments]);

  // Auto-fill customer info when customer select changes
  const handleCustomerChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setCustomerId('');
      setCusId('');
      setCustomerName('');
      setMobile('');
      return;
    }
    const selected = customers.find((c) => c.id === val || c.cusId === val);
    if (selected) {
      setCustomerId(selected.id || selected.cusId);
      setCusId(selected.cusId || '');
      setCustomerName(selected.name || '');
      setMobile(selected.mobile || '');
    }
  };

  // Auto-fill scheme details when scheme select changes
  const handlePlanChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setPlanId('');
      setPlanName('');
      return;
    }
    const selected = plans.find((p) => p.id === val);
    if (selected) {
      setPlanId(selected.id);
      setPlanName(selected.name || selected.planName);
      if (selected.type) {
        setPlanType(selected.type === 'Daily' ? 'Daily' : 'Monthly');
      }
    }
  };

  // Compute live installment schedule
  const numPaid = Math.max(0, Number(paidAmount) || 0);
  const numInst = Math.max(0, Number(installmentAmount) || 0);

  const schedule = useMemo(() => {
    if (numPaid <= 0 || numInst <= 0) return [];
    return generateInstallmentSchedule({
      totalAmount: numPaid,
      installmentAmount: numInst,
      frequency: planType,
      startDate: splitStartDate,
      mode: paymentMode,
    });
  }, [numPaid, numInst, planType, splitStartDate, paymentMode]);

  const totalDaysOrMonths = schedule.length;
  const endDate = schedule.length > 0 ? schedule[schedule.length - 1].paidDate : splitStartDate;

  // Toggle between Daily and Monthly
  const handleTogglePlanType = (newType) => {
    setPlanType(newType);
    if (newType === 'Daily') {
      if (numPaid >= 2000 && (!installmentAmount || Number(installmentAmount) >= 1000)) {
        setInstallmentAmount('200');
      } else if (!installmentAmount || Number(installmentAmount) <= 0) {
        setInstallmentAmount('100');
      }
    } else {
      if (!installmentAmount || Number(installmentAmount) < 500) {
        setInstallmentAmount('1000');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSuccessMsg('');

    if (!customerName.trim()) {
      setError('Please select or specify a customer.');
      return;
    }
    if (numPaid <= 0) {
      setError('Please enter a valid paid amount greater than ₹0.');
      return;
    }
    if (numInst <= 0) {
      setError('Please enter a valid installment amount greater than ₹0.');
      return;
    }

    setSaving(true);
    try {
      const planPurchaseId = planPurchase?.id || planPurchase?.planPurchaseId;
      const isTargeted = Boolean(selectedPaymentId && selectedPaymentId !== 'all');
      const targetPaymentObj = planPayments.find((p) => p.id === selectedPaymentId) || initialTargetPayment || planPurchase?._targetPayment;

      const result = await splitPlanInstallments({
        planPurchaseId,
        customerId: customerId || cusId,
        cusId,
        customerName,
        mobile,
        planId,
        planName: planName || (planType === 'Daily' ? 'Daily Gold Saving Plan' : 'Monthly Gold Chit Plan'),
        planType,
        totalPaidAmount: numPaid,
        installmentAmount: numInst,
        startDate: splitStartDate,
        paymentMode,
        status,
        durationMonths: Number(durationMonths) || 11,
        nomineeName,
        targetPaymentId: isTargeted ? selectedPaymentId : null,
        targetPaymentSource: targetPaymentObj?.source || null,
        isPartialPaymentSplit: isTargeted,
      });

      const countMsg =
        planType === 'Daily'
          ? `${result.totalInstallments} daily installments (next ${result.totalInstallments} days)`
          : `${result.totalInstallments} monthly installments`;

      setSuccessMsg(
        `Successfully saved! Split ₹${formatINR(numPaid).replace('₹', '')} into ${countMsg} in database.`
      );

      setTimeout(() => {
        onSuccess?.(result);
        onClose();
      }, 1100);
    } catch (err) {
      console.error('Save & split failed', err);
      setError(err?.message || 'Failed to save and split installments');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.headerIconWrap}>
              <MdSwapHoriz size={22} color="#fff" />
            </div>
            <div>
              <h2 style={styles.modalTitle}>
                {isEdit ? 'Edit Plan & Split Installments' : 'Enroll & Setup Installment Split'}
              </h2>
              <p style={styles.modalSubtitle}>
                {customerName ? (
                  <>
                    Customer: <strong style={{ color: '#111827' }}>{customerName}</strong>
                    {cusId ? ` (${cusId})` : ''} · Current Scheme: {planName || planType}
                  </>
                ) : (
                  'Change between Daily & Monthly plans and split paid amount across consecutive days'
                )}
              </p>
            </div>
          </div>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close" disabled={saving}>
            <FiX size={22} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabBar}>
          <button
            type="button"
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'split' ? styles.tabBtnActive : {}),
            }}
            onClick={() => setActiveTab('split')}
          >
            <MdSwapHoriz size={16} />
            <span>Plan Change & Installment Split</span>
            <span style={styles.tabBadge}>
              {planType}: {totalDaysOrMonths} {planType === 'Daily' ? 'Days' : 'Months'}
            </span>
          </button>
          <button
            type="button"
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'details' ? styles.tabBtnActive : {}),
            }}
            onClick={() => setActiveTab('details')}
          >
            <FiLayers size={15} />
            <span>Customer & Scheme Details</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={styles.formContainer}>
          {error && (
            <div style={styles.errorBanner}>
              <FiAlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div style={styles.successBanner}>
              <FiCheckCircle size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'split' && (
            <div style={styles.tabContent}>
              {/* Plan Type Selector */}
              <div style={styles.sectionCard}>
                <label style={styles.fieldSectionLabel}>
                  1. Select Plan Frequency / Scheme Type
                </label>
                <div style={styles.planTypeGrid}>
                  <div
                    style={{
                      ...styles.planTypeOption,
                      ...(planType === 'Daily' ? styles.planTypeOptionActive : {}),
                    }}
                    onClick={() => handleTogglePlanType('Daily')}
                  >
                    <div style={styles.planTypeRadio}>
                      <span
                        style={{
                          ...styles.radioDot,
                          backgroundColor: planType === 'Daily' ? MAROON : 'transparent',
                        }}
                      />
                    </div>
                    <div>
                      <div style={styles.planTypeTitle}>
                        <FiCalendar style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                        Daily Plan
                      </div>
                      <div style={styles.planTypeDesc}>
                        Customer pays daily amount. Splits total payment into consecutive daily records.
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      ...styles.planTypeOption,
                      ...(planType === 'Monthly' ? styles.planTypeOptionActive : {}),
                    }}
                    onClick={() => handleTogglePlanType('Monthly')}
                  >
                    <div style={styles.planTypeRadio}>
                      <span
                        style={{
                          ...styles.radioDot,
                          backgroundColor: planType === 'Monthly' ? MAROON : 'transparent',
                        }}
                      />
                    </div>
                    <div>
                      <div style={styles.planTypeTitle}>
                        <FiClock style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                        Monthly Plan
                      </div>
                      <div style={styles.planTypeDesc}>
                        Customer pays monthly installment. Splits into monthly consecutive records.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount & Split Inputs */}
              <div style={styles.sectionCard}>
                <label style={styles.fieldSectionLabel}>
                  2. Choose Payment &amp; {planType} Installment Split
                </label>

                {planPayments.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        Select which payment transaction to split:
                      </span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        {planPayments.length} payment transaction{planPayments.length === 1 ? '' : 's'} recorded
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                      {planPayments.map((p) => {
                        const isSelected = selectedPaymentId === p.id;
                        const pAmt = Number(p.paidAmount ?? p.amount ?? 0) || 0;
                        const isLump = pAmt >= 500;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectPayment(p)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: isSelected ? `2px solid ${MAROON}` : '1px solid #e5e7eb',
                              backgroundColor: isSelected ? '#fff5f7' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="radio"
                                name="selectedPaymentRadio"
                                checked={isSelected}
                                onChange={() => handleSelectPayment(p)}
                                style={{ accentColor: MAROON, cursor: 'pointer' }}
                              />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <strong style={{ color: '#16a34a', fontSize: '14px' }}>
                                    + {formatINR(pAmt)}
                                  </strong>
                                  {p.sourceLabel && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
                                      {p.sourceLabel}
                                    </span>
                                  )}
                                  {isLump && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', backgroundColor: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
                                      ✨ Lump Sum
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>
                                  {formatPaidDate(p.createdAt || p.paidDate)} · {p.paymentMode || p.mode || 'Cash'}
                                  {p.installmentNo ? ` · #${p.installmentNo}` : ''}
                                </div>
                              </div>
                            </div>
                            <div>
                              <span style={{
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: isSelected ? MAROON : '#6b7280',
                              }}>
                                {isSelected ? '✓ Splitting this payment' : 'Click to split this payment'}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Option to combine and split entire plan balance */}
                      <div
                        onClick={() => handleSelectPayment('all')}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: selectedPaymentId === 'all' ? `2px solid ${MAROON}` : '1px dashed #d1d5db',
                          backgroundColor: selectedPaymentId === 'all' ? '#fff5f7' : '#fafafa',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="radio"
                            name="selectedPaymentRadio"
                            checked={selectedPaymentId === 'all'}
                            onChange={() => handleSelectPayment('all')}
                            style={{ accentColor: MAROON, cursor: 'pointer' }}
                          />
                          <div>
                            <strong style={{ color: '#111827', fontSize: '13px' }}>
                              Combine &amp; Split Full Plan Balance ({formatINR(existingPaid)})
                            </strong>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              Bundles all payments together into one single schedule
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedPaymentId && selectedPaymentId !== 'all' ? (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <FiCheckCircle size={16} />
                        <span>
                          <strong>Splitting ONLY this ₹{paidAmount} payment.</strong> Other payments will remain untouched and preserved in customer records.
                        </span>
                      </div>
                    ) : (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#1e40af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <FiLayers size={15} />
                        <span>
                          Splitting full combined plan balance of <strong>{formatINR(existingPaid)}</strong>.
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Paid Amount */}
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>
                      Total Amount Paid (₹) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={styles.inputPrefixWrap}>
                      <span style={styles.inputPrefix}>₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        style={styles.formInputWithPrefix}
                        placeholder="e.g. 2000"
                        required
                      />
                    </div>
                    <span style={styles.fieldHint}>
                      Example: User paid ₹2,000 upfront
                    </span>
                  </div>

                  {/* Installment Amount */}
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>
                      {planType === 'Daily' ? 'Daily Installment Amount (₹)' : 'Monthly Installment (₹)'}{' '}
                      <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={styles.inputPrefixWrap}>
                      <span style={styles.inputPrefix}>₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={installmentAmount}
                        onChange={(e) => setInstallmentAmount(e.target.value)}
                        style={styles.formInputWithPrefix}
                        placeholder={planType === 'Daily' ? 'e.g. 200 or 100' : 'e.g. 1000'}
                        required
                      />
                    </div>
                    <div style={styles.presetChips}>
                      <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center' }}>Presets:</span>
                      {(planType === 'Daily' ? DAILY_PRESETS : MONTHLY_PRESETS).map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          style={{
                            ...styles.chipBtn,
                            ...(Number(installmentAmount) === amt ? styles.chipBtnActive : {}),
                          }}
                          onClick={() => setInstallmentAmount(String(amt))}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Date & Payment Mode */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>
                      Installment Start Date (Payment Date)
                    </label>
                    <input
                      type="date"
                      value={splitStartDate}
                      onChange={(e) => setSplitStartDate(e.target.value)}
                      style={styles.formInput}
                      required
                    />
                    <span style={styles.fieldHint}>
                      Daily installments will begin from this date
                    </span>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      style={styles.formSelect}
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Card">Debit / Credit Card</option>
                      <option value="Bank">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Calculation Banner */}
              {schedule.length > 0 && (
                <div style={styles.calcHighlightCard}>
                  <div style={styles.calcHeader}>
                    <span style={styles.calcBadge}>
                      {planType === 'Daily' ? 'Daily Split Calculation' : 'Monthly Split Calculation'}
                    </span>
                    <span style={styles.calcDateRange}>
                      📅 {splitStartDate} <FiArrowRight style={{ verticalAlign: 'middle', margin: '0 4px' }} /> {endDate}
                    </span>
                  </div>
                  <div style={styles.calcFormula}>
                    <span style={styles.formulaBig}>
                      ₹{formatINR(numPaid).replace('₹', '')}
                    </span>
                    <span style={styles.formulaOp}>÷</span>
                    <span style={styles.formulaBig}>
                      ₹{formatINR(numInst).replace('₹', '')}
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>
                        /{planType === 'Daily' ? 'day' : 'month'}
                      </span>
                    </span>
                    <span style={styles.formulaOp}>=</span>
                    <span style={styles.formulaResult}>
                      {totalDaysOrMonths} {planType === 'Daily' ? 'Days' : 'Months'}
                    </span>
                  </div>
                  <p style={styles.calcExplanation}>
                    {planType === 'Daily'
                      ? `When saved, exactly ${totalDaysOrMonths} daily records (from ${splitStartDate} to ${endDate}) of ₹${formatINR(numInst).replace('₹', '')} each will be recorded in the database under 'installments' collection. Both Admin and Mobile app will immediately display these ${totalDaysOrMonths} daily entries.`
                      : `When saved, exactly ${totalDaysOrMonths} monthly records of ₹${formatINR(numInst).replace('₹', '')} each will be recorded in the database. Both Admin and Mobile app will immediately display these entries.`}
                  </p>
                </div>
              )}

              {/* Installments Table Preview */}
              {schedule.length > 0 && (
                <div style={styles.scheduleTableWrap}>
                  <div style={styles.scheduleHeader}>
                    <span style={styles.scheduleTitle}>
                      Preview of Generated Database Records ({schedule.length} Entries)
                    </span>
                    <span style={styles.scheduleCount}>
                      Total: ₹{formatINR(numPaid).replace('₹', '')}
                    </span>
                  </div>
                  <div style={styles.tableScroll}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Installment #</th>
                          <th style={styles.th}>Payment / Due Date</th>
                          <th style={styles.th}>Amount (₹)</th>
                          <th style={styles.th}>Mode</th>
                          <th style={styles.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((item) => (
                          <tr key={item.installmentNo} style={styles.tr}>
                            <td style={styles.td}>
                              <span style={styles.instPill}>{item.installmentNo}</span>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontWeight: 600, color: '#111827' }}>
                                {item.paidDate}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <strong style={{ color: '#15803d', fontSize: '13.5px' }}>
                                + ₹{item.amount}
                              </strong>
                              {item.isRemainder && (
                                <span style={styles.remainderBadge}>Remainder</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <span style={styles.modeBadge}>{item.mode}</span>
                            </td>
                            <td style={styles.td}>
                              <span style={styles.statusBadge}>Paid</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div style={styles.tabContent}>
              <div style={styles.sectionCard}>
                <label style={styles.fieldSectionLabel}>Customer Information</label>
                {isEdit ? (
                  <div style={styles.readOnlyCustBox}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                      {customerName || 'Customer'}
                    </div>
                    <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2 }}>
                      Customer ID: <strong style={{ color: MAROON }}>{cusId || customerId}</strong>
                      {mobile && ` · Mobile: ${mobile}`}
                    </div>
                  </div>
                ) : (
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Customer <span style={{ color: '#dc2626' }}>*</span></label>
                    <select
                      value={customerId}
                      onChange={handleCustomerChange}
                      style={styles.formSelect}
                      required
                    >
                      <option value="">Select a Customer</option>
                      {customers.map((c) => (
                        <option key={c.id || c.cusId} value={c.id || c.cusId}>
                          {c.name} ({c.cusId || 'No ID'}) {c.mobile ? `• ${c.mobile}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={styles.sectionCard}>
                <label style={styles.fieldSectionLabel}>Scheme & Account Settings</label>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Chit / Gold Scheme</label>
                  <select
                    value={planId}
                    onChange={handlePlanChange}
                    style={styles.formSelect}
                  >
                    <option value="">Select a Scheme (Optional)</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.planName} ({p.type || 'Monthly'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Scheme Name</label>
                    <input
                      type="text"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      style={styles.formInput}
                      placeholder={planType === 'Daily' ? 'Daily Gold Saving Scheme' : 'Monthly Gold Chit Plan'}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Duration (Months)</label>
                    <input
                      type="number"
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(e.target.value)}
                      style={styles.formInput}
                      placeholder="11"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Nominee Name (Optional)</label>
                    <input
                      type="text"
                      value={nomineeName}
                      onChange={(e) => setNomineeName(e.target.value)}
                      style={styles.formInput}
                      placeholder="e.g. Spouse / Nominee"
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Account Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={styles.formSelect}
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Closed">Closed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div style={styles.modalFooter}>
            <div style={styles.footerSummary}>
              <span style={{ fontSize: 13, color: '#4b5563' }}>
                Mode: <strong style={{ color: MAROON }}>{planType} Plan</strong> ·{' '}
                Total Paid: <strong>₹{formatINR(numPaid).replace('₹', '')}</strong> ·{' '}
                Records to save: <strong style={{ color: '#15803d' }}>{schedule.length}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={saving}
                loadingText="Saving to DB…"
                style={{ minWidth: 180 }}
              >
                💾 Save & Split to DB
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '16px',
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    width: '100%',
    maxWidth: '780px',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
    animation: 'modalSlideIn 0.25s ease-out',
  },
  modalHeader: {
    padding: '18px 24px',
    backgroundColor: '#fff',
    borderBottom: `1px solid ${BORDER_GRAY}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: MAROON,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    margin: '3px 0 0 0',
    fontSize: '12.5px',
    color: '#6b7280',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    display: 'flex',
    backgroundColor: '#f3f4f6',
    padding: '4px 16px',
    gap: 8,
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#4b5563',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    color: MAROON,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  tabBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: '10px',
    backgroundColor: '#fce7f0',
    color: MAROON,
  },
  formContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  tabContent: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  errorBanner: {
    margin: '16px 24px 0 24px',
    padding: '10px 14px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  successBanner: {
    margin: '16px 24px 0 24px',
    padding: '10px 14px',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sectionCard: {
    backgroundColor: LIGHT_BG,
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '10px',
    padding: '16px',
  },
  fieldSectionLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  planTypeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  planTypeOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px',
    borderRadius: '8px',
    border: `2px solid #e5e7eb`,
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  planTypeOptionActive: {
    borderColor: MAROON,
    backgroundColor: '#fff7f9',
    boxShadow: '0 2px 8px rgba(128, 26, 57, 0.08)',
  },
  planTypeRadio: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: `2px solid ${MAROON}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  planTypeTitle: {
    fontSize: '14.5px',
    fontWeight: '700',
    color: '#111827',
  },
  planTypeDesc: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 1.35,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  formLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
  },
  fieldHint: {
    fontSize: '11.5px',
    color: '#6b7280',
    marginTop: 2,
  },
  inputPrefixWrap: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  inputPrefix: {
    padding: '0 10px',
    color: '#6b7280',
    fontWeight: 600,
    fontSize: '14px',
    backgroundColor: '#f3f4f6',
    borderRight: '1px solid #d1d5db',
    height: '38px',
    display: 'flex',
    alignItems: 'center',
  },
  formInputWithPrefix: {
    flex: 1,
    height: '38px',
    padding: '0 12px',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#111827',
    fontWeight: '600',
  },
  formInput: {
    height: '38px',
    padding: '0 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '13.5px',
    color: '#111827',
    backgroundColor: '#fff',
    outline: 'none',
  },
  formSelect: {
    height: '38px',
    padding: '0 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '13.5px',
    color: '#111827',
    backgroundColor: '#fff',
    outline: 'none',
  },
  presetChips: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  chipBtn: {
    padding: '3px 8px',
    fontSize: '11.5px',
    fontWeight: '600',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    backgroundColor: '#fff',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
  chipBtnActive: {
    backgroundColor: MAROON,
    color: '#fff',
    borderColor: MAROON,
  },
  calcHighlightCard: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    padding: '16px',
  },
  calcHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calcBadge: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  calcDateRange: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#166534',
  },
  calcFormula: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
  },
  formulaBig: {
    fontSize: '19px',
    fontWeight: '800',
    color: '#15803d',
  },
  formulaOp: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#9ca3af',
  },
  formulaResult: {
    fontSize: '20px',
    fontWeight: '800',
    color: MAROON,
    backgroundColor: '#fff',
    padding: '3px 10px',
    borderRadius: '6px',
    border: `1px solid #fce7f0`,
  },
  calcExplanation: {
    margin: '6px 0 0 0',
    fontSize: '12px',
    color: '#166534',
    lineHeight: 1.45,
  },
  scheduleTableWrap: {
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '10px',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  scheduleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    backgroundColor: '#f9fafb',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  scheduleTitle: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#374151',
  },
  scheduleCount: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#15803d',
  },
  tableScroll: {
    maxHeight: '190px',
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12.5px',
  },
  th: {
    padding: '8px 14px',
    textAlign: 'left',
    backgroundColor: '#f9fafb',
    color: '#6b7280',
    fontWeight: '600',
    fontSize: '11.5px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '8px 14px',
    color: '#1f2937',
  },
  instPill: {
    display: 'inline-block',
    padding: '2px 6px',
    fontSize: '11px',
    fontWeight: '700',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    borderRadius: '4px',
  },
  remainderBadge: {
    marginLeft: 6,
    fontSize: '10px',
    backgroundColor: '#fef3c7',
    color: '#b45309',
    padding: '1px 5px',
    borderRadius: '3px',
    fontWeight: 600,
  },
  modeBadge: {
    fontSize: '11.5px',
    color: '#4b5563',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    padding: '2px 7px',
    borderRadius: '10px',
  },
  readOnlyCustBox: {
    padding: '10px 14px',
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '6px',
  },
  modalFooter: {
    padding: '14px 24px',
    backgroundColor: '#f9fafb',
    borderTop: `1px solid ${BORDER_GRAY}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  footerSummary: {
    display: 'flex',
    alignItems: 'center',
  },
};
