# Periodic Email Insights Design

> Created 2026-01-02 - Scheduled insights emails with AI-powered summaries

## Problem Statement

Users lose track of their job search progress over time. They may forget what they've accomplished, what needs attention, and what opportunities exist for improvement. There's no mechanism to:

1. Remind users of their progress and achievements
2. Surface actionable insights about their profile and job search
3. Re-engage inactive users with personalized content
4. Deliver value asynchronously when users aren't actively using the app

## Goals

1. **Periodic Engagement**: Send scheduled emails (weekly, monthly, quarterly, yearly) with personalized insights
2. **Actionable Content**: Each email surfaces specific things users can work on
3. **Progress Celebration**: Highlight accomplishments and growth over time
4. **Cost Efficiency**: Leverage AI batch APIs for 50% cost savings on insight generation
5. **User Control**: Allow users to customize frequency and opt-out

## Non-Goals

- Real-time notifications (use push notifications instead)
- Marketing/promotional emails
- Email deliverability infrastructure (use established provider)
- Mobile push notification integration

---

## Email Types & Cadences

### 1. Weekly Digest (Default: Enabled)
**Purpose**: Keep active job seekers engaged and on track

**Content**:
- New opportunities added this week
- Applications submitted / status changes
- Profile improvements made
- Quick actions: "Add a story about X" or "Update your profile for Y"
- Upcoming interview reminders (if applicable)

**AI Analysis Required**:
- Suggest 1-2 specific stories to add based on claim gaps
- Identify weak claims that need more evidence

### 2. Monthly Insights Report (Default: Enabled)
**Purpose**: Comprehensive progress review and strategic recommendations

**Content**:
- Month-over-month comparison of profile strength
- Top 3 accomplishments/improvements
- Skills trending in tracked opportunities
- Personalized recommendations:
  - "Companies like X are looking for Y skill - consider adding a story"
  - "Your Z claim has 5 evidence points - it's your strongest area"
- AI-generated "identity reflection" summary

**AI Analysis Required**:
- Aggregate claim strength analysis
- Opportunity trend identification
- Personalized growth suggestions

### 3. Quarterly Career Review (Default: Enabled)
**Purpose**: Strategic career development insights

**Content**:
- 90-day progress visualization
- Career trajectory insights
- Industry/role trends from tracked opportunities
- Comprehensive skill gap analysis
- Long-term career suggestions
- Comparison to previous quarter

**AI Analysis Required**:
- Deep career pattern analysis
- Market trend correlation
- Strategic career advice generation

### 4. Annual Career Summary (Default: Enabled)
**Purpose**: Year-in-review and goal setting

**Content**:
- Full year statistics and milestones
- "Year in Review" narrative
- Career growth visualization
- Top achievements of the year
- Goals and focus areas for next year
- AI-generated career trajectory narrative

**AI Analysis Required**:
- Comprehensive year analysis
- Career narrative synthesis
- Goal recommendation generation

---

## Technical Architecture

### System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Inngest       │     │   Batch         │     │   Email         │
│   Scheduler     │────▶│   Processor     │────▶│   Delivery      │
│   (Cron)        │     │   (AI Batch)    │     │   (Resend)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ email_prefs │  │email_batches│  │ email_log   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Inngest Scheduled Functions

```typescript
// apps/web/src/inngest/functions/scheduled-emails.ts

// Weekly digest - runs every Monday at 8am
export const weeklyDigestScheduler = inngest.createFunction(
  { id: "weekly-digest-scheduler", concurrency: 1 },
  { cron: "0 8 * * 1" }, // Monday 8am UTC
  async ({ step }) => {
    // 1. Get all users with weekly digest enabled
    // 2. Queue AI batch requests for insights
    // 3. Wait for batch completion
    // 4. Send emails via Resend
  }
);

// Monthly report - runs 1st of month at 9am
export const monthlyReportScheduler = inngest.createFunction(
  { id: "monthly-report-scheduler", concurrency: 1 },
  { cron: "0 9 1 * *" }, // 1st of month, 9am UTC
  async ({ step }) => { /* similar flow */ }
);

// Quarterly review - runs Jan 1, Apr 1, Jul 1, Oct 1
export const quarterlyReviewScheduler = inngest.createFunction(
  { id: "quarterly-review-scheduler", concurrency: 1 },
  { cron: "0 10 1 1,4,7,10 *" },
  async ({ step }) => { /* similar flow */ }
);

// Annual summary - runs Jan 1st
export const annualSummaryScheduler = inngest.createFunction(
  { id: "annual-summary-scheduler", concurrency: 1 },
  { cron: "0 11 1 1 *" }, // Jan 1st, 11am UTC
  async ({ step }) => { /* similar flow */ }
);
```

### AI Batch Processing Strategy

Both OpenAI and Anthropic offer 50% cost savings via their Batch APIs:

| Provider | Batch API | Discount | Max Batch Size | Turnaround |
|----------|-----------|----------|----------------|------------|
| OpenAI | `/v1/batches` | 50% | Unlimited | 24 hours |
| Anthropic | Message Batches | 50% | 10,000 requests | 24 hours (often <1hr) |

**Recommended Approach**: Use Anthropic Message Batches API for insight generation

1. **Collect users** eligible for each email type
2. **Build batch requests** with user context (claims, evidence, opportunities)
3. **Submit batch** to Anthropic Message Batches API
4. **Poll for completion** (typically completes in <1 hour)
5. **Process results** and send emails

```typescript
// apps/web/src/lib/ai/batch.ts

import Anthropic from "@anthropic-ai/sdk";

export async function createInsightsBatch(
  users: UserContext[],
  insightType: "weekly" | "monthly" | "quarterly" | "annual"
) {
  const client = new Anthropic();

  // Build batch requests
  const requests = users.map((user) => ({
    custom_id: `${user.id}-${insightType}`,
    params: {
      model: "claude-haiku-4-5-20251001", // Use Haiku for cost efficiency
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: buildInsightPrompt(user, insightType),
        },
      ],
    },
  }));

  // Submit batch
  const batch = await client.messages.batches.create({
    requests,
  });

  return batch.id;
}

export async function pollBatchCompletion(batchId: string) {
  const client = new Anthropic();

  while (true) {
    const batch = await client.messages.batches.retrieve(batchId);

    if (batch.processing_status === "ended") {
      // Fetch results
      const results = [];
      for await (const result of client.messages.batches.results(batchId)) {
        results.push(result);
      }
      return results;
    }

    // Poll every 30 seconds
    await new Promise((r) => setTimeout(r, 30000));
  }
}
```

### Cost Analysis

Using Anthropic Claude Haiku 4.5 with Batch API (50% discount):

| Email Type | Users | Tokens/User | Cost/User | 1K Users | 10K Users |
|------------|-------|-------------|-----------|----------|-----------|
| Weekly | Active | ~2K in, ~500 out | $0.0013 | $1.30 | $13.00 |
| Monthly | All | ~5K in, ~1K out | $0.0050 | $5.00 | $50.00 |
| Quarterly | All | ~10K in, ~2K out | $0.0100 | $10.00 | $100.00 |
| Annual | All | ~15K in, ~3K out | $0.0165 | $16.50 | $165.00 |

**Monthly cost estimate (10K users)**:
- Weekly: 4 × $13 = $52
- Monthly: $50
- Quarterly: $33 (avg)
- Annual: $14 (avg)
- **Total: ~$150/month** for 10K users

**With prompt caching** (additional 90% discount on cached portion):
- Cache system prompt + user schema
- Estimated additional 30-40% savings
- **Total: ~$90-100/month** for 10K users

---

## Database Schema

### New Tables

```sql
-- Migration: YYYYMMDD000000_email_preferences.sql

-- User email preferences
CREATE TABLE email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cadence preferences (all default to true)
  weekly_digest BOOLEAN NOT NULL DEFAULT true,
  monthly_report BOOLEAN NOT NULL DEFAULT true,
  quarterly_review BOOLEAN NOT NULL DEFAULT true,
  annual_summary BOOLEAN NOT NULL DEFAULT true,

  -- Timezone for scheduling
  timezone TEXT NOT NULL DEFAULT 'UTC',

  -- Preferred send time (hour of day, 0-23)
  preferred_hour INTEGER NOT NULL DEFAULT 9,

  -- Global unsubscribe
  unsubscribed BOOLEAN NOT NULL DEFAULT false,
  unsubscribed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

-- RLS policies
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON email_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON email_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create preferences for new users
CREATE OR REPLACE FUNCTION create_email_preferences_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.email_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_email_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_email_preferences_for_user();

-- Backfill existing users
INSERT INTO email_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
```

```sql
-- Migration: YYYYMMDD000001_email_batches.sql

-- Track AI batch processing for emails
CREATE TABLE email_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch metadata
  batch_type TEXT NOT NULL, -- 'weekly', 'monthly', 'quarterly', 'annual'
  period_start DATE NOT NULL, -- Start of reporting period
  period_end DATE NOT NULL,   -- End of reporting period

  -- AI provider batch tracking
  provider TEXT NOT NULL DEFAULT 'anthropic',
  provider_batch_id TEXT, -- External batch ID from Anthropic/OpenAI

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'collecting' | 'processing' | 'sending' | 'completed' | 'failed'

  -- Counts
  total_users INTEGER NOT NULL DEFAULT 0,
  processed_users INTEGER NOT NULL DEFAULT 0,
  sent_users INTEGER NOT NULL DEFAULT 0,
  failed_users INTEGER NOT NULL DEFAULT 0,

  -- Cost tracking
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_cents INTEGER,

  -- Timestamps
  started_at TIMESTAMPTZ,
  ai_submitted_at TIMESTAMPTZ,
  ai_completed_at TIMESTAMPTZ,
  emails_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for finding in-progress batches
CREATE INDEX idx_email_batches_status ON email_batches(status);
CREATE INDEX idx_email_batches_type_period ON email_batches(batch_type, period_start);
```

```sql
-- Migration: YYYYMMDD000002_email_log.sql

-- Individual email send log
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES email_batches(id) ON DELETE SET NULL,

  -- Email details
  email_type TEXT NOT NULL, -- 'weekly', 'monthly', 'quarterly', 'annual'
  email_address TEXT NOT NULL,
  subject TEXT NOT NULL,

  -- AI-generated content (stored for debugging/replay)
  ai_insights JSONB, -- The raw AI response

  -- Delivery tracking
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT, -- Resend message ID
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed'

  -- Engagement tracking (via webhooks)
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,

  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_log_user_id ON email_log(user_id);
CREATE INDEX idx_email_log_batch_id ON email_log(batch_id);
CREATE INDEX idx_email_log_status ON email_log(status);
CREATE INDEX idx_email_log_user_type_date
  ON email_log(user_id, email_type, created_at DESC);

-- RLS (users can see their own email history)
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email log"
  ON email_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access to email_log"
  ON email_log FOR ALL
  USING (auth.role() = 'service_role');
```

---

## Email Delivery

### Provider: Resend

Resend is the recommended email provider for modern applications:

- Simple API, React Email support
- Excellent deliverability
- Webhook support for tracking
- Generous free tier (3,000 emails/month)
- $20/month for 50,000 emails

```typescript
// apps/web/src/lib/email/resend.ts

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInsightEmail(
  to: string,
  subject: string,
  content: EmailContent
) {
  const { data, error } = await resend.emails.send({
    from: "Idynic <insights@idynic.com>",
    to,
    subject,
    react: InsightEmailTemplate({ content }),
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data.id;
}
```

### Email Templates

Using React Email for type-safe, component-based templates:

```tsx
// apps/web/src/emails/weekly-digest.tsx

import {
  Html, Head, Body, Container, Section,
  Heading, Text, Button, Hr, Img
} from "@react-email/components";

interface WeeklyDigestProps {
  userName: string;
  insights: {
    newOpportunities: number;
    profileImprovements: string[];
    suggestedActions: Array<{
      title: string;
      description: string;
      ctaText: string;
      ctaUrl: string;
    }>;
    aiSummary: string;
  };
}

export function WeeklyDigest({ userName, insights }: WeeklyDigestProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://idynic.com/logo.png"
            width={120}
            height={40}
            alt="Idynic"
          />

          <Heading style={h1}>Your Weekly Insights</Heading>
          <Text style={text}>Hi {userName},</Text>
          <Text style={text}>{insights.aiSummary}</Text>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>This Week's Highlights</Heading>
            <Text style={text}>
              📋 {insights.newOpportunities} new opportunities tracked
            </Text>
            {insights.profileImprovements.map((improvement, i) => (
              <Text key={i} style={text}>✅ {improvement}</Text>
            ))}
          </Section>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>Suggested Actions</Heading>
            {insights.suggestedActions.map((action, i) => (
              <Section key={i} style={actionCard}>
                <Text style={actionTitle}>{action.title}</Text>
                <Text style={actionDescription}>{action.description}</Text>
                <Button style={button} href={action.ctaUrl}>
                  {action.ctaText}
                </Button>
              </Section>
            ))}
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You received this email because you subscribed to weekly insights.
            <a href="https://app.idynic.com/settings/emails">
              Manage preferences
            </a> or <a href="{{unsubscribeUrl}}">unsubscribe</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Add Resend dependency and configure
- [ ] Create email preference migration
- [ ] Create email_batches and email_log migrations
- [ ] Build email preferences UI in settings
- [ ] Create base email template components

### Phase 2: AI Batch Integration (Week 2)
- [ ] Implement Anthropic Message Batches wrapper
- [ ] Create insight prompt templates for each email type
- [ ] Build batch polling and result processing
- [ ] Add cost tracking to email_batches table
- [ ] Test batch processing with small user sets

### Phase 3: Weekly Digest (Week 3)
- [ ] Implement weekly digest Inngest function
- [ ] Create weekly digest email template
- [ ] Build user context aggregation (claims, evidence, opportunities)
- [ ] Add email sending via Resend
- [ ] Test end-to-end flow

### Phase 4: Monthly & Quarterly Reports (Week 4)
- [ ] Implement monthly report Inngest function
- [ ] Implement quarterly review Inngest function
- [ ] Create email templates for each
- [ ] Add period-over-period comparison logic

### Phase 5: Annual Summary (Week 5)
- [ ] Implement annual summary Inngest function
- [ ] Create comprehensive year-in-review template
- [ ] Build year-long analytics aggregation

### Phase 6: Polish & Monitoring (Week 6)
- [ ] Add Resend webhooks for delivery tracking
- [ ] Create admin dashboard for email analytics
- [ ] Add Axiom logging for email pipeline
- [ ] Add Sentry error tracking
- [ ] Performance optimization and testing

---

## API Endpoints

### Email Preferences

```typescript
// GET /api/v1/settings/email-preferences
// Returns current user's email preferences

// PATCH /api/v1/settings/email-preferences
// Updates email preferences
{
  "weekly_digest": true,
  "monthly_report": true,
  "quarterly_review": false,
  "annual_summary": true,
  "timezone": "America/Los_Angeles",
  "preferred_hour": 9
}

// POST /api/v1/settings/email-preferences/unsubscribe
// Global unsubscribe (requires token in URL)
```

### Email History (User)

```typescript
// GET /api/v1/emails
// Returns paginated list of emails sent to user
{
  "emails": [
    {
      "id": "uuid",
      "type": "weekly",
      "subject": "Your Weekly Insights - Jan 2, 2026",
      "sent_at": "2026-01-02T09:00:00Z",
      "status": "delivered",
      "opened_at": "2026-01-02T10:15:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Admin Endpoints

```typescript
// GET /api/admin/email-batches
// List all email batches with stats

// POST /api/admin/email-batches/:id/retry
// Retry failed batch

// GET /api/admin/email-stats
// Aggregate email statistics
```

---

## Monitoring & Observability

### Axiom Logging

```typescript
// Log structure for email pipeline
{
  "level": "info",
  "message": "Email batch processing",
  "batch_id": "uuid",
  "batch_type": "weekly",
  "total_users": 1500,
  "phase": "ai_processing" | "sending" | "completed",
  "duration_ms": 45000,
  "cost_cents": 195
}
```

### Key Metrics to Track

1. **Batch Processing**
   - Batch completion time
   - AI processing latency
   - Cost per batch
   - Failure rate

2. **Email Delivery**
   - Delivery rate
   - Bounce rate
   - Open rate
   - Click rate
   - Unsubscribe rate

3. **User Engagement**
   - Users with emails enabled/disabled
   - Email preference changes
   - Actions taken from emails

### Alerting

- Alert if batch fails completely
- Alert if delivery rate drops below 95%
- Alert if unsubscribe rate spikes
- Alert if AI costs exceed budget

---

## User Experience

### Settings Page

Add "Email Preferences" section to settings:

```
┌─────────────────────────────────────────────────────┐
│ Email Preferences                                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ☑ Weekly Digest                                     │
│   Get a summary of your activity every Monday       │
│                                                      │
│ ☑ Monthly Insights Report                           │
│   Comprehensive progress review on the 1st          │
│                                                      │
│ ☐ Quarterly Career Review                           │
│   Strategic insights every quarter                   │
│                                                      │
│ ☑ Annual Career Summary                             │
│   Year-in-review on January 1st                     │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Timezone: America/Los_Angeles ▼                     │
│ Preferred time: 9:00 AM ▼                           │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ [Unsubscribe from all emails]                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Email Preview

Allow users to preview what their next email would look like:

```
[Preview Weekly Digest] → Shows sample email with current data
```

---

## Security Considerations

1. **Unsubscribe Links**: Use signed tokens to prevent abuse
2. **Email Verification**: Only send to verified email addresses
3. **Rate Limiting**: Prevent duplicate sends via idempotency
4. **Data Privacy**: Don't include sensitive data in emails (link to app instead)
5. **GDPR Compliance**: Honor unsubscribe requests immediately

---

## Future Enhancements

1. **AI Personalization**: Learn user preferences from engagement
2. **Smart Timing**: ML-based optimal send time prediction
3. **Digest Customization**: Let users choose what sections to include
4. **Slack/Teams Integration**: Alternative delivery channels
5. **Push Notifications**: Complement emails with mobile push
6. **Interactive Emails**: AMP email support for inline actions

---

## Open Questions

1. **Timezone handling**: Should we batch by timezone or use user's local time?
   - *Recommendation*: Group users into timezone buckets, run separate batches

2. **Inactive users**: Should we email users who haven't logged in recently?
   - *Recommendation*: Skip users inactive >90 days, or send re-engagement email

3. **New user grace period**: When should new users start receiving emails?
   - *Recommendation*: Wait 7 days after signup before first email

4. **A/B testing**: Should we build in A/B testing for email content?
   - *Recommendation*: Yes, important for optimizing engagement

5. **Email reply handling**: Should users be able to reply to emails?
   - *Recommendation*: Use no-reply, direct to support for questions

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Open rate | >30% | Resend webhooks |
| Click rate | >10% | Resend webhooks |
| Unsubscribe rate | <0.5% | Per email type |
| Delivery rate | >98% | Resend dashboard |
| User retention lift | +15% | 30-day cohort analysis |
| Feature adoption from email | 20% | Track CTA clicks → actions |

---

## Dependencies

### New Dependencies to Add

```json
{
  "resend": "^4.0.0",
  "@react-email/components": "^0.0.22",
  "react-email": "^2.1.0"
}
```

### Environment Variables

```bash
# Email
RESEND_API_KEY=re_xxxxx

# Optional: Custom domain for emails
RESEND_FROM_EMAIL=insights@idynic.com
RESEND_REPLY_TO=support@idynic.com
```

---

## References

- [Resend Documentation](https://resend.com/docs)
- [React Email](https://react.email)
- [Anthropic Message Batches API](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch)
- [Inngest Scheduled Functions](https://www.inngest.com/docs/guides/scheduled-functions)
