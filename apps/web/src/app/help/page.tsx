"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Rocket,
  User,
  Briefcase,
  IdCard,
  ShieldCheck,
  Plug,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { HELP_DOCS } from "@idynic/shared";

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  user: User,
  briefcase: Briefcase,
  "id-card": IdCard,
  shield: ShieldCheck,
  plug: Plug,
};

/**
 * Renders text with **bold** markdown syntax as <strong> elements
 */
function RichText({ children }: { children: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function HelpPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["getting-started"])
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSections(next);
  };

  const toggleItem = (id: string) => {
    const next = new Set(expandedItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedItems(next);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{HELP_DOCS.title}</h1>
            <p className="text-muted-foreground">{HELP_DOCS.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4 mb-16">
        {HELP_DOCS.sections.map((section) => {
          const Icon = SECTION_ICONS[section.icon] || HelpCircle;
          const isExpanded = expandedSections.has(section.id);
          const isIntegrations = section.id === "integrations";

          return (
            <div key={section.id} className="border rounded-lg bg-card overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <Icon className="w-5 h-5 text-primary shrink-0" />
                <span className="font-semibold flex-1">{section.title}</span>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t">
                  {section.items.map((item, i) => {
                    const itemExpanded = expandedItems.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={i < section.items.length - 1 ? "border-b" : ""}
                      >
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="w-full flex items-center gap-3 p-4 pl-12 text-left hover:bg-muted/30 transition-colors"
                        >
                          <span className="flex-1">{item.title}</span>
                          {itemExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        {itemExpanded && (
                          <div className="px-12 pb-4 text-muted-foreground">
                            <RichText>{item.content}</RichText>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Docs link for integrations section */}
                  {isIntegrations && (
                    <div className="border-t px-12 py-4">
                      <Link
                        href="/docs"
                        className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                      >
                        View full documentation
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {HELP_DOCS.faq.map((item, i) => {
            const id = `faq-${i}`;
            const isExpanded = expandedItems.has(id);

            return (
              <div key={i} className="border rounded-lg bg-card overflow-hidden">
                <button
                  onClick={() => toggleItem(id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium flex-1">{item.question}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 text-muted-foreground">
                    <RichText>{item.answer}</RichText>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
