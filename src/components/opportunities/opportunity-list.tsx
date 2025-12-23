"use client";

import { useState } from "react";
import { 
  LayoutGrid, 
  List as ListIcon, 
  Search, 
  Filter,
  MapPin,
  Calendar,
  Briefcase,
  ArrowUpRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OpportunityCard } from "@/components/opportunity-card";
import type { Database } from "@/lib/supabase/types";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];

interface OpportunityListProps {
  initialOpportunities: Opportunity[];
}

const STATUS_COLORS: Record<string, string> = {
  tracking: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  interviewing: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  offer: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  archived: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

export function OpportunityList({ initialOpportunities }: OpportunityListProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const filteredOpportunities = initialOpportunities.filter((opp) => {
    const matchesSearch = 
      opp.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter.length === 0 || 
      (opp.status && statusFilter.includes(opp.status));

    return matchesSearch && matchesStatus;
  });

  const allStatuses = Array.from(new Set(initialOpportunities.map(o => o.status || "tracking")));

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  return (
    <div className="space-y-8">
      {/* Premium Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/30 p-4 rounded-2xl border-2 border-muted/50">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roles, companies, or keywords..."
            className="pl-10 h-11 bg-background border-none shadow-inner focus-visible:ring-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-11 px-4 font-bold border-2 bg-background">
                <Filter className="h-4 w-4 mr-2" />
                FILTER
                {statusFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 rounded-sm text-xs font-black">
                    {statusFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] p-2">
              <DropdownMenuItem onClick={() => setStatusFilter([])} className="justify-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Reset All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {allStatuses.map(status => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilter.includes(status)}
                  onCheckedChange={() => toggleStatus(status)}
                  className="capitalize font-medium"
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1 border-2 rounded-xl p-1 bg-background h-11">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className={`h-9 w-9 p-0 rounded-lg ${viewMode === "grid" ? "shadow-sm" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className={`h-9 w-9 p-0 rounded-lg ${viewMode === "list" ? "shadow-sm" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredOpportunities.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed rounded-3xl bg-muted/5">
          <Briefcase className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-black tracking-tight">Zero matches found</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mt-1">Try expanding your search criteria or adjusting the status filters.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {filteredOpportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      ) : (
        <div className="border-2 border-muted rounded-2xl overflow-hidden shadow-sm bg-background">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-b-2">
                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Opportunity</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Status</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Location</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Created</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase tracking-widest h-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOpportunities.map((opp) => (
                <TableRow key={opp.id} className="group cursor-pointer hover:bg-muted/20 border-b last:border-0">
                  <TableCell className="py-4">
                    <Link href={`/opportunities/${opp.id}`} className="block">
                      <div className="font-bold text-base group-hover:text-primary transition-colors leading-tight mb-1">{opp.title}</div>
                      <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-tighter">
                        {opp.company || "Direct Hire"}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`capitalize font-bold px-2 py-0.5 text-[10px] ${STATUS_COLORS[opp.status || "tracking"]}`}
                    >
                      {opp.status || "tracking"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      {opp.location && <MapPin className="h-3.5 w-3.5" />}
                      {opp.location || "Remote"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      {opp.created_at ? formatDistanceToNow(new Date(opp.created_at), { addSuffix: true }) : "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-primary hover:text-primary-foreground transition-all">
                      <Link href={`/opportunities/${opp.id}`}>
                        <ArrowUpRight className="h-5 w-5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
