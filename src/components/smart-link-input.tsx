"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "@phosphor-icons/react"
import { detectUrlType, type UrlType } from "@/lib/utils/url-detection"

interface LinkData {
  url: string
  label: string | null
  type: UrlType
}

interface SmartLinkInputProps {
  onAdd: (link: LinkData) => void
}

export function SmartLinkInput({ onAdd }: SmartLinkInputProps) {
  const [url, setUrl] = useState("")
  const [label, setLabel] = useState("")
  const [detectedType, setDetectedType] = useState<UrlType>("link")

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setDetectedType(detectUrlType(value))
  }

  const handleAdd = () => {
    if (!url.trim()) return

    onAdd({
      url: url.trim(),
      label: label.trim() || null,
      type: detectedType
    })

    setUrl("")
    setLabel("")
    setDetectedType("link")
  }

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 space-y-1">
        <Input
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Paste a URL..."
          className="text-sm"
        />
        {url && detectedType !== "link" && (
          <span className="text-xs text-muted-foreground capitalize">
            Detected: {detectedType}
          </span>
        )}
      </div>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (optional)"
        className="w-32 text-sm"
      />
      <Button
        type="button"
        size="sm"
        onClick={handleAdd}
        disabled={!url.trim()}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    </div>
  )
}
