# Future Optimizations

**Status:** Backlog (Low Priority)
**Last reviewed:** 2025-12-28

## Custom Subscription Management UI

**Priority:** Low
**Effort:** Medium
**Current State:** Using Stripe Customer Portal (redirect)

### Problem
Currently, clicking "Manage Subscription" redirects users to Stripe's hosted Customer Portal. This creates a context switch and breaks the in-app experience.

### Proposed Solution
Build custom subscription management screens within the app:

1. **Subscription Status Card**
   - Current plan and billing cycle
   - Next billing date
   - Payment method on file (last 4 digits)

2. **Cancel Subscription Flow**
   - In-app cancellation with confirmation
   - Optional: Retention offer or feedback survey
   - API: `POST /api/billing/cancel-subscription`

3. **Update Payment Method**
   - Stripe Elements for new card entry
   - API: `POST /api/billing/update-payment-method`
   - Uses SetupIntent for card-only collection

4. **Invoice History**
   - List past invoices with amounts and dates
   - Download PDF links (from Stripe)
   - API: `GET /api/billing/invoices`

### Implementation Notes
- Use Stripe's `stripe.paymentMethods.attach()` and `stripe.customers.update()` for payment method updates
- Use `stripe.subscriptions.update({ cancel_at_period_end: true })` for cancellation
- Invoices available via `stripe.invoices.list({ customer })`

### Why Not Now
- Stripe Portal works and is PCI compliant
- MVP needs to ship
- No user complaints yet about the redirect

### Trigger to Implement
- User feedback indicating friction with subscription management
- Conversion drop-off at the portal redirect
- Brand/UX consistency becoming a priority
