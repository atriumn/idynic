"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Link2Off,
  ExternalLink,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

interface SharedLink {
  id: string;
  token: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  tailoredProfileId: string;
  opportunityId: string;
  opportunityTitle: string;
  company: string | null;
  viewCount: number;
  views: string[];
}

interface SharedLinksTableProps {
  links: SharedLink[];
}

export function SharedLinksTable({ links }: SharedLinksTableProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const getStatus = (link: SharedLink) => {
    if (link.revokedAt) return "revoked";
    if (new Date(link.expiresAt) < new Date()) return "expired";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "expired":
        return <Badge className="bg-gray-100 text-gray-800">Expired</Badge>;
      case "revoked":
        return <Badge className="bg-red-100 text-red-800">Revoked</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleCopy = async (token: string, id: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (id: string) => {
    setLoading(id);
    try {
      const res = await fetch(`/api/shared-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Link revoked");
      router.refresh();
    } catch {
      toast.error("Failed to revoke link");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Opportunity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Views</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => {
            const status = getStatus(link);
            const isExpanded = expandedId === link.id;

            return (
              <Collapsible
                key={link.id}
                open={isExpanded}
                onOpenChange={(open) => setExpandedId(open ? link.id : null)}
                asChild
              >
                <>
                  <TableRow className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {link.opportunityTitle}
                        </div>
                        {link.company && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {link.company}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        {link.viewCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      {status === "active"
                        ? formatDate(link.expiresAt)
                        : status === "expired"
                          ? "Expired"
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status === "active" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(link.token, link.id);
                              }}
                            >
                              {copiedId === link.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevoke(link.id);
                              }}
                              disabled={loading === link.id}
                            >
                              <Link2Off className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/opportunities/${link.opportunityId}`;
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={6} className="py-4">
                        {link.views.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center">
                            No views yet
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-sm font-medium mb-2">
                              View history
                            </p>
                            {link.views.slice(0, 10).map((viewedAt, i) => (
                              <p
                                key={i}
                                className="text-sm text-muted-foreground"
                              >
                                Viewed {formatDateTime(viewedAt)}
                              </p>
                            ))}
                            {link.views.length > 10 && (
                              <p className="text-sm text-muted-foreground">
                                ... and {link.views.length - 10} more
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
