import { Download, FolderOpen, Library, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createInitialReviewMetadata, sourceLabel, type ReviewStore } from "@/lib/review";
import type { VocabularyEntry } from "@/lib/vocabulary";

type LibraryFilter = "all" | "due" | "new" | "known" | "needs-review";

type LibraryWorkspaceProps = {
  library: VocabularyEntry[];
  visibleLibrary: VocabularyEntry[];
  reviewStore: ReviewStore;
  search: string;
  filter: LibraryFilter;
  reviewSyncStatus: "local" | "syncing" | "synced";
  rememberedFileName?: string;
  onSearch: (value: string) => void;
  onFilter: (filter: LibraryFilter) => void;
  onEdit: (id: string, field: "word" | "meaning" | "example", value: string) => void;
  onDelete: (id: string) => void;
  onExport: (format: "markdown" | "csv") => void;
  onChangeFile: () => void;
};

export default function LibraryWorkspace({ library, visibleLibrary, reviewStore, search, filter, reviewSyncStatus, rememberedFileName, onSearch, onFilter, onEdit, onDelete, onExport, onChangeFile }: LibraryWorkspaceProps) {
  return (
    <section className="mx-auto max-w-6xl pt-7">
      <div className="rounded-3xl border border-[#ddd6c8] bg-[#fffdf8] p-5 shadow-[0_18px_50px_rgba(44,57,78,0.05)] sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-[#22716d]">Parsed from Drive</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Vocabulary library</h2><p className="mt-2 text-sm text-[#64758a]">The selected Markdown file remains the source of truth. Review metadata {reviewSyncStatus === "synced" ? "is synced separately between your devices." : reviewSyncStatus === "syncing" ? "is saving between your devices." : "stays on this device until Drive restores."}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onExport("markdown")} className="h-10 rounded-xl border-[#cbd4da] bg-white text-xs font-semibold"><Download size={15} className="mr-2" /> Markdown</Button>
            <Button variant="outline" onClick={() => onExport("csv")} className="h-10 rounded-xl border-[#cbd4da] bg-white text-xs font-semibold"><Download size={15} className="mr-2" /> CSV</Button>
            <Button variant="outline" onClick={onChangeFile} className="h-10 rounded-xl border-[#cbd4da] bg-white text-xs font-semibold"><FolderOpen size={15} className="mr-2" /> Change file</Button>
          </div>
        </div>
        {library.length ? (
          <div className="mt-7">
            <div className="flex flex-col gap-3 rounded-2xl border border-[#ded8cd] bg-[#faf8f2] p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8190a1]" /><Input value={search} onChange={event => onSearch(event.target.value)} placeholder="Search words, meanings, examples" className="h-10 border-[#d7d0c2] bg-white pl-9 text-xs shadow-none" /></div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["all", "All"], ["due", "Due"], ["new", "New"], ["known", "Known"], ["needs-review", "Needs check"],
                ] as const).map(([nextFilter, label]) => <button key={nextFilter} type="button" aria-pressed={filter === nextFilter} onClick={() => onFilter(nextFilter)} className={`min-h-10 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${filter === nextFilter ? "bg-[#183e66] text-white" : "bg-white text-[#617087] hover:bg-[#edf3f2]"}`}>{label}</button>)}
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#ded8cd]">
              <div className="hidden grid-cols-[0.9fr_1.2fr_1.5fr_40px] gap-4 bg-[#eef3f2] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#55706e] sm:grid"><span>Word or phrase</span><span>Simple meaning</span><span>Example</span><span /></div>
              {visibleLibrary.map(entry => {
                const metadata = reviewStore[entry.word.trim().toLocaleLowerCase()] ?? createInitialReviewMetadata("imported", 0);
                return <div key={entry.id} className="grid gap-2 border-t border-[#ece7dc] px-4 py-4 sm:grid-cols-[0.9fr_1.2fr_1.5fr_40px] sm:items-center sm:gap-4"><div><Input value={entry.word} onChange={event => onEdit(entry.id, "word", event.target.value)} aria-label="Word or phrase" className="h-10 bg-[#fbfaf6] text-sm font-semibold text-[#263e5b] shadow-none" /><span className="mt-1.5 inline-block rounded-full bg-[#edf3f2] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-[#3e706c]">{sourceLabel(metadata.source)} · {metadata.state}</span></div><Input value={entry.meaning} onChange={event => onEdit(entry.id, "meaning", event.target.value)} aria-label="Simple meaning" className="h-10 bg-[#fbfaf6] text-sm shadow-none" /><Input value={entry.example} onChange={event => onEdit(entry.id, "example", event.target.value)} aria-label="Example" className="h-10 bg-[#fbfaf6] text-sm shadow-none" /><button type="button" onClick={() => onDelete(entry.id)} className="flex min-h-10 min-w-10 items-center justify-center justify-self-end rounded-lg p-2 text-[#8e9bad] hover:bg-[#fbebea] hover:text-[#b34b43]" aria-label={`Delete ${entry.word}`}><X size={16} /></button></div>;
              })}
              {!visibleLibrary.length && <div className="px-5 py-10 text-center text-sm text-[#718198]">No entries match this search or filter.</div>}
            </div>
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-dashed border-[#d6cfc1] bg-[#faf8f2] px-5 py-14 text-center"><Library className="mx-auto text-[#9cacbd]" size={26} /><p className="mt-3 text-sm font-semibold text-[#445c75]">No vocabulary loaded yet.</p><p className="mt-1 text-xs text-[#7b899a]">{rememberedFileName ? `Tap Resume ${rememberedFileName} to reload it from Drive.` : "Connect Drive and choose `vocab.md` from The Shelf."}</p></div>
        )}
      </div>
    </section>
  );
}
