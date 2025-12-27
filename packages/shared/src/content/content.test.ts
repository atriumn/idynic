import { describe, it, expect } from 'vitest'
import { EMPTY_STATE, HELP_DOCS, CONTEXTUAL_HELP } from './index'

describe('EMPTY_STATE', () => {
  it('has required title and subtitle', () => {
    expect(EMPTY_STATE.title).toBeDefined()
    expect(EMPTY_STATE.subtitle).toBeDefined()
    expect(typeof EMPTY_STATE.title).toBe('string')
    expect(typeof EMPTY_STATE.subtitle).toBe('string')
  })

  it('has features array with required properties', () => {
    expect(Array.isArray(EMPTY_STATE.features)).toBe(true)
    expect(EMPTY_STATE.features.length).toBeGreaterThan(0)

    EMPTY_STATE.features.forEach((feature) => {
      expect(feature.title).toBeDefined()
      expect(feature.description).toBeDefined()
    })
  })

  it('has actions with resume and story', () => {
    expect(EMPTY_STATE.actions.resume).toBeDefined()
    expect(EMPTY_STATE.actions.resume.title).toBeDefined()
    expect(EMPTY_STATE.actions.resume.description).toBeDefined()

    expect(EMPTY_STATE.actions.story).toBeDefined()
    expect(EMPTY_STATE.actions.story.title).toBeDefined()
    expect(EMPTY_STATE.actions.story.description).toBeDefined()
  })

  it('has help items with title and content', () => {
    expect(EMPTY_STATE.help.whatAreClaims).toBeDefined()
    expect(EMPTY_STATE.help.whyUpload).toBeDefined()
    expect(EMPTY_STATE.help.privacy).toBeDefined()

    Object.values(EMPTY_STATE.help).forEach((item) => {
      expect(item.title).toBeDefined()
      expect(item.content).toBeDefined()
    })
  })
})

describe('HELP_DOCS', () => {
  it('has required metadata', () => {
    expect(HELP_DOCS.title).toBeDefined()
    expect(HELP_DOCS.subtitle).toBeDefined()
    expect(HELP_DOCS.docsUrl).toBeDefined()
    expect(HELP_DOCS.docsUrl).toMatch(/^https?:\/\//)
  })

  it('has sections with required structure', () => {
    expect(Array.isArray(HELP_DOCS.sections)).toBe(true)
    expect(HELP_DOCS.sections.length).toBeGreaterThan(0)

    HELP_DOCS.sections.forEach((section) => {
      expect(section.id).toBeDefined()
      expect(section.title).toBeDefined()
      expect(section.icon).toBeDefined()
      expect(Array.isArray(section.items)).toBe(true)

      section.items.forEach((item) => {
        expect(item.id).toBeDefined()
        expect(item.title).toBeDefined()
        expect(item.content).toBeDefined()
      })
    })
  })

  it('has unique section ids', () => {
    const ids = HELP_DOCS.sections.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('has unique item ids within each section', () => {
    HELP_DOCS.sections.forEach((section) => {
      const ids = section.items.map((i) => i.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  it('has FAQ with question and answer', () => {
    expect(Array.isArray(HELP_DOCS.faq)).toBe(true)
    expect(HELP_DOCS.faq.length).toBeGreaterThan(0)

    HELP_DOCS.faq.forEach((item) => {
      expect(item.question).toBeDefined()
      expect(item.answer).toBeDefined()
      expect(item.question.endsWith('?')).toBe(true)
    })
  })

  it('includes expected sections', () => {
    const sectionIds = HELP_DOCS.sections.map((s) => s.id)
    expect(sectionIds).toContain('getting-started')
    expect(sectionIds).toContain('identity')
    expect(sectionIds).toContain('opportunities')
    expect(sectionIds).toContain('privacy')
  })
})

describe('CONTEXTUAL_HELP', () => {
  it('has identity-related help items', () => {
    expect(CONTEXTUAL_HELP.claimConfidence).toBeDefined()
    expect(CONTEXTUAL_HELP.claimEvidence).toBeDefined()
    expect(CONTEXTUAL_HELP.identityReflection).toBeDefined()
  })

  it('has opportunity-related help items', () => {
    expect(CONTEXTUAL_HELP.matchScore).toBeDefined()
    expect(CONTEXTUAL_HELP.tailoredProfile).toBeDefined()
    expect(CONTEXTUAL_HELP.opportunityNotes).toBeDefined()
  })

  it('has all items with title and content', () => {
    Object.values(CONTEXTUAL_HELP).forEach((item) => {
      expect(item.title).toBeDefined()
      expect(item.content).toBeDefined()
      expect(typeof item.title).toBe('string')
      expect(typeof item.content).toBe('string')
    })
  })

  it('uses markdown bold syntax for emphasis', () => {
    // Check that at least some items use **bold** syntax
    const itemsWithBold = Object.values(CONTEXTUAL_HELP).filter((item) =>
      item.content.includes('**')
    )
    expect(itemsWithBold.length).toBeGreaterThan(0)
  })
})
