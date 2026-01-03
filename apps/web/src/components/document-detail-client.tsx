"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  BookOpen,
  ArrowLeft,
  Loader2,
  Trash2,
  Calendar,
  Sparkles,
  Award,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDocument, useDeleteDocument } from "@/lib/hooks/use-documents";
import type { DocumentEvidence } from "@/lib/hooks/use-documents";

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown date";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDocumentDisplayName(
  filename: string | null,
  type: string
): string {
  if (filename) {
    // Remove date suffix pattern like "(12/25/2024)"
    return filename.replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{4}\)\s*$/, "");
  }
  return type === "resume" ? "Resume" : "Story";
}

const EVIDENCE_TYPE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; icon: typeof Sparkles }
> = {
  skill_listed: {
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    text: "text-teal-400",
    icon: Sparkles,
  },
  accomplishment: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: Award,
  },
  trait_indicator: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    icon: Lightbulb,
  },
};

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  skill_listed: "Skill",
  accomplishment: "Accomplishment",
  trait_indicator: "Trait",
};

function EvidenceCard({ evidence }: { evidence: DocumentEvidence }) {
  const style = EVIDENCE_TYPE_STYLES[evidence.evidence_type] || {
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
    icon: Sparkles,
  };
  const Icon = style.icon;
  const typeLabel =
    EVIDENCE_TYPE_LABELS[evidence.evidence_type] || evidence.evidence_type;

  return (
    <div className={`p-4 rounded-lg border ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${style.text}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-xs ${style.text}`}>
              {typeLabel}
            </Badge>
            {evidence.evidence_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(evidence.evidence_date)}
              </span>
            )}
          </div>
          <p className="text-sm">{evidence.text}</p>
        </div>
      </div>
    </div>
  );
}

interface DocumentDetailClientProps {
  documentId: string;
}

export function DocumentDetailClient({ documentId }: DocumentDetailClientProps) {
  const router = useRouter();
  const { data: document, isLoading, error } = useDocument(documentId);
  const deleteDocumentMutation = useDeleteDocument();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    await deleteDocumentMutation.mutateAsync(documentId);
    router.push("/documents");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-4">
        <p className="text-destructive">
          Failed to load document. It may have been deleted.
        </p>
        <Button asChild variant="outline">
          <Link href="/documents">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Link>
        </Button>
      </div>
    );
  }

  const isStory = document.type === "story";
  const Icon = isStory ? BookOpen : FileText;
  const displayName = getDocumentDisplayName(document.filename, document.type);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/documents"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  isStory ? "bg-purple-500/10" : "bg-blue-500/10"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    isStory ? "text-purple-500" : "text-blue-500"
                  }`}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold">{displayName}</h1>
                <p className="text-sm text-muted-foreground">
                  {formatDate(document.created_at)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`ml-2 ${
                  isStory
                    ? "border-purple-500/50 text-purple-500"
                    : "border-blue-500/50 text-blue-500"
                }`}
              >
                {isStory ? "Story" : "Resume"}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8 max-w-5xl flex-1">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Document Content */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Content
            </h2>
            <div className="border rounded-lg p-4 bg-muted/20">
              {document.raw_text ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
                    {document.raw_text}
                  </pre>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  No text content available for this document.
                </p>
              )}
            </div>
          </div>

          {/* Evidence Section */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              What We Learned
              {document.evidence.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {document.evidence.length}
                </Badge>
              )}
            </h2>
            {document.evidence.length > 0 ? (
              <div className="space-y-3">
                {document.evidence.map((ev) => (
                  <EvidenceCard key={ev.id} evidence={ev} />
                ))}
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center bg-muted/20">
                <Sparkles className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  No evidence has been extracted from this document yet.
                </p>
                {document.status === "processing" && (
                  <p className="text-muted-foreground text-sm mt-2">
                    Processing is in progress...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{displayName}&quot;? This
              will also remove all evidence extracted from this document and may
              affect your identity claims. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
