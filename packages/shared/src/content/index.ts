/**
 * Shared content and help text for web and mobile apps
 *
 * Text uses markdown-style **bold** for emphasis on key terms.
 * Render with a markdown parser or extract bold text manually.
 */

export const EMPTY_STATE = {
  title: "No identity claims yet",
  subtitle: "Build your professional identity to unlock powerful features",

  // What claims enable
  features: [
    {
      title: "Visualize your identity",
      description: "See your skills, achievements, and experience mapped as an interactive constellation",
    },
    {
      title: "Tailor job applications",
      description: "Generate personalized resumes and cover letters matched to specific opportunities",
    },
    {
      title: "Track confidence levels",
      description: "Understand which claims have strong evidence and where you can strengthen your profile",
    },
  ],

  // How to get started
  actions: {
    resume: {
      title: "Upload Resume",
      description: "We'll extract your skills, experience, and achievements automatically",
    },
    story: {
      title: "Add a Story",
      description: "Share a professional accomplishment in your own words",
    },
  },

  // Help text
  help: {
    whatAreClaims: {
      title: "What are claims?",
      content: "**Claims** are statements about your professional identity - skills you have, things you've achieved, credentials you've earned. Each claim is backed by **evidence** from your resume or stories.",
    },
    whyUpload: {
      title: "Why upload a resume?",
      content: "Your resume contains rich **evidence** of your experience. We extract **claims** and link them to specific evidence, building a verified picture of your professional identity.",
    },
    privacy: {
      title: "Is my data private?",
      content: "**Your data belongs to you.** We never share your information with employers or third parties without your explicit consent. See our **Privacy Policy** in Settings.",
    },
  },
} as const;

export type EmptyStateContent = typeof EMPTY_STATE;

/**
 * Full help documentation for the help page/screen
 */
export const HELP_DOCS = {
  // Page metadata
  title: "Help Center",
  subtitle: "Learn how to get the most out of Idynic",

  // Link to docs for integrations
  docsUrl: "https://idynic.com/docs",

  sections: [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: "rocket",
      items: [
        {
          id: "what-is-idynic",
          title: "What is Idynic?",
          content: "Idynic is your **smart career companion**. It helps you understand your **professional identity**, track opportunities, and **tailor your applications** to land the right job.",
        },
        {
          id: "first-steps",
          title: "First steps",
          content: "Start by **uploading your resume** or **adding a story** about a professional accomplishment. Idynic will extract **claims** about your skills, achievements, and experience, building your **identity graph**.",
        },
        {
          id: "claims-explained",
          title: "Understanding claims",
          content: "**Claims** are verified statements about your professional identity. Each claim has a **confidence level** based on supporting evidence. **Skills**, **achievements**, **certifications**, **education**, and **personal attributes** are all types of claims.",
        },
      ],
    },
    {
      id: "identity",
      title: "Your Identity",
      icon: "user",
      items: [
        {
          id: "building-identity",
          title: "Building your identity",
          content: "Your identity is built from **evidence** - resumes, stories, and manual entries. The more evidence you provide, the **stronger your claims** become. Upload multiple documents or add stories to strengthen your profile.",
        },
        {
          id: "confidence-scores",
          title: "Confidence scores",
          content: "Each claim has a **confidence score from 0-100%**. Higher scores mean more supporting evidence. Add more stories or documents that demonstrate a skill to **increase its confidence**.",
        },
        {
          id: "visualizations",
          title: "Identity visualizations",
          content: "View your identity in different ways: as a **list**, **treemap**, **radial graph**, **sunburst chart**, or **skill clusters**. Each visualization helps you understand different aspects of your professional profile.",
        },
        {
          id: "identity-reflection",
          title: "Identity reflection",
          content: "Your **identity reflection** is an AI-generated summary of who you are professionally. It synthesizes your claims into a **cohesive narrative** that captures your unique value proposition.",
        },
      ],
    },
    {
      id: "opportunities",
      title: "Opportunities",
      icon: "briefcase",
      items: [
        {
          id: "adding-opportunities",
          title: "Adding opportunities",
          content: "Add job opportunities in multiple ways: **paste a job posting URL** directly, use the **Chrome extension** while browsing job boards, share from other apps using the **iOS Share Sheet**, or enter details **manually**. Idynic will analyze the role and match it against your identity.",
        },
        {
          id: "match-scores",
          title: "Match scores",
          content: "Each opportunity shows a **match score** based on how well your claims align with the job requirements. **Higher scores** indicate better alignment with your experience and skills.",
        },
        {
          id: "tailoring",
          title: "Tailoring your profile",
          content: "Generate a **tailored profile** for any opportunity. Idynic selects the **most relevant claims** from your identity and presents them in a way that speaks directly to the job requirements.",
        },
        {
          id: "sharing",
          title: "Sharing with recruiters",
          content: "Create **shareable links** to send tailored profiles to recruiters. **You control** what information is shared and can **revoke access** at any time.",
        },
      ],
    },
    {
      id: "profile",
      title: "Your Profile",
      icon: "id-card",
      items: [
        {
          id: "work-history",
          title: "Work history",
          content: "Your **work history** shows your professional experience. You can add, edit, or remove positions. This information is used to **contextualize your claims**.",
        },
        {
          id: "education",
          title: "Education",
          content: "Track your **educational background** including degrees, certifications, and courses. Education entries can provide **evidence for claims**.",
        },
        {
          id: "skills",
          title: "Skills",
          content: "View and manage your **skills**. Skills are extracted from your documents and stories, or can be added manually. Each skill is a **claim backed by evidence**.",
        },
      ],
    },
    {
      id: "integrations",
      title: "Integrations & API",
      icon: "plug",
      items: [
        {
          id: "chrome-extension",
          title: "Chrome Extension",
          content: "Install the **Chrome extension** to save job opportunities with **one click** while browsing LinkedIn, Greenhouse, Lever, and other job boards. The extension automatically extracts job details and adds them to your opportunities.",
        },
        {
          id: "rest-api",
          title: "REST API",
          content: "Build custom integrations with the **Idynic REST API**. Access your **claims**, **opportunities**, and **tailored profiles** programmatically. Generate API keys in Settings to get started.",
        },
        {
          id: "mcp-server",
          title: "MCP Server",
          content: "Use Idynic directly from **Claude**, **Cursor**, or any **MCP-compatible client**. Manage your career with natural language - add opportunities, generate tailored profiles, and explore your identity through conversation.",
        },
      ],
    },
    {
      id: "privacy",
      title: "Privacy & Security",
      icon: "shield",
      items: [
        {
          id: "data-ownership",
          title: "Your data, your control",
          content: "**You own your data.** We never sell or share your information with third parties without your explicit consent. You can **export or delete** your data at any time. See our **Privacy Policy** for full details.",
        },
        {
          id: "sharing-control",
          title: "Controlling what you share",
          content: "When you create shareable links, **you control exactly what information is visible**. Recruiters only see what you choose to share, and you can **revoke access anytime**.",
        },
        {
          id: "data-security",
          title: "How we protect your data",
          content: "Your data is **encrypted in transit and at rest**. We use industry-standard security practices and regularly audit our systems to keep your information safe. Review our **Terms of Service** and **Privacy Policy** in Settings for complete information.",
        },
      ],
    },
  ],

  // FAQ for quick answers
  faq: [
    {
      question: "Do I need to upload a resume to use Idynic?",
      answer: "**No.** You can build your identity by adding stories, manually entering your work history, or any combination. A resume is just **one way** to provide evidence for your claims.",
    },
    {
      question: "How do I improve my match scores?",
      answer: "Add more **evidence** to strengthen your claims. Upload additional documents, add stories about relevant accomplishments, or fill in your work history with more detail.",
    },
    {
      question: "Can recruiters see all my information?",
      answer: "**No.** Recruiters only see what you **explicitly share** through shareable links. Your full identity and other opportunities are never visible to them.",
    },
    {
      question: "What happens to my resume after I upload it?",
      answer: "We extract **claims and evidence** from your resume, then store the document securely. You can **delete it anytime**, and the extracted claims will remain unless you remove them. See our **Privacy Policy** for details on data handling.",
    },
    {
      question: "How do I add opportunities from my phone?",
      answer: "Use the **Share Sheet** from your browser or any app to send job posting URLs directly to Idynic. Works on both **iOS and Android**.",
    },
    {
      question: "Is there a mobile app?",
      answer: "**Yes!** Idynic is available on **iOS and Android**. You can manage your identity, track opportunities, and review matches on the go.",
    },
  ],
} as const;

export type HelpDocs = typeof HELP_DOCS;

/**
 * Contextual help tooltips for specific UI elements
 * Keys match the component/feature they describe
 */
export const CONTEXTUAL_HELP = {
  // Identity page
  claimConfidence: {
    title: "Confidence Score",
    content: "Shows how much **evidence** supports this claim. Add more stories or documents to **increase confidence**.",
  },
  claimEvidence: {
    title: "Supporting Evidence",
    content: "Excerpts from your documents and stories that **support this claim**.",
  },
  identityReflection: {
    title: "Identity Reflection",
    content: "An **AI-generated summary** of your professional identity based on your claims.",
  },

  // Opportunities
  matchScore: {
    title: "Match Score",
    content: "How well your **skills and experience align** with this opportunity. Based on your identity claims.",
  },
  tailoredProfile: {
    title: "Tailored Profile",
    content: "A **customized view** of your experience highlighting what's **most relevant** for this specific role.",
  },
  opportunityNotes: {
    title: "Notes",
    content: "**Private notes** only visible to you. Track your thoughts, interview prep, or follow-up tasks.",
  },

  // Resume upload
  resumeProcessing: {
    title: "Processing Your Resume",
    content: "We're extracting **skills, achievements, and experience** from your document. This usually takes 30-60 seconds.",
  },

  // Stories
  storyPrompt: {
    title: "Adding a Story",
    content: "Describe a professional accomplishment in your own words. Include **what you did**, **how you did it**, and **what the outcome was**.",
  },

  // Profile
  workHistory: {
    title: "Work History",
    content: "Your **professional experience**. This helps contextualize your claims and improve opportunity matching.",
  },
  skillsList: {
    title: "Skills",
    content: "Skills extracted from your documents and stories. Each skill is **backed by evidence**.",
  },

  // Sharing
  shareableLink: {
    title: "Shareable Link",
    content: "A **private link** you can send to recruiters. They'll only see the tailored profile, **not your full identity**.",
  },
  linkExpiry: {
    title: "Link Expiry",
    content: "Links **expire after the set time** for security. You can create new links anytime.",
  },
} as const;

export type ContextualHelp = typeof CONTEXTUAL_HELP;
export type ContextualHelpKey = keyof typeof CONTEXTUAL_HELP;
