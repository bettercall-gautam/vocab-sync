import { BookOpen, Brain, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReviewPromptDirection, ReviewRating } from "@/lib/review";
import type { VocabularyEntry } from "@/lib/vocabulary";

type ReviewWorkspaceProps = {
  queueLength: number;
  syncStatus: "local" | "syncing" | "synced";
  entry: VocabularyEntry | null;
  direction: ReviewPromptDirection;
  revealed: boolean;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
  onCapture: () => void;
};

export default function ReviewWorkspace({ queueLength, syncStatus, entry, direction, revealed, onReveal, onRate, onCapture }: ReviewWorkspaceProps) {
  return (
    <section className="mx-auto max-w-3xl pt-7">
      <div className="rounded-3xl border border-[#ddd6c8] bg-[#fffdf8] p-5 shadow-[0_18px_50px_rgba(44,57,78,0.05)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#7357a4]"><Brain size={16} /><span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">Daily recall</span></div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Five words. About two minutes.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#64758a]">Recall first, then reveal. The desk brings only five due words at a time, so your old Library never becomes homework.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#f2edf8] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#7357a4]">{queueLength} for today</span><span className={`rounded-full px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${syncStatus === "synced" ? "bg-[#edf8f2] text-[#247457]" : syncStatus === "syncing" ? "bg-[#eef4f7] text-[#365a79]" : "bg-[#f5f0e7] text-[#79694f]"}`}>{syncStatus === "synced" ? "Progress synced" : syncStatus === "syncing" ? "Saving progress" : "Progress on this device"}</span></div>
        </div>

        {entry ? (
          <article className="mt-8 rounded-3xl border border-[#ddd6c8] bg-[#faf8f2] p-6 text-center sm:p-10">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#70819a]">{direction === "word-to-meaning" ? "Recall the meaning" : "Recall the word"}</p>
            <h3 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-[#203d60] sm:text-5xl">{direction === "word-to-meaning" ? entry.word : entry.meaning}</h3>
            {!revealed ? (
              <Button onClick={onReveal} className="mt-8 h-11 rounded-xl bg-[#183e66] px-5 text-xs font-bold hover:bg-[#123454]"><BookOpen size={15} className="mr-2" />Reveal answer</Button>
            ) : (
              <div className="mt-8 text-left">
                <div className="rounded-2xl border border-[#d7d1c4] bg-white p-5 text-left">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#22716d]">{direction === "word-to-meaning" ? "Simple meaning" : "Expected word"}</p>
                  <p className="mt-2 text-lg font-semibold text-[#29425d]">{direction === "word-to-meaning" ? entry.meaning : entry.word}</p>
                  <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#7357a4]">Example</p>
                  <p className="mt-2 text-sm leading-6 text-[#5a6e85]">{entry.example}</p>
                </div>
                <p className="mt-5 text-center text-xs text-[#718198]">Pick what felt true. This only decides when the word returns.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["again", "Forgot it", "bg-[#9d4b45] hover:bg-[#833d39]"],
                    ["hard", "Took effort", "bg-[#b77b2a] hover:bg-[#9b6620]"],
                    ["good", "Remembered", "bg-[#22716d] hover:bg-[#195b58]"],
                    ["easy", "Knew instantly", "bg-[#183e66] hover:bg-[#123454]"],
                  ] as const).map(([rating, label, className]) => (
                    <Button key={rating} onClick={() => onRate(rating)} className={`h-11 rounded-xl text-xs font-bold ${className}`}>{label}</Button>
                  ))}
                </div>
              </div>
            )}
          </article>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-[#d6cfc1] bg-[#faf8f2] px-5 py-14 text-center">
            <Brain className="mx-auto text-[#9cacbd]" size={28} />
            <p className="mt-4 text-sm font-semibold text-[#445c75]">Nothing due right now.</p>
            <p className="mt-1 text-xs leading-5 text-[#7b899a]">Capture words, then come back when the desk calls them up again.</p>
            <Button variant="outline" onClick={onCapture} className="mt-6 h-10 rounded-xl border-[#cbd4da] bg-white text-xs font-semibold"><PenLine size={15} className="mr-2" />Capture a word</Button>
          </div>
        )}
      </div>
    </section>
  );
}
