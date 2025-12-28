import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GITHUB_REPO_OWNER = "atriumn";
const GITHUB_REPO_NAME = "idynic-feedback";

interface FeedbackRequest {
  title: string;
  description: string;
  type: "bug" | "feature" | "question";
  email?: string;
  url?: string;
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!body.description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const token = process.env.GITHUB_FEEDBACK_TOKEN;
    if (!token) {
      console.error("GITHUB_FEEDBACK_TOKEN not configured");
      return NextResponse.json(
        { error: "Feedback service not configured" },
        { status: 500 }
      );
    }

    // Get user info if authenticated
    let userId: string | null = null;
    let userEmail: string | null = body.email || null;

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = userEmail || user.email || null;
      }
    } catch {
      // Not authenticated, continue without user info
    }

    // Build issue body
    const labelMap = {
      bug: "bug",
      feature: "enhancement",
      question: "question",
    };

    const sections: string[] = [body.description];

    // Add environment info section
    const envInfo: string[] = [];
    if (body.url) envInfo.push(`**URL:** ${body.url}`);
    if (body.userAgent) envInfo.push(`**User Agent:** ${body.userAgent}`);
    if (userEmail) envInfo.push(`**Contact:** ${userEmail}`);
    if (userId) envInfo.push(`**User ID:** \`${userId.slice(0, 8)}...\``);

    if (envInfo.length > 0) {
      sections.push("\n---\n### Environment\n" + envInfo.join("\n"));
    }

    sections.push("\n---\n*Submitted via in-app feedback*");

    const issueBody = sections.join("\n");

    // Create GitHub issue
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: body.title,
          body: issueBody,
          labels: [labelMap[body.type] || "bug"],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to submit feedback" },
        { status: 500 }
      );
    }

    const issue = await response.json();

    return NextResponse.json({
      success: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
