"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { RatingInput } from "@/components/rating-input"
import { SmartLinkInput } from "@/components/smart-link-input"
import { SmartLinksList } from "@/components/smart-links-list"
import { SpinnerGap, Check } from "@phosphor-icons/react"
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
      <Card>
        <CardContent className="py-8 flex justify-center">
          <SpinnerGap className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Notes</CardTitle>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {saving && (
              <>
                <SpinnerGap className="h-3 w-3 animate-spin" />
                Saving...
              </>
            )}
            {saved && !saving && (
              <>
                <Check className="h-3 w-3 text-green-500" />
                Saved
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ratings */}
        <div>
          <h4 className="text-sm font-medium mb-3">Ratings</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>

        {/* Links */}
        <div>
          <h4 className="text-sm font-medium mb-3">Links</h4>
          <div className="space-y-3">
            <SmartLinksList links={data.links || []} onRemove={handleRemoveLink} />
            <SmartLinkInput onAdd={handleAddLink} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <h4 className="text-sm font-medium mb-2">Notes</h4>
          <Textarea
            value={data.notes || ""}
            onChange={(e) => updateWithDebounce({ notes: e.target.value || null })}
            placeholder="Add your thoughts about this opportunity..."
            className="min-h-[120px] resize-y"
          />
        </div>
      </CardContent>
    </Card>
  )
}
