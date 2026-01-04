# Content Strategy Overhaul: "From Magic to Modules"

**Date:** 2026-01-03
**Status:** Not Started
**Goal:** Clarify the "Magic Step" (Resume -> Graph -> Profile), remove unnecessary "scary" tech jargon without losing the unique "Infrastructure" value proposition, and establish a safe, clear visual metaphor.

## Progress (Last reviewed: 2026-01-04)

| Section | Status | Notes |
|---------|--------|-------|
| Core Terminology Shift | ⏳ Not Started | Waiting for strategy selection |
| Visual Metaphor Design | ⏳ Not Started | "Data Blocks" concept defined |
| Strategy Selection | ⏳ Not Started | A (Modular) recommended |
| Home Page Rewrite | ⏳ Not Started | Depends on strategy choice |
| Trust & Methodology Page | ⏳ Not Started | New page required |
| Blog Setup | ⏳ Not Started | `/blog` route |

### Drift Notes
This is a content/copy strategy plan. No implementation has started. Awaiting decision on Strategy A vs B.

---

## 1. Core Terminology Shift
We are moving away from abstract/legal terms to "Construction/Asset" terms.

| Old Term | New Term (Strategy A - Modular) | New Term (Strategy B - Story) | Why? |
| :--- | :--- | :--- | :--- |
| **Resume/Upload** | **Source Material** | **Career History** | "Resume" limits thinking. You want *all* inputs. |
| **Claims** | **Evidence Blocks** | **Proof Points** | "Claims" sounds like insurance. "Blocks" implies reusability. |
| **Graph** | **Master Record** | **Vault** | "Graph" is math. "Record" is an asset. |
| **Tailoring** | **Assembly / Snapshot** | **Tailored Story** | "Tailoring" is good, but "Assembly" explains *how* it works. |
| **Infrastructure** | **Career OS / System** | **Foundation** | Keep "Infrastructure" as the philosophy, but "System" as the tool. |

---

## 2. The Visual Metaphor: "Data Blocks" (Not Legos)
**Concept:** "Deconstruct -> Organize -> Reconstruct"
**Visual Style:** Isometric, high-tech, glowing edges, glass/matte finish. NOT plastic toy colors.

*   **Step 1 (Extract):** A document (PDF) dissolving into floating glowing cubes.
*   **Step 2 (Organize):** The cubes snapping into a structured grid (The "Wall" or "Vault"). Some cubes are bright (High Confidence), some dim (Low Confidence).
*   **Step 3 (Assemble):** A cursor selects a "Job Target" (e.g., "Senior PM"), and specific cubes fly out of the wall to form a new, smaller shape (The Profile).

---

## 3. Strategy A: "The Modular Career" (Recommended)
*Target: Engineers, PMs, Designers, Tech-Forward Professionals.*
*Tone: Efficient, Powerful, Systematic.*

### Home Page Flow
*   **Hero:** "Your career is your most valuable asset. Stop managing it like a document."
    *   *Sub:* "Extract your history into reusable Evidence Blocks. Build your Master Record once, then assemble tailored profiles for any opportunity in seconds."
*   **How it Works 1 (Extract):** "Deconstruct your documents."
    *   *Copy:* "Don't just upload files. Idynic breaks them down into atomic facts—skills, metrics, and wins."
*   **How it Works 2 (Verify):** "Build your Evidence Bank."
    *   *Copy:* "Every block is linked to its source. See exactly what you can prove. Confidence scores separate hard facts from fuzzy memories."
*   **How it Works 3 (Deploy):** "Assemble instant applications."
    *   *Copy:* "Paste a job description. We pick the exact blocks that match the role and stack them into a persuasive, evidence-backed profile."

### Why this works:
It keeps the "Infrastructure" hook but explains the mechanics. It makes the "Graph" feel like a feature (reusability) rather than a burden.

---

## 4. Strategy B: "The Verified Story" (Broad Appeal)
*Target: General Professionals, Execs, Sales, Marketing.*
*Tone: Trustworthy, Premium, Human.*

### Home Page Flow
*   **Hero:** "Own your professional story. Prove it with evidence."
    *   *Sub:* "Move beyond the static resume. Idynic unifies your career history into a living, verified portfolio that adapts to who you're talking to."
*   **How it Works 1:** "Bring it all together."
    *   *Copy:* "Resumes, reviews, portfolios. We synthesize your scattered history into one coherent timeline."
*   **How it Works 2:** "Verify your wins."
    *   *Copy:* "Confidence comes from proof. We link every achievement to the documents that back it up, so you always have the receipts."
*   **How it Works 3:** "Tell the right story."
    *   *Copy:* "Don't overwhelm recruiters. Give them exactly what they asked for—a tailored view of your experience that highlights why you're the perfect fit."

---

## 5. The "Missing Pieces" Execution Plan

Regardless of the strategy chosen, these are immediate gaps to fill.

### A. The "Trust & Methodology" Section (New Page/Section)
*   **Why:** Users are uploading private career data. "AI" makes them nervous.
*   **Content:**
    *   "Private by Default": You own the data.
    *   "No Training on Your Data": (If true/planned).
    *   "The Confidence Score": Explain *how* we verify. "We don't just believe you; we check the docs."

### B. "Career Engineering" Blog (New `/blog` Route)
*   **Why:** SEO and Thought Leadership. "Infrastructure" needs a manual.
*   **Seed Articles:**
    *   *The Death of the Generic Resume*
    *   *Why Your Performance Review is Gold for Your Next Job*
    *   *Managing Your Career like a Product Backlog*

### C. Social Proof (Placeholder Strategy)
*   Since we have no users yet, use **"Use Case Scenarios"** instead of logos.
    *   "Built for the **Engineering Leader** tracking 5 years of projects."
    *   "Built for the **Product Manager** with scattered specs and launches."
    *   "Built for the **Consultant** constantly pitching new clients."

---

## 6. Next Steps
1.  **Select Strategy:** (I recommend Strategy A for your current "Infrastructure" brand).
2.  **Rewrite `page.tsx`:** Apply the "Modular/Block" language to the "How it Works" section.
3.  **Update Navigation:** Add "Resources" (leading to Blog/Docs) and "Trust".
4.  **Commission/Gen Assets:** Create the 3 "Block" visualizations described in Section 2.
