import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface OpportunityNotes {
  rating_tech_stack: number | null
  rating_company: number | null
  rating_industry: number | null
  rating_role_fit: number | null
  links: Array<{ url: string; label: string | null; type: string }>
  notes: string | null
}

const EMPTY_NOTES: OpportunityNotes = {
  rating_tech_stack: null,
  rating_company: null,
  rating_industry: null,
  rating_role_fit: null,
  links: [],
  notes: null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const opportunityId = request.nextUrl.searchParams.get("opportunityId")
  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("opportunity_notes")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching notes:", error)
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 })
  }

  return NextResponse.json(data || EMPTY_NOTES)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { opportunityId, ...noteData } = body

  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("opportunity_notes")
    .upsert({
      opportunity_id: opportunityId,
      user_id: user.id,
      ...noteData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "opportunity_id,user_id"
    })
    .select()
    .single()

  if (error) {
    console.error("Error upserting notes:", error)
    return NextResponse.json({ error: "Failed to save notes" }, { status: 500 })
  }

  return NextResponse.json(data)
}
