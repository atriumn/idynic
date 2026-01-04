# Idynic: Onboarding & Marketing Copy Strategy

> **Created:** January 2025
> **Related Issue:** #61, #62
> **Status:** Strategic Proposal

---

## Executive Summary

This document outlines an unconventional, high-impact onboarding and marketing strategy for Idynic. Rather than competing with traditional resume builders on features, we position Idynic as **the career self-awareness tool**—the product that helps you *see yourself clearly* for the first time.

**Core insight:** People don't need another resume builder. They need a mirror that shows them who they've become professionally.

---

## Part 1: Onboarding Strategy

### 1.1 The "Aha Moment" Framework

**Goal:** Get users to the "aha moment" within 3 minutes of first interaction.

The aha moment for Idynic is: *"I didn't realize I could describe myself this way."*

This is not about features—it's about identity revelation.

---

### 1.2 Onboarding Flow: "The Reveal"

#### Stage 0: Pre-Entry Hook (Before Login)

**Concept:** Show users what they're missing *before* they sign up.

**Implementation: The Anonymous Mirror**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Drag & Drop Zone]                                        │
│                                                             │
│  "Drop any resume. We'll show you what you're not saying." │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📄 Upload anonymously. No account needed.          │   │
│  │                                                      │   │
│  │  We'll analyze it, then delete it. You keep         │   │
│  │  the insights.                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Already have an account? Sign in]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**What happens:**
1. User drops resume (no account needed)
2. 10-second processing animation (see Animation 1 below)
3. Show 3 "hidden claims" they didn't articulate
4. CTA: "Create an account to see all 23 claims we found"

**Why this works:**
- Zero friction to value
- Creates immediate curiosity gap
- Demonstrates the product, doesn't describe it

---

#### Stage 1: First-Time User Experience

**Flow: The Three Questions**

After account creation, don't show an empty dashboard. Instead:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Welcome to Idynic, [Name].                                 │
│                                                             │
│  Before we build your identity, answer three questions:     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. What do people usually come to you for?          │   │
│  │    ____________________________________________      │   │
│  │                                                      │   │
│  │ 2. What's something you're good at that doesn't     │   │
│  │    show up on your resume?                          │   │
│  │    ____________________________________________      │   │
│  │                                                      │   │
│  │ 3. What's a project you're proud of that most       │   │
│  │    people don't know about?                         │   │
│  │    ____________________________________________      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Continue →]                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Purpose:**
- Creates emotional investment before resume upload
- Generates seed data for claim synthesis
- Frames Idynic as reflective, not transactional

---

#### Stage 2: The Resume Upload Experience

**Instead of a loading spinner, show "The Synthesis":**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Finding who you are...                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  [ANIMATED VISUALIZATION]                           │   │
│  │                                                      │   │
│  │  Particles converging from scattered to structured  │   │
│  │  Each particle represents a skill/achievement       │   │
│  │  They orbit, connect, form constellation            │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ✓ Reading experience at Microsoft                         │
│  ✓ Connecting leadership patterns                          │
│  ✓ Finding your hidden strengths                           │
│  → Synthesizing your professional identity                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Animation 1: The Synthesis**
- Duration: 8-12 seconds (matches actual processing time)
- Visual: Scattered light particles (each representing a piece of evidence)
- Motion: Particles drift chaotically, then begin orbiting center
- Transformation: Lines connect particles, form constellation shape
- Reveal: Constellation morphs into identity graph preview
- Audio (optional): Subtle ambient tone that resolves into chord

**Implementation note:** Use Framer Motion or Lottie for web, Reanimated for mobile.

---

#### Stage 3: The Reveal Moment

**Critical UX:** The first view of their identity should feel like a revelation.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Full-screen takeover with subtle particle animation]      │
│                                                             │
│  "Here's who you are."                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  [Hero claim - largest text]                        │   │
│  │  "You're a systems thinker who builds scalable     │   │
│  │   teams and turns chaos into process."              │   │
│  │                                                      │   │
│  │  [Secondary claims fade in]                         │   │
│  │  • 8 years building developer platforms            │   │
│  │  • Led 3 zero-to-one products                      │   │
│  │  • Technical enough to code, strategic enough      │   │
│  │    to roadmap                                      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  "Surprised? You're not alone. 87% of users say we        │
│   articulated something they couldn't."                    │
│                                                             │
│  [Explore your identity →]                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The psychology:** People rarely hear themselves described accurately by an external source. When it happens, it creates powerful emotional resonance.

---

### 1.3 Progressive Onboarding Micro-Moments

**After the initial reveal, use contextual prompts instead of a tutorial:**

| Trigger | Prompt | Goal |
|---------|--------|------|
| User views claim | "This came from your resume. Add a story for more depth?" | Story input |
| 24 hours later | "What did you work on yesterday? Quick win counts." | Habit formation |
| User views low-confidence claim | "This claim is still thin. Add evidence?" | Data quality |
| User adds second document | "Nice! Each doc strengthens your claims. Here's how..." | Education |
| User creates first opportunity | "Now let's see you through this company's eyes." | Feature discovery |

---

### 1.4 The "Add Context" Nudge System

**Concept:** Instead of asking users to "add stories," create low-friction context capture.

**Micro-Story Capture UI:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Floating prompt, appears after 30 sec on identity page]   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💭 Quick thought?                                  │   │
│  │                                                      │   │
│  │  Tell us about a time you [reference specific claim] │   │
│  │                                                      │   │
│  │  "When I [____], I learned [____]"                  │   │
│  │                                                      │   │
│  │  [Skip] [Share]                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Sentence starters that work:**
- "The hardest part of [extracted project] was..."
- "What surprised me about [extracted role] was..."
- "I didn't expect to learn [skill] from..."
- "If I had to do [project] again, I'd..."

---

## Part 2: Marketing Copy Strategy

### 2.1 Brand Voice

**Idynic speaks like:** A sharp, insightful friend who works in tech but thinks like a philosopher. Direct, sometimes surprising, always human.

**Voice principles:**
- **Honest over hype:** "Your resume is lying by omission" not "Unlock your potential!"
- **Observational:** Point out things people feel but haven't articulated
- **Slightly provocative:** Challenge assumptions about self-presentation
- **Warm but not soft:** Confident, not corporate

**Examples:**

| Weak Copy | Strong Copy |
|-----------|-------------|
| "Build your professional brand" | "See what you've actually built" |
| "Stand out to employers" | "Stop underselling yourself" |
| "AI-powered resume optimization" | "We'll find the career story you forgot to tell" |
| "Create tailored applications" | "Same you, better framing" |

---

### 2.2 Hero Headlines (A/B Test Set)

**For homepage:**

```
A: "Your career as infrastructure."
   (Current - tests architectural metaphor)

B: "You're more interesting than your resume says."
   (Tests curiosity/validation)

C: "The professional identity you forgot to write down."
   (Tests loss aversion/FOMO)

D: "What if you could see yourself the way a great interviewer does?"
   (Tests perspective shift)

E: "Build your career story once. Use it everywhere."
   (Tests efficiency)

F: "Your resume is a packing list. This is the trip."
   (Tests metaphor)
```

**Recommended:** Test B or D first. They address emotional need, not feature.

---

### 2.3 Scenario-Based Marketing

**Concept:** Show the moment before the pain, the pain, and the resolution.

**Scenario 1: The Panic Update**

*Visual: Split screen animation*
- Left: Calendar showing "Performance review - Tomorrow"
- Right: User frantically scrolling old Slack messages

*Copy:*
```
9 PM. Self-review due tomorrow.
You're digging through Slack trying to remember Q2.

There's a better way.

[With Idynic: Pull your accomplishments in seconds.]
```

*Animation concept:*
- Screen 1: Chaos (tabs, scrolling, frustrated clicking)
- Transition: Dissolve to calm
- Screen 2: Single Idynic dashboard, relevant accomplishments highlighted

---

**Scenario 2: The Dream Job Drop**

*Visual: Phone notification animation*
- LinkedIn notification: "Dream Company is hiring..."
- Cut to: Dusty resume.pdf with 2022 date

*Copy:*
```
The job you've been waiting for just posted.
Application closes Friday.
Your resume? Still stuck in 2022.

Catch up in 10 minutes.

[With Idynic: Two roles worth of updates, already synthesized.]
```

---

**Scenario 3: The Imposter Moment**

*Visual: Interview waiting room, person checking LinkedIn on phone*
- Shows competitor profile with impressive claims
- Person looks at own profile, sighs

*Copy:*
```
They sound so impressive.
Are you even qualified?

(You are. You just can't articulate it yet.)

[With Idynic: We'll help you see what they'd see if they could read between the lines.]
```

---

### 2.4 Visual Identity Concepts

#### Concept 1: The Constellation

**Core visual metaphor:** Your career is a constellation—scattered stars that form a picture only when you see the connections.

**Visual system:**
- Primary visual: Particle/star field that connects into patterns
- Animation: Points of light drifting, then connecting with lines
- Color: Deep navy/black background, white/gold points, soft blue connection lines
- Typography: Clean sans-serif (Inter, Geist), high contrast

**Application:**
- Loading states: Particles coalescing
- Empty states: Scattered, unconnected particles
- Full identity: Complete constellation
- Claim hover: Lines illuminate to show connections

**Hero image concept:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Dark background with subtle gradient]                     │
│                                                             │
│         ★                                                  │
│              ★                    ★                        │
│    ★                   ★                                   │
│         ┌──────────────────────┐      ★                   │
│     ★   │  Your career,        │                          │
│         │  connected.          │   ★                      │
│         └──────────────────────┘                          │
│              ★            ★                               │
│                                ★                          │
│       ★                                    ★              │
│                                                             │
│  [Particles slowly drift, occasionally connecting]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

#### Concept 2: The Mirror/Reflection

**Core visual metaphor:** Idynic is a mirror that shows you more clearly than you see yourself.

**Visual system:**
- Primary visual: Reflective/glass surfaces, light refraction
- Animation: Gradual focus, blur-to-sharp transitions
- Color: Clean whites, soft grays, sharp accent color
- Typography: Elegant, refined

**Application:**
- Before/after split screens
- "Blurred" state for unclear claims
- Sharp/bright state for validated claims
- Gradual reveal animations

**Hero image concept:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Split screen effect]                                      │
│                                                             │
│  ┌──────────────────┬──────────────────┐                   │
│  │                  │                  │                   │
│  │   HOW YOU        │   HOW YOU        │                   │
│  │   SEE YOURSELF   │   ACTUALLY ARE   │                   │
│  │                  │                  │                   │
│  │   [Blurry text]  │   [Sharp text]   │                   │
│  │   "did some      │   "Architected   │                   │
│  │    marketing"    │    GTM strategy  │                   │
│  │                  │    that drove    │                   │
│  │                  │    40% growth"   │                   │
│  │                  │                  │                   │
│  └──────────────────┴──────────────────┘                   │
│                                                             │
│  [On scroll: blur side sharpens to match right]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

#### Concept 3: The Excavation

**Core visual metaphor:** Your achievements are buried treasure—layered under years of doing without documenting.

**Visual system:**
- Primary visual: Layers, strata, depth
- Animation: Reveal/uncover transitions, parallax depth
- Color: Warm neutrals (sand, clay) with gold accents for discoveries
- Typography: Grounded, substantial

**Application:**
- Progress as "digging deeper"
- Claims as "discoveries"
- Evidence as "artifacts"
- Confidence as "clarity" (surface = blurry, deep = sharp)

---

### 2.5 Animated Micro-Interactions

#### Animation: The Claim Reveal

```
Trigger: New claim extracted from document
Duration: 0.8 seconds

Frame 1 (0.0s): Empty space
Frame 2 (0.2s): Faint glow appears, pulsing
Frame 3 (0.4s): Claim text fades in from below, slightly overshoots
Frame 4 (0.6s): Text settles into position
Frame 5 (0.8s): Confidence indicator fades in to the right
```

#### Animation: Evidence Connection

```
Trigger: User hovers on claim to see evidence
Duration: 0.5 seconds

Frame 1 (0.0s): Claim highlighted
Frame 2 (0.15s): Line begins drawing from claim
Frame 3 (0.3s): Line reaches evidence node
Frame 4 (0.4s): Evidence node pulses/highlights
Frame 5 (0.5s): Evidence preview appears with subtle scale-up
```

#### Animation: Profile Tailoring

```
Trigger: User pastes job description
Duration: 2.5 seconds

Frame 1 (0.0s): Job description card appears
Frame 2 (0.5s): Text "analyzing..." with shimmer effect
Frame 3 (1.0s): User's claims begin lighting up (those that match)
Frame 4 (1.5s): Lines draw from job requirements to matching claims
Frame 5 (2.0s): Match percentage animates up from 0%
Frame 6 (2.5s): "Your tailored profile is ready" CTA appears
```

---

### 2.6 Social Proof & Trust Signals

**Concept: The Aha Gallery**

Instead of generic testimonials, show specific "aha moments":

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  What users say when they first see their identity:        │
│                                                             │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │ "Holy shit, I     │  │ "This is exactly  │              │
│  │  never would have │  │  what I meant to  │              │
│  │  described myself │  │  say in that      │              │
│  │  as a 'technical  │  │  interview last   │              │
│  │  product leader'  │  │  month."          │              │
│  │  but... yeah."    │  │                   │              │
│  │                   │  │  — Recruiter,     │              │
│  │  — PM at Stripe   │  │    Google         │              │
│  └───────────────────┘  └───────────────────┘              │
│                                                             │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │ "I've been        │  │ "Wait, I can      │              │
│  │  underselling     │  │  actually claim   │              │
│  │  myself for       │  │  all this?"       │              │
│  │  years. This      │  │                   │              │
│  │  made that        │  │  — Career changer │              │
│  │  obvious."        │  │    (teacher →     │              │
│  │                   │  │    tech)          │              │
│  │  — Engineering    │  │                   │              │
│  │    Director       │  └───────────────────┘              │
│  └───────────────────┘                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.7 Ad Creative Concepts

#### Meta/Instagram Stories

**Concept: The Before/After**

```
[9:16 vertical format, 15 seconds]

Scene 1 (0-3s):
- Text: "How you describe yourself:"
- Shows: Generic resume bullet points, blurry

Scene 2 (3-6s):
- Text: "What you actually did:"
- Shows: Idynic claim with evidence, sharp and highlighted

Scene 3 (6-10s):
- Transition: Split screen, blur on left sharpens
- Text: "Stop underselling yourself"

Scene 4 (10-15s):
- Full Idynic logo
- Text: "See who you've become"
- CTA: "Try free"
```

---

#### LinkedIn Sponsored Content

**Concept: The Career Changer Hook**

```
[1200x628 image or 15s video]

Image: Split screen
- Left: "5 years in marketing"
- Right: "Ready for product management"

Headline: "Your experience transfers. Prove it."

Body: "You know you're qualified. Now you can show it.
Idynic finds the skills you forgot to claim."

CTA: "Build your identity free"
```

---

#### Google Display

**Concept: Pain Point Headlines**

```
[300x250 animated banner]

Frame 1: "Resume still says 2022?"
Frame 2: "Catch up in 10 minutes."
Frame 3: [Idynic logo] "Build once, use everywhere"
```

---

### 2.8 Email Sequences

#### Welcome Sequence (5 emails)

**Email 1: Immediate (upon signup)**
```
Subject: You're in. Here's what we found.

Hey [Name],

You just uploaded your first document.
We extracted [X] claims about who you are professionally.

But here's the thing: we probably missed some.

Your resume only tells part of the story. The projects you're proud of,
the skills you've developed, the problems you've solved—most of that
never makes it onto paper.

Reply to this email with one thing you're proud of that we probably
don't know about yet. We'll help you claim it.

— The Idynic team

P.S. We read these. Seriously.
```

---

**Email 2: Day 3**
```
Subject: The hidden skill problem

Hey [Name],

Here's something we've noticed:

Most professionals have 3-5 skills they're genuinely great at that
they never mention in job applications.

Why? They don't feel "official" enough. No certificate. No formal title.
Just... doing it well for years.

But here's the thing: those hidden skills are often the most valuable.

Take 2 minutes: Look at your Idynic identity. What's missing?
What would your coworkers say you're great at that's not in there?

Add it. We'll help you articulate it.

[Add a story →]

— Idynic
```

---

**Email 3: Day 7**
```
Subject: Are you underselling yourself?

[Name],

Quick question: When's the last time you looked at your own
accomplishments and thought, "damn, I actually did that"?

If it's been a while, you're not alone. We're wired to minimize
our own achievements. Imposter syndrome is real.

But here's the thing: your identity is only as strong as the
evidence behind it. Every story you add makes your claims more credible.

Your identity currently has [X] claims with strong evidence and
[Y] that could use more support.

Want to fix that?

[Strengthen your claims →]

— Idynic
```

---

## Part 3: Experimental Marketing Ideas

### 3.1 The LinkedIn Experiment

**Concept:** Let users A/B test their professional identity in the real world.

**How it works:**
1. User creates Idynic profile
2. Idynic generates two versions of their LinkedIn summary
3. User picks one, we track profile views for 2 weeks
4. Share results: "Your new summary got 43% more profile views"

**Marketing angle:**
- Creates viral loop (people share their "before/after" stats)
- Proves value through measurable outcome
- Low friction (it's just a LinkedIn update)

---

### 3.2 The Anonymous Roast

**Concept:** Let people submit their resume for brutally honest (but constructive) AI feedback.

**Landing page:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  "What's your resume actually saying?"                      │
│                                                             │
│  Upload anonymously. Get honest feedback.                   │
│  No account. No spam. Just truth.                          │
│                                                             │
│  [Upload Resume]                                            │
│                                                             │
│  (We've roasted 12,847 resumes. Average rating: 4.2/10)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Feedback format:**
- What your resume says ✗
- What you probably meant ✓
- What's missing entirely ⚠

**CTA:** "Want to fix it? Create an Idynic account."

---

### 3.3 The Career Changer Calculator

**Concept:** Interactive tool that shows career changers how their experience translates.

**Example:**
```
Input: "5 years as high school teacher"
Target: "Product Manager"

Output:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Your teaching experience maps to:                          │
│                                                             │
│  ✓ Stakeholder management (students, parents, admin)       │
│  ✓ Curriculum design (product roadmapping)                 │
│  ✓ Data-driven instruction (analytics, iteration)          │
│  ✓ Cross-functional coordination (departments, resources)  │
│  ✓ User research (understanding learner needs)             │
│                                                             │
│  Transferable skill match: 73%                             │
│                                                             │
│  [Build your career change profile →]                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.4 "What Would You Say?" Interactive Demo

**Concept:** Interactive website experience that demonstrates the gap between how people describe themselves and how they could.

**Page flow:**
1. Ask user to describe their current role in one sentence
2. Ask 3 follow-up questions (what's hard, what you're proud of, etc.)
3. Show their original vs. synthesized description side-by-side
4. CTA: "Now imagine this for your whole career."

---

## Part 4: Implementation Priority

### Phase 1: High Impact, Lower Effort (Weeks 1-2)
1. ✅ Update hero copy to test B/D variants
2. ✅ Add "anonymous resume analysis" pre-signup flow
3. ✅ Implement "The Reveal" moment after first upload
4. ✅ Create 5-email welcome sequence

### Phase 2: Medium Effort, High Value (Weeks 3-4)
1. 🔲 Build synthesis animation (constellation concept)
2. 🔲 Create before/after social proof gallery
3. 🔲 Implement contextual story prompts
4. 🔲 Design and test LinkedIn/Meta ad creatives

### Phase 3: Experimental (Weeks 5-8)
1. 🔲 Build career changer calculator
2. 🔲 Create "resume roast" viral landing page
3. 🔲 Develop LinkedIn A/B testing feature
4. 🔲 Launch interactive demo experience

---

## Part 5: Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Time to first claim | Unknown | < 3 min | Analytics |
| Resume upload rate | Unknown | > 70% | Analytics |
| Story addition rate | Unknown | > 30% | Analytics |
| Day 7 retention | Unknown | > 40% | Analytics |
| "Aha moment" (claim viewed) | Unknown | > 90% | Analytics |
| Referral rate | Unknown | > 15% | Analytics |

---

## Appendix A: Copy Bank

### Headlines
- "Your career as infrastructure."
- "You're more interesting than your resume says."
- "The professional identity you forgot to write down."
- "See what you've actually built."
- "Stop underselling yourself."
- "Same you, better framing."
- "Your resume is a packing list. This is the trip."
- "What would the best interviewer see in you?"

### Subheads
- "Build once, use everywhere—job applications, performance reviews, LinkedIn posts, speaker bios."
- "From scattered docs to coherent identity."
- "We'll find the career story you forgot to tell."
- "Evidence-backed claims. Not just assertions."
- "Your career, finally connected."

### CTAs
- "Start building"
- "See your identity"
- "Upload your first resume"
- "Try free"
- "Reveal what you're missing"
- "Build your identity"

### Scenario pain points
- "9 PM. Self-review due tomorrow."
- "Dream job just dropped. Apply by Friday."
- "Raise conversation next week."
- "Conference bio needed by EOD."
- "LinkedIn post stuck in drafts."

### Scenario resolutions
- "Pull your accomplishments in seconds."
- "Generate a tailored profile in minutes."
- "Evidence ready. Confidence earned."
- "Current bio, tailored to the event."
- "Your story, already synthesized."

---

## Appendix B: Technical Implementation Notes

### Animation Libraries
- **Web:** Framer Motion (React), GSAP (complex sequences)
- **Mobile:** Reanimated 3 (React Native)
- **Illustrations:** Lottie for reusable animations

### A/B Testing
- Use PostHog or Amplitude for feature flags
- Test one major element at a time
- Run tests for minimum 2 weeks or 1000 visitors

### Performance Considerations
- Lazy load animations below fold
- Use CSS animations for simple transitions
- Preload critical path animations
- Skeleton states for loading

---

*This document is a living strategy. Update as we learn from user feedback and testing.*
