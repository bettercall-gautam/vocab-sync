import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  ChevronRight,
  Cloud,
  FileText,
  FolderOpen,
  KeyRound,
  Library,
  LoaderCircle,
  LockKeyhole,
  PenLine,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createFingerprint,
  hasDriveConflict,
  hasSyncableVocabularyChanges,
  isConciseVocabularyEntry,
  mergeVocabularyEntries,
  normalizeWords,
  parseVocabularyMarkdown,
  parseGeneratedVocabularyEntries,
  requestWithFreeFallback,
  renderVocabularyMarkdown,
  type DriveFileSnapshot,
  type VocabularyEntry,
} from "@/lib/vocabulary";
import { getDriveAppId, hasPickerBootstrapPrerequisites } from "@/lib/google-picker";

type DriveConnection = {
  token: string;
  expiresAt: number;
};

type SelectedFile = {
  id: string;
  name: string;
  version: string;
  modifiedTime: string;
  fingerprint: string;
};

declare global {
  interface Window {
    gapi?: any;
  }
}

const localDraftKey = "vocab-sync-local-drafts";
const localRouterKey = "vocab-sync-openrouter-key";
const driveScope = "https://www.googleapis.com/auth/drive.file";

function createEntry(word = "", meaning = "", example = ""): VocabularyEntry {
  return {
    id: crypto.randomUUID(),
    word,
    meaning,
    example,
    createdAt: Date.now(),
  };
}

async function fetchDriveSnapshot(token: string, id: string): Promise<DriveFileSnapshot> {
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,version,modifiedTime`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!metadataResponse.ok) throw new Error("Could not check the current Drive file version.");
  const metadata = await metadataResponse.json();
  const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!contentResponse.ok) throw new Error("Could not read the selected Markdown file.");
  return { ...metadata, content: await contentResponse.text() };
}

export default function Home() {
  const [activeView, setActiveView] = useState<"capture" | "library">("capture");
  const [rawWords, setRawWords] = useState("");
  const [drafts, setDrafts] = useState<VocabularyEntry[]>([]);
  const [library, setLibrary] = useState<VocabularyEntry[]>([]);
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [libraryDirty, setLibraryDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [setupExpanded, setSetupExpanded] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const savedDrafts = localStorage.getItem(localDraftKey);
    const savedKey = localStorage.getItem(localRouterKey);
    if (savedDrafts) setDrafts(JSON.parse(savedDrafts));
    if (savedKey) {
      setOpenRouterKey(savedKey);
      setRememberKey(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(localDraftKey, JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  const wordsReady = useMemo(() => normalizeWords(rawWords), [rawWords]);
  const hasSyncableChanges = useMemo(() => hasSyncableVocabularyChanges(drafts, libraryDirty), [drafts, libraryDirty]);
  const connectionReady = Boolean(connection && connection.expiresAt > Date.now());
  const driveClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const pickerApiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;
  const shelfFolderId = import.meta.env.VITE_THE_SHELF_FOLDER_ID;
  const driveAppId = getDriveAppId(driveClientId);

  function updateRouterKey(value: string) {
    setOpenRouterKey(value);
    if (rememberKey) localStorage.setItem(localRouterKey, value);
  }

  function toggleRememberKey(nextValue: boolean) {
    setRememberKey(nextValue);
    if (nextValue && openRouterKey) localStorage.setItem(localRouterKey, openRouterKey);
    if (!nextValue) localStorage.removeItem(localRouterKey);
  }

  function connectGoogleDrive() {
    if (!isOnline) {
      toast.error("You are offline. Reconnect before accessing Google Drive.");
      return;
    }
    if (!driveClientId) {
      setSetupExpanded(true);
      toast.error("Google Drive is not configured yet. Add the public Google client ID first.");
      return;
    }
    if (!(window as any).google?.accounts?.oauth2) {
      toast.error("Google sign in is still loading. Try again in a moment.");
      return;
    }

    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: driveClientId,
      scope: driveScope,
      callback: (response: { access_token?: string; expires_in?: number; error?: string }) => {
        if (response.error || !response.access_token) {
          toast.error(response.error ?? "Google Drive access was not granted.");
          return;
        }
        setConnection({
          token: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        });
        toast.success("Google Drive connected for this browser session.");
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  }

  function pickMarkdownFile() {
    if (!connectionReady || !connection) {
      toast.error("Connect Google Drive before choosing a file.");
      return;
    }
    if (!hasPickerBootstrapPrerequisites({
      apiKey: pickerApiKey,
      folderId: shelfFolderId,
      hasGapi: Boolean(window.gapi),
    }) || !driveAppId) {
      setSetupExpanded(true);
      toast.error("The Drive file picker needs the browser API key and The Shelf folder ID.");
      return;
    }

    window.gapi.load("picker", () => {
      if (!(window as any).google?.picker) {
        toast.error("Google Drive's file picker could not finish loading. Try again in a moment.");
        return;
      }
      const view = new (window as any).google.picker.DocsView((window as any).google.picker.ViewId.DOCS)
        .setParent(shelfFolderId)
        .setMimeTypes("text/markdown")
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false);
      const picker = new (window as any).google.picker.PickerBuilder()
        .setDeveloperKey(pickerApiKey)
        .setAppId(driveAppId)
        .setOAuthToken(connection.token)
        .addView(view)
        .setTitle("Choose a Markdown file from The Shelf")
        .setCallback(async (data: { action: string; docs?: Array<{ id: string; name: string }> }) => {
          if (data.action !== (window as any).google.picker.Action.PICKED || !data.docs?.[0]) return;
          try {
            const snapshot = await fetchDriveSnapshot(connection.token, data.docs[0].id);
            setSelectedFile({
              id: snapshot.id,
              name: snapshot.name,
              version: snapshot.version,
              modifiedTime: snapshot.modifiedTime,
              fingerprint: createFingerprint(snapshot.content),
            });
            setLibrary(parseVocabularyMarkdown(snapshot.content));
            setLibraryDirty(false);
            toast.success(`${snapshot.name} is ready to edit.`);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not open that file.");
          }
        })
        .build();
      picker.setVisible(true);
    });
  }

  function addManualEntry() {
    setDrafts(current => [...current, createEntry()]);
  }

  function updateDraft(id: string, field: keyof Pick<VocabularyEntry, "word" | "meaning" | "example">, value: string) {
    setDrafts(current => current.map(entry => (entry.id === id ? { ...entry, [field]: value } : entry)));
  }

  function removeDraft(id: string) {
    setDrafts(current => current.filter(entry => entry.id !== id));
  }

  function updateLibraryEntry(id: string, field: keyof Pick<VocabularyEntry, "word" | "meaning" | "example">, value: string) {
    setLibrary(current => current.map(entry => (entry.id === id ? { ...entry, [field]: value } : entry)));
    setLibraryDirty(true);
  }

  function deleteLibraryEntry(id: string) {
    setLibrary(current => current.filter(entry => entry.id !== id));
    setLibraryDirty(true);
    toast.message("Entry removed locally. Sync to Drive to make the change permanent.");
  }

  async function generateEntries() {
    if (!isOnline) {
      toast.error("You are offline. You can still add a manual draft, but AI generation needs a connection.");
      return;
    }
    if (!wordsReady.length) {
      toast.error("Paste at least one word or phrase first.");
      return;
    }
    if (!openRouterKey.trim()) {
      setSetupExpanded(true);
      toast.error("Add your OpenRouter key to generate entries.");
      return;
    }

    setGenerating(true);
    try {
      const requestGeneratedEntries = async (repairInstruction?: string) => {
        const { value: entries, model } = await requestWithFreeFallback(async selectedModel => {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterKey.trim()}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "Vocab Sync",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: "system",
                content: "Return only valid JSON. Create extremely concise vocabulary notes. Hard rules for every entry: meaning has at most 8 words and gives one direct simple definition; example has at most 10 words and is one natural sentence. Do not add explanations, clauses, alternatives, or extra detail.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  words: wordsReady,
                  requiredFormat: { entries: [{ word: "", meaning: "", example: "" }] },
                  repairInstruction,
                }),
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.25,
          }),
        });
          if (!response.ok) throw new Error("Free model unavailable");
          const payload = await response.json();
          const parsedEntries = parseGeneratedVocabularyEntries(payload.choices?.[0]?.message?.content);
          if (parsedEntries.length !== wordsReady.length) throw new Error("Model did not return every requested word.");
          return parsedEntries;
        });
        return {
          model,
          entries: entries.map(entry => createEntry(entry.word, entry.meaning, entry.example)),
        };
      };

      let { entries: generated, model } = await requestGeneratedEntries();
      if (generated.some(entry => !isConciseVocabularyEntry(entry))) {
        ({ entries: generated, model } = await requestGeneratedEntries(
          "Your previous output was too long. Regenerate every entry within the exact word limits.",
        ));
      }
      if (!generated.length) throw new Error("The free model returned an unusable result. Try again or add entries manually.");
      if (generated.some(entry => !isConciseVocabularyEntry(entry))) {
        throw new Error("The free model kept the answer too long. Try again in a moment or edit a manual draft.");
      }
      const { entries, duplicates } = mergeVocabularyEntries([...library, ...drafts], generated);
      const fresh = entries.slice(library.length + drafts.length);
      setDrafts(current => [...current, ...fresh]);
      setRawWords("");
      if (duplicates.length) toast.message(`${duplicates.length} duplicate word${duplicates.length === 1 ? " was" : "s were"} skipped.`);
      toast.success(`${fresh.length} draft ${fresh.length === 1 ? "entry" : "entries"} generated with ${model}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation could not be completed.");
    } finally {
      setGenerating(false);
    }
  }

  async function syncToDrive() {
    if (!isOnline) {
      toast.error("You are offline. Your drafts remain safe on this device until you reconnect.");
      return;
    }
    if (!selectedFile || !connectionReady || !connection) {
      toast.error("Connect Google Drive and choose a Markdown file before syncing.");
      return;
    }
    const cleanDrafts = drafts.filter(entry => entry.word.trim() && entry.meaning.trim() && entry.example.trim());
    if (!libraryDirty && !cleanDrafts.length) {
      toast.error("Edit the Library or add at least one complete draft before syncing.");
      return;
    }

    setSyncing(true);
    try {
      const latest = await fetchDriveSnapshot(connection.token, selectedFile.id);
      if (hasDriveConflict(selectedFile, latest)) {
        toast.error("Conflict detected. This file changed outside Vocab Sync. Reload it before syncing.");
        return;
      }
      const { entries, duplicates } = mergeVocabularyEntries(library, cleanDrafts);
      const updatedMarkdown = renderVocabularyMarkdown(entries);
      const metadata = new Blob([JSON.stringify({ mimeType: "text/markdown" })], { type: "application/json" });
      const file = new Blob([updatedMarkdown], { type: "text/markdown" });
      const form = new FormData();
      form.append("metadata", metadata);
      form.append("file", file);
      const upload = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${selectedFile.id}?uploadType=multipart&fields=id,name,version,modifiedTime`,
        { method: "PATCH", headers: { Authorization: `Bearer ${connection.token}` }, body: form },
      );
      if (!upload.ok) throw new Error("Drive rejected the update. Check the connection and try again.");
      const fileInfo = await upload.json();
      setSelectedFile(current => current && {
        ...current,
        version: fileInfo.version,
        modifiedTime: fileInfo.modifiedTime,
        fingerprint: createFingerprint(updatedMarkdown),
      });
      setLibrary(entries);
      setDrafts([]);
      setLibraryDirty(false);
      toast.success(duplicates.length ? `Synced. ${duplicates.length} duplicate entries were skipped.` : "Vocabulary synced to Drive.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed. Your drafts are still safe on this device.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#1c2d44]">
      <div className="pointer-events-none fixed inset-0 paper-grid opacity-45" />
      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[272px] flex-col border-r border-[#d8d1c4] bg-[#fcfaf5]/90 px-5 py-6 lg:flex">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#183e66] text-[#f4ede0] shadow-[0_8px_20px_rgba(24,62,102,0.18)]">
              <BookOpen size={20} strokeWidth={2.3} />
            </div>
            <div>
              <p className="font-display text-xl font-semibold leading-none">Vocab Sync</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[#607089]">Personal language desk</p>
            </div>
          </div>

          <nav className="mt-12 space-y-1">
            {[
              { id: "capture", label: "Capture", icon: PenLine },
              { id: "library", label: "Library", icon: Library },
            ].map(item => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as "capture" | "library")}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all ${active ? "bg-[#d9ece8] text-[#184d53] shadow-sm" : "text-[#66748a] hover:bg-[#f0ece3] hover:text-[#273d58]"}`}
                >
                  <Icon size={18} />
                  {item.label}
                  {item.id === "library" && library.length > 0 && <span className="ml-auto font-mono text-[10px]">{library.length}</span>}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-[#d9d2c5] bg-[#f6f1e7] p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#506279]"><LockKeyhole size={14} /> Local first</div>
            <p className="mt-2 text-xs leading-5 text-[#63738a]">Drafts stay in this browser until you choose to sync them to Google Drive.</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-10 lg:py-7">
          <header className="flex items-center justify-between gap-4 border-b border-[#ddd7ca] pb-5">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#183e66] text-[#f4ede0]"><BookOpen size={18} /></div>
              <p className="font-display text-xl font-semibold">Vocab Sync</p>
            </div>
            <div className="hidden lg:block">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#6b7b91]">{activeView === "capture" ? "New vocabulary" : "Your collection"}</p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">{activeView === "capture" ? "Capture a word while it is alive." : "Words worth keeping."}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className={`hidden items-center gap-2 rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] sm:flex ${!isOnline ? "border-[#efc1bd] bg-[#fff0ee] text-[#ae4942]" : connectionReady ? "border-[#a6d5c6] bg-[#edf8f2] text-[#247457]" : "border-[#e5d3a8] bg-[#fff8e6] text-[#936a18]"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${!isOnline ? "bg-[#d85b51]" : connectionReady ? "bg-[#35a97b]" : "bg-[#d29a26]"}`} />
                {!isOnline ? "Offline" : connectionReady ? "Drive connected" : "Drive not connected"}
              </span>
              <Button variant="outline" onClick={connectGoogleDrive} className="h-10 rounded-xl border-[#c8d0d8] bg-white/70 px-3 text-xs font-semibold text-[#27415f] hover:bg-white sm:px-4">
                <Cloud size={15} className="mr-2" /> {connectionReady ? "Reconnect" : "Connect Drive"}
              </Button>
            </div>
          </header>

          <nav aria-label="Workspace navigation" className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#ddd6c8] bg-[#fffdf8]/90 p-2 lg:hidden">
            {[
              { id: "capture", label: "Capture", icon: PenLine },
              { id: "library", label: "Library", icon: Library },
            ].map(item => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as "capture" | "library")}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${active ? "bg-[#d9ece8] text-[#184d53]" : "text-[#66748a] hover:bg-[#f0ece3] hover:text-[#273d58]"}`}
                >
                  <Icon size={17} />
                  {item.label}
                  {item.id === "library" && library.length > 0 && <span className="rounded-full bg-white/75 px-1.5 py-0.5 font-mono text-[10px]">{library.length}</span>}
                </button>
              );
            })}
          </nav>

          {activeView === "capture" ? (
            <div className="mx-auto grid max-w-6xl gap-6 pt-7 xl:grid-cols-[minmax(0,1fr)_350px]">
              <section className="space-y-6">
                <div className="rounded-3xl border border-[#ddd6c8] bg-[#fffdf8]/95 p-5 shadow-[0_18px_50px_rgba(44,57,78,0.06)] sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-[#22716d]"><Sparkles size={16} /><span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">Fast and free</span></div>
                      <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.025em]">Drop in the words you met today.</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-[#617087]">Paste words, phrases, or a messy comma separated list. The generator will keep each meaning simple and each example short.</p>
                    </div>
                    <span className="rounded-full bg-[#edf3f7] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#4e637b]">{wordsReady.length} ready</span>
                  </div>
                  <Textarea
                    value={rawWords}
                    onChange={event => setRawWords(event.target.value)}
                    placeholder={"serenity\nepiphany, grit\nword or phrase"}
                    className="mt-6 min-h-[176px] resize-y rounded-2xl border-[#d9d4c8] bg-[#faf8f1] p-4 font-mono text-sm leading-6 shadow-none focus-visible:ring-[#3b768b]"
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#77869a]">Duplicates are removed before generation. Nothing is sent to Drive automatically.</p>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={addManualEntry} className="h-10 rounded-xl px-3 text-xs font-semibold text-[#42607a] hover:bg-[#edf3f7]"><Plus size={15} className="mr-1.5" /> Manual entry</Button>
                      <Button onClick={generateEntries} disabled={generating || !wordsReady.length || !isOnline} className="h-10 rounded-xl bg-[#183e66] px-4 text-xs font-semibold text-white hover:bg-[#123454]">
                        {generating ? <LoaderCircle size={15} className="mr-2 animate-spin" /> : <Sparkles size={15} className="mr-2" />}
                        Generate drafts
                      </Button>
                    </div>
                  </div>
                </div>

                <section className="rounded-3xl border border-[#ddd6c8] bg-white/85 p-5 shadow-[0_18px_50px_rgba(44,57,78,0.05)] sm:p-7">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[#7357a4]"><PenLine size={16} /><span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">Review desk</span></div>
                      <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.025em]">Edit before you commit.</h2>
                    </div>
                    <span className="font-mono text-[11px] text-[#718198]">{drafts.length} unsynced draft{drafts.length === 1 ? "" : "s"}</span>
                  </div>

                  {drafts.length === 0 ? (
                    <div className="mt-7 rounded-2xl border border-dashed border-[#d6cfc1] bg-[#faf8f2] px-5 py-10 text-center">
                      <BookOpen className="mx-auto text-[#9cacbd]" size={25} />
                      <p className="mt-3 text-sm font-semibold text-[#445c75]">Your review desk is clear.</p>
                      <p className="mt-1 text-xs text-[#7b899a]">Generate a batch, or add one manual entry to start.</p>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      {drafts.map((entry, index) => (
                        <article key={entry.id} className="rounded-2xl border border-[#ded8cd] bg-[#fffefa] p-4 transition-shadow hover:shadow-[0_8px_24px_rgba(48,64,82,0.07)] sm:p-5">
                          <div className="mb-4 flex items-center justify-between">
                            <span className="font-mono text-[11px] font-semibold text-[#6b82a0]">DRAFT {String(index + 1).padStart(2, "0")}</span>
                            <button onClick={() => removeDraft(entry.id)} className="rounded-lg p-1.5 text-[#8794a5] transition-colors hover:bg-[#fbebea] hover:text-[#b34b43]" aria-label="Remove draft"><X size={16} /></button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-[0.85fr_1fr_1.25fr]">
                            <Input value={entry.word} onChange={event => updateDraft(entry.id, "word", event.target.value)} placeholder="Word or phrase" className="h-10 border-[#dad3c7] bg-[#fbfaf6] text-sm shadow-none" />
                            <Input value={entry.meaning} onChange={event => updateDraft(entry.id, "meaning", event.target.value)} placeholder="Simple meaning" className="h-10 border-[#dad3c7] bg-[#fbfaf6] text-sm shadow-none" />
                            <Input value={entry.example} onChange={event => updateDraft(entry.id, "example", event.target.value)} placeholder="Short example" className="h-10 border-[#dad3c7] bg-[#fbfaf6] text-sm shadow-none" />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </section>

              <aside className="space-y-5 xl:pt-1">
                <section className="rounded-3xl bg-[#183e66] p-5 text-[#f8f4ea] shadow-[0_18px_38px_rgba(24,62,102,0.18)]">
                  <div className="flex items-center justify-between"><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b7d9d6]">Destination</span><FileText size={17} className="text-[#b7d9d6]" /></div>
                  <p className="mt-4 truncate font-display text-xl font-semibold">{selectedFile?.name ?? "No file selected"}</p>
                  <p className="mt-2 text-xs leading-5 text-[#c5d5e1]">{selectedFile ? `Last loaded ${new Date(selectedFile.modifiedTime).toLocaleString()}` : "Choose vocab.md from The Shelf after connecting Drive."}</p>
                  <Button variant="secondary" onClick={pickMarkdownFile} className="mt-5 h-10 w-full rounded-xl bg-[#f0eee6] text-xs font-bold text-[#183e66] hover:bg-white"><FolderOpen size={15} className="mr-2" /> Choose Markdown file</Button>
                </section>

                <section className="rounded-3xl border border-[#ddd6c8] bg-[#fffdf8] p-5 shadow-[0_12px_30px_rgba(44,57,78,0.04)]">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[#7357a4]"><RefreshCw size={16} /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">Safe sync</span></div><span className="rounded-full bg-[#f2edf8] px-2 py-1 font-mono text-[9px] font-bold text-[#7357a4]">MANUAL</span></div>
                  <p className="mt-3 text-sm leading-6 text-[#576a80]">Every sync checks whether the file changed in Obsidian or Drive. If it did, Vocab Sync blocks the overwrite.</p>
                  <Button onClick={syncToDrive} disabled={syncing || !hasSyncableChanges || !isOnline} className="mt-5 h-11 w-full rounded-xl bg-[#22716d] text-xs font-bold text-white hover:bg-[#195b58]">
                    {syncing ? <LoaderCircle size={15} className="mr-2 animate-spin" /> : <Upload size={15} className="mr-2" />} {syncing ? "Checking and syncing" : "Sync to Drive"}
                  </Button>
                </section>

                <section className="rounded-3xl border border-[#e4d8bd] bg-[#fff7e3] p-5">
                  <div className="flex items-center gap-2 text-[#9a6c13]"><TriangleAlert size={16} /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">Free tier rule</span></div>
                  <p className="mt-2 text-xs leading-5 text-[#796131]">The app sends requests only to OpenRouter’s free model pool. It stops instead of falling back to a paid model.</p>
                </section>
              </aside>
            </div>
          ) : (
            <section className="mx-auto max-w-6xl pt-7">
              <div className="rounded-3xl border border-[#ddd6c8] bg-[#fffdf8] p-5 shadow-[0_18px_50px_rgba(44,57,78,0.05)] sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-[#22716d]">Parsed from Drive</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Vocabulary library</h2><p className="mt-2 text-sm text-[#64758a]">The selected Markdown file remains the source of truth.</p></div>
                  <Button variant="outline" onClick={pickMarkdownFile} className="h-10 rounded-xl border-[#cbd4da] bg-white text-xs font-semibold"><FolderOpen size={15} className="mr-2" /> Change file</Button>
                </div>
                {library.length ? (
                  <div className="mt-7 overflow-hidden rounded-2xl border border-[#ded8cd]">
                    <div className="hidden grid-cols-[0.9fr_1.2fr_1.5fr_30px] gap-4 bg-[#eef3f2] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#55706e] sm:grid"><span>Word or phrase</span><span>Simple meaning</span><span>Example</span><span /></div>
                    {library.map(entry => <div key={entry.id} className="grid gap-2 border-t border-[#ece7dc] px-4 py-4 sm:grid-cols-[0.9fr_1.2fr_1.5fr_30px] sm:items-center sm:gap-4"><Input value={entry.word} onChange={event => updateLibraryEntry(entry.id, "word", event.target.value)} aria-label="Word or phrase" className="h-9 bg-[#fbfaf6] text-sm font-semibold text-[#263e5b] shadow-none" /><Input value={entry.meaning} onChange={event => updateLibraryEntry(entry.id, "meaning", event.target.value)} aria-label="Simple meaning" className="h-9 bg-[#fbfaf6] text-sm shadow-none" /><Input value={entry.example} onChange={event => updateLibraryEntry(entry.id, "example", event.target.value)} aria-label="Example" className="h-9 bg-[#fbfaf6] text-sm shadow-none" /><button onClick={() => deleteLibraryEntry(entry.id)} className="justify-self-end rounded-lg p-2 text-[#8e9bad] hover:bg-[#fbebea] hover:text-[#b34b43]" aria-label={`Delete ${entry.word}`}><X size={16} /></button></div>)}
                  </div>
                ) : (
                  <div className="mt-7 rounded-2xl border border-dashed border-[#d6cfc1] bg-[#faf8f2] px-5 py-14 text-center"><Library className="mx-auto text-[#9cacbd]" size={26} /><p className="mt-3 text-sm font-semibold text-[#445c75]">No vocabulary loaded yet.</p><p className="mt-1 text-xs text-[#7b899a]">Connect Drive and choose `vocab.md` from The Shelf.</p></div>
                )}
              </div>
            </section>
          )}

          <section className="mx-auto mt-6 max-w-6xl rounded-2xl border border-[#d8d1c4] bg-[#f3efe5]/80 px-4 py-3 sm:px-5">
            <button onClick={() => setSetupExpanded(current => !current)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 text-xs font-bold text-[#516780]"><KeyRound size={15} /> Free browser setup</span><ChevronRight size={16} className={`text-[#8191a4] transition-transform ${setupExpanded ? "rotate-90" : ""}`} /></button>
            {setupExpanded && <div className="mt-3 border-t border-[#dbd3c5] pt-3 text-xs leading-5 text-[#62748b]"><p>Before Drive sync can work, add a public Google OAuth Client ID, a browser restricted Google Picker API key, and The Shelf folder ID to the deployment configuration. Add your OpenRouter key below for free-model generation.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input type="password" value={openRouterKey} onChange={event => updateRouterKey(event.target.value)} placeholder="OpenRouter API key" className="h-10 flex-1 bg-white text-xs shadow-none" /><Button variant="outline" onClick={() => toggleRememberKey(!rememberKey)} className="h-10 rounded-xl text-xs">{rememberKey ? <Check size={14} className="mr-1.5" /> : null}{rememberKey ? "Saved on this device" : "Do not save key"}</Button></div></div>}
          </section>
        </main>
      </div>
    </div>
  );
}
