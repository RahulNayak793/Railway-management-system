import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Ticket, Info } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const CancellationModal = ({ booking, onClose, onSuccess }) => {
  const { showToast } = useToast();

  const [loadingPreview, setLoadingPreview] = useState(true);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellationResult, setCancellationResult] = useState(null);

  useEffect(() => {
    if (!booking) return;

    const fetchDetails = async () => {
      setLoadingPreview(true);
      try {
        const prevRes = await api.get(`/bookings/${booking.id}/cancellation-preview`);
        setPreview(prevRes.data);
      } catch (err) {
        console.error('Failed to fetch cancellation preview:', err);
        showToast('Error loading cancellation details: ' + (err.response?.data?.error || err.message), 'error');
      } finally {
        setLoadingPreview(false);
      }
    };

    fetchDetails();
  }, [booking]);

  if (!booking) return null;

  const origAmount = preview?.original_amount || Number(booking.total_fare || 0);
  const cancellationFee = preview?.cancellation_fee !== undefined ? preview.cancellation_fee : Math.round(origAmount * 0.1);
  const feePercentage = preview?.cancellation_fee_percentage !== undefined ? preview.cancellation_fee_percentage : 10;
  const refundAmount = preview?.refund_amount !== undefined ? preview.refund_amount : Math.max(0, origAmount - cancellationFee);
  const refundPercentage = preview?.refund_percentage !== undefined ? preview.refund_percentage : (100 - feePercentage);
  const daysUntilJourney = preview?.days_until_journey !== undefined ? preview.days_until_journey : 5;

  const handleConfirmCancellation = async () => {
    setSubmitting(true);
    try {
      const cancelRes = await api.put(`/bookings/${booking.id}/cancel`, {
        pay_separately: false
      });

      setCancellationResult(cancelRes.data);
      showToast(
        `Ticket cancelled. You will receive ₹${cancelRes.data.refund_amount} after deduction of ₹${cancelRes.data.cancellation_fee} cancellation fee.`,
        'success',
        'Cancellation Confirmed'
      );
      if (onSuccess) onSuccess(cancelRes.data);
    } catch (err) {
      console.error('Cancellation failed:', err);
      const errMsg = err.response?.data?.error || err.message || 'Cancellation request failed.';
      showToast('Cancellation Failed: ' + errMsg, 'error', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <span>Cancel Ticket Reservation</span>
                {(booking.quota === 'TATKAL' || preview?.quota === 'TATKAL') && (
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider">
                    TATKAL
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">PNR: {booking.pnr_number} • {booking.train_name || booking.train?.train_name || 'Railway Express'}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content Body */}
        {loadingPreview ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent" />
            <p className="text-xs font-bold">Calculating cancellation fee and refund details...</p>
          </div>
        ) : cancellationResult ? (
          /* Success Screen */
          <div className="p-8 text-center space-y-6 animate-slide-in">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Ticket Cancelled</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Your cancellation request has been processed successfully.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-3 font-sans text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Original Ticket Fare:</span>
                <span className="font-extrabold text-slate-800 font-mono">₹{cancellationResult.original_amount}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Cancellation Fee Deducted ({100 - cancellationResult.refund_percentage}%):</span>
                <span className="font-bold text-red-600 font-mono">- ₹{cancellationResult.cancellation_fee}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-800 font-extrabold text-sm">Total Refund Issued:</span>
                <span className="font-black text-emerald-600 text-base font-mono">₹{cancellationResult.refund_amount} ({cancellationResult.refund_percentage}%)</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition active:scale-95 shadow-md"
            >
              Done & Return
            </button>
          </div>
        ) : (
          /* Cancellation Direct Flow */
          <div className="p-6 space-y-5">

            {/* Fare Breakdown Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Original Ticket Fare</span>
                <span className="text-sm font-black text-slate-800 font-mono">₹{origAmount}</span>
              </div>

              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500 font-semibold">Cancellation Fee ({feePercentage}%)</span>
                </div>
                <span className="text-sm font-black text-red-600 font-mono">- ₹{cancellationFee}</span>
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-slate-800 font-black uppercase text-[11px] tracking-wider">Refund Amount ({refundPercentage}%)</span>
                <span className="text-lg font-black text-emerald-600 font-mono">₹{refundAmount}</span>
              </div>
            </div>

            {/* Policy Info Card */}
            <div className={`rounded-2xl p-4 border text-xs space-y-2 ${
              (preview?.quota === 'TATKAL' || booking?.quota === 'TATKAL')
                ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center space-x-2 font-bold">
                <Info className={`h-4 w-4 shrink-0 ${(preview?.quota === 'TATKAL' || booking?.quota === 'TATKAL') ? 'text-rose-600' : 'text-amber-600'}`} />
                <span>Cancellation Fee Rule Applied {(preview?.quota === 'TATKAL' || booking?.quota === 'TATKAL') ? '(Tatkal Quota)' : ''}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {preview?.rule_applied ? (
                  <span>{preview.rule_applied}</span>
                ) : (preview?.quota === 'TATKAL' || booking?.quota === 'TATKAL') ? (
                  <span>
                    <strong>Tatkal Policy Notice:</strong> As per Indian Railways IRCTC rules, confirmed Tatkal tickets are <strong>non-refundable (0% refund)</strong> upon cancellation. Waitlisted / RAC Tatkal tickets are refunded after deducting standard clerkage.
                  </span>
                ) : daysUntilJourney >= 5 ? (
                  <span>
                    Cancelled <strong>5+ days before journey</strong>: <strong>10% fee (₹{cancellationFee})</strong> is deducted from fare.
                  </span>
                ) : (
                  <span>
                    Cancelled <strong>within 5 days of journey</strong>: <strong>5% fee (₹{cancellationFee})</strong> is deducted from fare.
                  </span>
                )}
              </p>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 font-sans text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">REFUND SUMMARY</span>
                <span className="text-emerald-400 font-black font-mono text-sm">₹{refundAmount} Refund</span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-300 pt-1">
                <AlertCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>You will receive <strong>₹{refundAmount}</strong> credited directly to your Rail Wallet / payment source.</span>
              </div>
            </div>

            {/* Submit Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="w-1/3 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition active:scale-95 disabled:opacity-50"
              >
                Keep Ticket
              </button>

              <button
                type="button"
                onClick={handleConfirmCancellation}
                disabled={submitting}
                className="w-2/3 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition active:scale-95 shadow-md flex items-center justify-center space-x-2 disabled:bg-slate-400"
              >
                {submitting ? (
                  <span>Cancelling Ticket...</span>
                ) : (
                  <span>Confirm Cancellation & Get ₹{refundAmount}</span>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default CancellationModal;

