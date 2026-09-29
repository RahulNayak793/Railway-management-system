import React from 'react';
import DummyPaymentGateway from './DummyPaymentGateway';

/**
 * RailControl Payment Gateway Component
 * 100% Mock / Demo Payment Gateway for RailControl passenger flows.
 * Completely replaces external Razorpay dependency with native Indian Railways style checkout.
 */
export default function RazorpayCheckout(props) {
  return <DummyPaymentGateway {...props} />;
}

export { DummyPaymentGateway };
