"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Copy, Check, Loader2, Link2Off, Clock } from "lucide-react";
import { toast } from "sonner";

interface ShareLinkModalProps {
  tailoredProfileId: string;
  existingLink?: {
    id: string;
    token: string;
    expiresAt: string;
    revokedAt: string | null;
    viewCount: number;
  } | null;
  onLinkCreated?: () => void;
  onLinkRevoked?: () => void;
}

export function ShareLinkModal({
  tailoredProfileId,
  existingLink,
  onLinkCreated,
  onLinkRevoked,
}: ShareLinkModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [link, setLink] = useState(existingLink);

  const shareUrl = link
    ? `${window.location.origin}/shared/${link.token}`
    : null;

  const isExpired = link && new Date(link.expiresAt) < new Date();
  const isRevoked = !!link?.revokedAt;
  const isActive = link && !isExpired && !isRevoked;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shared-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredProfileId,
          expiresInDays: expiresInDays === "0" ? 0 : parseInt(expiresInDays),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create link");
      }

      const data = await res.json();
      setLink({
        id: data.id,
        token: data.token,
        expiresAt: data.expiresAt,
        revokedAt: null,
        viewCount: 0,
      });
      toast.success("Share link created");
      onLinkCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!link) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shared-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });

      if (!res.ok) throw new Error("Failed to revoke");

      setLink({ ...link, revokedAt: new Date().toISOString() });
      toast.success("Link revoked");
      onLinkRevoked?.();
    } catch (err) {
      toast.error("Failed to revoke link");
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!link) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shared-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend",
          expiresInDays: expiresInDays === "0" ? 0 : parseInt(expiresInDays),
        }),
      });

      if (!res.ok) throw new Error("Failed to extend");

      const data = await res.json();
      setLink({ ...link, expiresAt: data.expiresAt, revokedAt: null });
      toast.success("Link extended");
    } catch (err) {
      toast.error("Failed to extend link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatExpiry = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Expired";
    if (diffDays === 0) return "Expires today";
    if (diffDays === 1) return "Expires tomorrow";
    if (diffDays > 365) return "No expiration";
    return `Expires in ${diffDays} days`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Profile</DialogTitle>
          <DialogDescription>
            {!link
              ? "Create a private link to share this tailored profile with recruiters."
              : isActive
              ? "Your share link is active. Anyone with this link can view your profile."
              : "This link is no longer active."}
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          // Create new link
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link expires in</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="0">No expiration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Generate Link
            </Button>
          </div>
        ) : isActive ? (
          // Active link
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Share link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl || ""} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatExpiry(link.expiresAt)}
              </div>
              <div>{link.viewCount} view{link.viewCount !== 1 ? "s" : ""}</div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRevoke}
                disabled={loading}
                className="flex-1"
              >
                <Link2Off className="h-4 w-4 mr-2" />
                Revoke
              </Button>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7d</SelectItem>
                  <SelectItem value="30">30d</SelectItem>
                  <SelectItem value="90">90d</SelectItem>
                  <SelectItem value="0">Never</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExtend} disabled={loading}>
                Extend
              </Button>
            </div>
          </div>
        ) : (
          // Expired or revoked
          <div className="space-y-4">
            <div className="text-center py-4 text-muted-foreground">
              {isRevoked ? "This link has been revoked." : "This link has expired."}
            </div>
            <div className="space-y-2">
              <Label>Create new link expiring in</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="0">No expiration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExtend} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Create New Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
