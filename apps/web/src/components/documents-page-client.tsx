"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, BookOpen, ArrowLeft, Loader2, Trash2 } from "lucide-react";
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
import { useDocuments, useDeleteDocument } from "@/lib/hooks/use-documents";
import { UploadResumeModal } from "@/components/upload-resume-modal";
import { AddStoryModal } from "@/components/add-story-modal";
import type { DocumentListItem } from "@/lib/hooks/use-documents";

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown date";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDocumentDisplayName(doc: DocumentListItem): string {
  if (doc.filename) {
    // Remove date suffix pattern like "(12/25/2024)"
    return doc.filename.replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{4}\)\s*$/, "");
  }
  return doc.type === "resume" ? "Resume" : "Story";
}

function DocumentRow({
  document,
  onDelete,
}: {
  document: DocumentListItem;
  onDelete: (doc: DocumentListItem) => void;
}) {
  const isStory = document.type === "story";
  const Icon = isStory ? BookOpen : FileText;
  const isProcessing = document.status === "processing";
  const isPending = document.status === "pending";
  const isFailed = document.status === "failed";

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors group">
      {/* Icon */}
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-lg ${
          isStory ? "bg-purple-500/10" : "bg-blue-500/10"
        }`}
      >
        <Icon
          className={`h-5 w-5 ${isStory ? "text-purple-500" : "text-blue-500"}`}
        />
      </div>

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/documents/${document.id}`}
          className="block hover:underline"
        >
          <p className="font-medium truncate">
            {getDocumentDisplayName(document)}
          </p>
        </Link>
        <p className="text-sm text-muted-foreground">
          {formatDate(document.created_at)}
        </p>
      </div>

      {/* Type Badge */}
      <Badge
        variant="outline"
        className={`shrink-0 ${
          isStory
            ? "border-purple-500/50 text-purple-500"
            : "border-blue-500/50 text-blue-500"
        }`}
      >
        {document.type === "resume" ? "Resume" : "Story"}
      </Badge>

      {/* Status Badge */}
      {(isProcessing || isPending) && (
        <Badge variant="secondary" className="shrink-0 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      )}
      {isFailed && (
        <Badge
          variant="destructive"
          className="shrink-0"
          title="Document processing failed"
        >
          Failed
        </Badge>
      )}

      {/* Evidence Count */}
      {document.evidence_count > 0 && (
        <div className="text-sm text-muted-foreground shrink-0">
          {document.evidence_count} evidence
        </div>
      )}

      {/* Actions */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.preventDefault();
          onDelete(document);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function DocumentsPageClient() {
  const { data: documents, isLoading, error } = useDocuments();
  const deleteDocumentMutation = useDeleteDocument();
  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentListItem | null>(null);

  const handleDelete = async () => {
    if (!documentToDelete) return;
    await deleteDocumentMutation.mutateAsync(documentToDelete.id);
    setDocumentToDelete(null);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/identity"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold">My Documents</h1>
              {documents && documents.length > 0 && (
                <Badge variant="secondary">{documents.length} documents</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <UploadResumeModal />
              <AddStoryModal />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8 max-w-5xl flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-destructive">
              Failed to load documents. Please try again.
            </p>
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 border rounded-lg border-dashed bg-muted/10">
            <FileText className="h-16 w-16 text-muted-foreground/50 mb-6" />
            <h2 className="text-xl font-semibold mb-2">No documents yet</h2>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Upload a resume or add a story to get started. We&apos;ll extract
              your skills, experience, and achievements.
            </p>
            <div className="flex gap-3">
              <UploadResumeModal />
              <AddStoryModal />
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {/* Column Headers */}
            <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 border-b border-border text-sm font-medium text-muted-foreground">
              <div className="w-10" /> {/* Icon spacer */}
              <div className="flex-1">Document</div>
              <div className="w-20 text-center">Type</div>
              <div className="w-24 text-right">Evidence</div>
              <div className="w-10" /> {/* Actions spacer */}
            </div>

            {/* Document Rows */}
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                onDelete={setDocumentToDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!documentToDelete}
        onOpenChange={(open) => !open && setDocumentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {documentToDelete && getDocumentDisplayName(documentToDelete)}
              &quot;? This will also remove all evidence extracted from this
              document and may affect your identity claims. This action cannot
              be undone.
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
