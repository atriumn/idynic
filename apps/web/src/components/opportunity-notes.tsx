"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { RatingInput } from "@/components/rating-input"
import { SmartLinkInput } from "@/components/smart-link-input"
import { SmartLinksList } from "@/components/smart-links-list"
import { SpinnerGap, Check, Link as LinkIcon, NotePencil } from "@phosphor-icons/react"
import type { UrlType } from "@/lib/utils/url-detection"

interface LinkData {
  url: string
  label: string | null
  type: UrlType
}

interface NotesData {
  rating_tech_stack: number | null
  rating_company: number | null
  rating_industry: number | null
  rating_role_fit: number | null
  links: LinkData[]
  notes: string | null
}

interface OpportunityNotesProps {
  opportunityId: string
}

export function OpportunityNotes({ opportunityId }: OpportunityNotesProps) {
  const [data, setData] = useState<NotesData>({
    rating_tech_stack: null,
    rating_company: null,
    rating_industry: null,
    rating_role_fit: null,
    links: [],
    notes: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Fetch notes on mount
  useEffect(() => {
    async function fetchNotes() {
      try {
        const response = await fetch(`/api/opportunity-notes?opportunityId=${opportunityId}`)
        if (response.ok) {
          const notes = await response.json()
          setData(notes)
        }
      } catch (error) {
        console.error("Failed to fetch notes:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchNotes()
  }, [opportunityId])

  // Save function
  const saveNotes = useCallback(async (newData: NotesData) => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch("/api/opportunity-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          ...newData
        })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error("Failed to save notes:", error)
    } finally {
      setSaving(false)
    }
  }, [opportunityId])

  // Update and save immediately (for ratings and links)
  const updateAndSave = (updates: Partial<NotesData>) => {
    const newData = { ...data, ...updates }
    setData(newData)
    saveNotes(newData)
  }

  // Update with debounce (for notes text)
  const updateWithDebounce = (updates: Partial<NotesData>) => {
    const newData = { ...data, ...updates }
    setData(newData)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      saveNotes(newData)
    }, 500)
  }

  const handleAddLink = (link: LinkData) => {
    updateAndSave({ links: [...data.links, link] })
  }

  const handleRemoveLink = (index: number) => {
    updateAndSave({ links: data.links.filter((_, i) => i !== index) })
  }

  if (loading) {
    return (
      <div className="py-8 flex justify-center text-muted-foreground">
        <SpinnerGap className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Ratings Grid */}
      <div className="grid grid-cols-2 gap-2">
        <RatingInput
          label="Tech Stack"
          value={data.rating_tech_stack}
          onChange={(v) => updateAndSave({ rating_tech_stack: v })}
        />
        <RatingInput
          label="Company"
          value={data.rating_company}
          onChange={(v) => updateAndSave({ rating_company: v })}
        />
        <RatingInput
          label="Industry"
          value={data.rating_industry}
          onChange={(v) => updateAndSave({ rating_industry: v })}
        />
        <RatingInput
          label="Role Fit"
          value={data.rating_role_fit}
          onChange={(v) => updateAndSave({ rating_role_fit: v })}
        />
      </div>

      {/* Quick Links */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <LinkIcon className="h-3.5 w-3.5" />
          <span>Relevant Links</span>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 space-y-3 border border-muted/50">
          <SmartLinksList links={data.links || []} onRemove={handleRemoveLink} />
          <SmartLinkInput onAdd={handleAddLink} />
        </div>
      </div>

      {/* Freeform Notes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <NotePencil className="h-3.5 w-3.5" />
            <span>Scratchpad</span>
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 h-4">
            {saving && (
              <>
                <SpinnerGap className="h-3 w-3 animate-spin" />
                SAVING...
              </>
            )}
            {saved && !saving && (
              <>
                <Check className="h-3 w-3 text-green-500" />
                SAVED
              </>
            )}
          </div>
        </div>
        <Textarea
          value={data.notes || ""}
          onChange={(e) => updateWithDebounce({ notes: e.target.value || null })}
          placeholder="Jot down quick thoughts, recruiter names, or interview details..."
          className="min-h-[150px] resize-y bg-muted/30 border-muted/50 focus:bg-background focus:border-primary/50 transition-all text-sm leading-relaxed p-4 rounded-xl"
        />
      </div>
    </div>
  )
}
