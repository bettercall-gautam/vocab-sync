import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BookOpen,
  Brain,
  ChevronRight,
  Cloud,
  Download,
  FileText,
  FolderOpen,
  KeyRound,
  Library,
  LoaderCircle,
  LockKeyhole,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  clampVocabularyEntryToConciseLimits,
  createFingerprint,
  hasDriveConflict,
  hasSyncableVocabularyChanges,
  isOrdinaryEnglishDictionaryWord,
  isConciseVocabularyEntry,
  mergeVocabularyEntries,
  normalizeOpenRouterApiKey,
  normalizeWords,
  parseInstantDictionaryEntry,
  parseWiktionaryDictionaryEntry,
  parseVocabularyMarkdown,
  parseGeneratedVocabularyEntries,
  requestWithFreeModelRouter,
  renderVocabularyMarkdown,
  type DriveFileSnapshot,
  type VocabularyEntry,
} from "@/lib/vocabulary";
import {
  createInitialReviewMetadata,
  entryReviewKey,
  isReviewDue,
  parseReviewStore,
  reviewPromptDirection,
  scheduleReview,
  sourceLabel,
  type EntrySource,
  type ReviewRating,
  type ReviewStore,
} from "@/lib/review";
import { mergeReviewStores, parseReviewSyncDocument } from "@/lib/review-sync";
import { getDriveAppId, hasPickerBootstrapPrerequisites } from "@/lib/google-picker";
import {
  parseRememberedMarkdownDestination,
  parseWorkspaceView,
  serializeRememberedMarkdownDestination,
  type RememberedMarkdownDestination,
  type WorkspaceView,
} from "@/lib/remembered-destination";
import {
  driveSessionStorageKey,
  getDriveSessionErrorMessage,
  getDriveWorkerOrigin,
  isDriveReauthorizationError,
  parseDriveSessionFromHash,
} from "@/lib/drive-session";

const ReviewWorkspace = lazy(() => import("@/components/ReviewWorkspace"));
const LibraryWorkspace = lazy(() => import("@/components/LibraryWorkspace"));

type DriveConnection = {
  token: string;
  expiresAt: number;
};

type CaptureMode = "smart" | "manual" | "ai";

type SelectedFile = {
  id: string;
  name: string;
  version: string;
  modifiedTime: string;
  fingerprint: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    gapi?: any;
  }
}

const localDraftKey = "vocab-sync-local-drafts";
const localRouterKey = "vocab-sync-openrouter-key";
const localSelectedFileKey = "vocab-sync-selected-markdown-destination";
const localWorkspaceViewKey = "vocab-sync-workspace-view";
const localReviewStoreKey = "vocab-sync-review-store";
const driveScope = "https://www.googleapis.com/auth/drive.file";

const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client";
const googlePickerScriptUrl = "https://apis.google.com/js/api.js";

function loadExternalScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script_load_failed")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("script_load_failed")), { once: true });
    document.head.appendChild(script);
  });
}

function createEntry(word = "", meaning = "", example = "", source?: EntrySource): VocabularyEntry {
  return {
    id: crypto.randomUUID(),
    word,
    meaning,
    example,
    createdAt: Date.now(),
    ...(source ? { source } : {}),
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
  const [activeView, setActiveView] = useState<WorkspaceView>(() => parseWorkspaceView(localStorage.getItem(localWorkspaceViewKey)));
  const [rawWords, setRawWords] = useState("");
  const [drafts, setDrafts] = useState<VocabularyEntry[]>([]);
  const [library, setLibrary] = useState<VocabularyEntry[]>([]);
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [deviceSession, setDeviceSession] = useState<string | null>(() => localStorage.getItem(driveSessionStorageKey));
  const [restoringDriveSession, setRestoringDriveSession] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [rememberedDestination, setRememberedDestination] = useState<RememberedMarkdownDestination | null>(() => (
    parseRememberedMarkdownDestination(localStorage.getItem(localSelectedFileKey))
  ));
  const [libraryDirty, setLibraryDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dictionaryLookingUp, setDictionaryLookingUp] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("smart");
  const [reviewStore, setReviewStore] = useState<ReviewStore>(() => parseReviewStore(localStorage.getItem(localReviewStoreKey)));
  const reviewStoreRef = useRef(reviewStore);
  const reviewSyncVersionRef = useRef(0);
  const [reviewSyncStatus, setReviewSyncStatus] = useState<"local" | "syncing" | "synced">("local");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "due" | "new" | "known" | "needs-review">("all");
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
    localStorage.setItem(localWorkspaceViewKey, activeView);
  }, [activeView]);

  useEffect(() => {
    reviewStoreRef.current = reviewStore;
    localStorage.setItem(localReviewStoreKey, JSON.stringify(reviewStore));
  }, [reviewStore]);

  useEffect(() => {
    if (!library.length) return;
    setReviewStore(current => {
      let changed = false;
      const next = { ...current };
      for (const entry of library) {
        const key = entryReviewKey(entry.word);
        if (!key || next[key]) continue;
        next[key] = createInitialReviewMetadata("imported");
        changed = true;
      }
      return changed ? next : current;
    });
  }, [library]);

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

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  useEffect(() => {
    const returnedSession = parseDriveSessionFromHash(window.location.hash);
    if (!returnedSession) return;

    localStorage.setItem(driveSessionStorageKey, returnedSession);
    setDeviceSession(returnedSession);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.hash = "";
    window.history.replaceState({}, document.title, cleanUrl.toString());
  }, []);

  const wordsReady = useMemo(() => normalizeWords(rawWords), [rawWords]);
  const hasSyncableChanges = useMemo(() => hasSyncableVocabularyChanges(drafts, libraryDirty), [drafts, libraryDirty]);
  const reviewQueue = useMemo(() => (
    library.filter(entry => isReviewDue(reviewStore[entryReviewKey(entry.word)])).slice(0, 5)
  ), [library, reviewStore]);
  const activeReviewEntry = reviewQueue[0] ?? null;
  const activeReviewMetadata = activeReviewEntry
    ? reviewStore[entryReviewKey(activeReviewEntry.word)] ?? createInitialReviewMetadata("imported")
    : null;
  const activeReviewDirection = reviewPromptDirection(activeReviewMetadata ?? undefined);
  const visibleLibrary = useMemo(() => {
    const query = librarySearch.trim().toLocaleLowerCase();
    return library.filter(entry => {
      const metadata = reviewStore[entryReviewKey(entry.word)] ?? createInitialReviewMetadata("imported", 0);
      const matchesQuery = !query || [entry.word, entry.meaning, entry.example].some(value => value.toLocaleLowerCase().includes(query));
      const matchesFilter = libraryFilter === "all"
        || (libraryFilter === "due" && isReviewDue(metadata))
        || (libraryFilter === "new" && metadata.state === "new")
        || (libraryFilter === "known" && metadata.state === "known")
        || (libraryFilter === "needs-review" && metadata.source === "needs-review");
      return matchesQuery && matchesFilter;
    });
  }, [library, libraryFilter, librarySearch, reviewStore]);
  const connectionReady = Boolean(connection && connection.expiresAt > Date.now());
  const driveClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const pickerApiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;
  const shelfFolderId = import.meta.env.VITE_THE_SHELF_FOLDER_ID;
  const workerOrigin = getDriveWorkerOrigin(import.meta.env.VITE_DRIVE_SESSION_WORKER_URL);
  const driveAppId = getDriveAppId(driveClientId);

  useEffect(() => {
    if (!workerOrigin || !deviceSession || !isOnline) return;
    void restorePersistentDriveSession(deviceSession, true);
  // The session should refresh only when its stable identifier, endpoint, or network state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceSession, isOnline, workerOrigin]);

  function updateRouterKey(value: string) {
    setOpenRouterKey(value);
    if (rememberKey) localStorage.setItem(localRouterKey, value);
  }

  async function installHomeScreenApp() {
    if (!installPrompt) {
      toast.message("On iPhone: use Share, then Add to Home Screen. On Android: use your browser menu, then Install app.");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") toast.success("Vocab Sync was added to your home screen.");
  }

  function toggleRememberKey(nextValue: boolean) {
    setRememberKey(nextValue);
    if (nextValue && openRouterKey) localStorage.setItem(localRouterKey, openRouterKey);
    if (!nextValue) localStorage.removeItem(localRouterKey);
  }

  async function loadMarkdownDestination(token: string, id: string, restored = false) {
    const snapshot = await fetchDriveSnapshot(token, id);
    const nextSelectedFile = {
      id: snapshot.id,
      name: snapshot.name,
      version: snapshot.version,
      modifiedTime: snapshot.modifiedTime,
      fingerprint: createFingerprint(snapshot.content),
    };
    setSelectedFile(nextSelectedFile);
    setLibrary(parseVocabularyMarkdown(snapshot.content));
    setLibraryDirty(false);
    localStorage.setItem(
      localSelectedFileKey,
      serializeRememberedMarkdownDestination({ id: nextSelectedFile.id, name: nextSelectedFile.name }),
    );
    setRememberedDestination({ id: nextSelectedFile.id, name: nextSelectedFile.name });
    toast.success(restored ? `${snapshot.name} restored after reconnecting Drive.` : `${snapshot.name} is ready to edit.`);
  }

  async function restoreRememberedMarkdownDestination(token: string) {
    const remembered = parseRememberedMarkdownDestination(localStorage.getItem(localSelectedFileKey));
    if (!remembered) return;

    try {
      await loadMarkdownDestination(token, remembered.id, true);
    } catch {
      localStorage.removeItem(localSelectedFileKey);
      setRememberedDestination(null);
      toast.message("Your saved Markdown destination could not be restored. Choose it again from The Shelf.");
    }
  }

  function clearLocalDriveSession() {
    localStorage.removeItem(driveSessionStorageKey);
    setDeviceSession(null);
  }

  async function requestPersistentAccessToken(session: string): Promise<DriveConnection> {
    if (!workerOrigin) throw new Error("persistent_drive_not_configured");
    const response = await fetch(`${workerOrigin}/session/access-token`, {
      method: "POST",
      headers: { "X-Vocab-Sync-Session": session },
    });
    const body = await response.json().catch(() => null) as { accessToken?: unknown; expiresInSeconds?: unknown; error?: unknown } | null;
    if (!response.ok || typeof body?.accessToken !== "string") {
      throw new Error(typeof body?.error === "string" ? body.error : "token_refresh_failed");
    }

    return {
      token: body.accessToken,
      expiresAt: Date.now() + (typeof body.expiresInSeconds === "number" ? body.expiresInSeconds : 3600) * 1000,
    };
  }

  async function readRemoteReviewState(session: string) {
    if (!workerOrigin) throw new Error("review_sync_unavailable");
    const response = await fetch(`${workerOrigin}/review-state`, {
      headers: { "X-Vocab-Sync-Session": session },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "review_sync_unavailable");
    const document = parseReviewSyncDocument(body);
    if (!document) throw new Error("review_sync_unavailable");
    return { ...document, reviewStore: parseReviewStore(JSON.stringify(document.reviewStore)) };
  }

  async function pullReviewState(session: string): Promise<ReviewStore> {
    setReviewSyncStatus("syncing");
    const document = await readRemoteReviewState(session);
    const merged = mergeReviewStores(reviewStoreRef.current, document.reviewStore);
    reviewSyncVersionRef.current = document.version;
    reviewStoreRef.current = merged;
    setReviewStore(merged);
    setReviewSyncStatus("synced");
    return merged;
  }

  async function pushReviewState(nextStore: ReviewStore, retried = false, sessionOverride?: string): Promise<void> {
    const activeSession = sessionOverride ?? deviceSession;
    if (!workerOrigin || !activeSession || !isOnline) return;
    setReviewSyncStatus("syncing");
    const response = await fetch(`${workerOrigin}/review-state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Vocab-Sync-Session": activeSession,
      },
      body: JSON.stringify({ expectedVersion: reviewSyncVersionRef.current, reviewStore: nextStore }),
    });
    const body = await response.json().catch(() => null);
    if (response.status === 409 && !retried) {
      const merged = await pullReviewState(activeSession);
      await pushReviewState(mergeReviewStores(nextStore, merged), true, activeSession);
      return;
    }
    if (!response.ok) {
      setReviewSyncStatus("local");
      return;
    }
    const document = parseReviewSyncDocument(body);
    if (!document) {
      setReviewSyncStatus("local");
      return;
    }
    reviewSyncVersionRef.current = document.version;
    setReviewSyncStatus("synced");
  }

  async function restorePersistentDriveSession(session: string, automatic = false) {
    setRestoringDriveSession(true);
    try {
      const nextConnection = await requestPersistentAccessToken(session);
      setConnection(nextConnection);
      try {
        const mergedReviewStore = await pullReviewState(session);
        await pushReviewState(mergedReviewStore, false, session);
      } catch {
        setReviewSyncStatus("local");
      }
      await restoreRememberedMarkdownDestination(nextConnection.token);
      if (!automatic || !rememberedDestination) toast.success("Drive restored securely on this device.");
    } catch (error) {
      const code = error instanceof Error ? error.message : null;
      setConnection(null);
      if (isDriveReauthorizationError(code)) clearLocalDriveSession();
      toast.error(getDriveSessionErrorMessage(code));
    } finally {
      setRestoringDriveSession(false);
    }
  }

  async function connectGoogleDrive() {
    if (!isOnline) {
      toast.error("You are offline. Reconnect before accessing Google Drive.");
      return;
    }
    if (workerOrigin) {
      if (deviceSession) {
        void restorePersistentDriveSession(deviceSession);
        return;
      }
      window.location.assign(`${workerOrigin}/auth/google/start`);
      return;
    }
    if (!driveClientId) {
      setSetupExpanded(true);
      toast.error("Google Drive is not configured yet. Add the public Google client ID first.");
      return;
    }
    try {
      await loadExternalScript(googleIdentityScriptUrl);
    } catch {
      toast.error("Google sign in could not load. Check your connection and try again.");
      return;
    }
    if (!(window as any).google?.accounts?.oauth2) return toast.error("Google sign in is still loading. Try again in a moment.");

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
        void restoreRememberedMarkdownDestination(response.access_token);
      },
    });
  client.requestAccessToken({ prompt: "" });
  }

  async function forgetThisDevice() {
    if (!workerOrigin || !deviceSession) return;
    if (hasSyncableChanges) {
      toast.error("Sync or clear local changes before forgetting this device.");
      return;
    }

    try {
      const response = await fetch(`${workerOrigin}/session`, {
        method: "DELETE",
        headers: { "X-Vocab-Sync-Session": deviceSession },
      });
      if (!response.ok) throw new Error("forget_device_failed");
      clearLocalDriveSession();
      setConnection(null);
      setSelectedFile(null);
      setLibrary([]);
      setLibraryDirty(false);
      toast.success("This device will need one secure Drive reconnect next time.");
    } catch {
      toast.error("This device could not be forgotten yet. Check the connection and try again.");
    }
  }

  async function disconnectDriveEverywhere() {
    if (!workerOrigin || !deviceSession) return;
    if (hasSyncableChanges) {
      toast.error("Sync or clear local changes before disconnecting Drive everywhere.");
      return;
    }

    try {
      const response = await fetch(`${workerOrigin}/connection`, {
        method: "DELETE",
        headers: { "X-Vocab-Sync-Session": deviceSession },
      });
      if (!response.ok) throw new Error("disconnect_everywhere_failed");
      clearLocalDriveSession();
      setConnection(null);
      setSelectedFile(null);
      setLibrary([]);
      setLibraryDirty(false);
      toast.success("Drive disconnected everywhere. Each device now needs a new secure connection.");
    } catch {
      toast.error("Drive could not be disconnected everywhere yet. Check the connection and try again.");
    }
  }

  async function pickMarkdownFile() {
    if (!connectionReady || !connection) {
      toast.error("Connect Google Drive before choosing a file.");
      return;
    }
    try {
      await loadExternalScript(googlePickerScriptUrl);
    } catch {
      toast.error("Google Drive's file picker could not load. Check your connection and try again.");
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
            await loadMarkdownDestination(connection.token, data.docs[0].id);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not open that file.");
          }
        })
        .build();
      picker.setVisible(true);
    });
  }

  function addManualEntry() {
    const manualEntries = wordsReady.length ? wordsReady.map(word => createEntry(word, "", "", "manual")) : [createEntry("", "", "", "manual")];
    setDrafts(current => [...current, ...manualEntries]);
    setRawWords("");
    toast.success(`${manualEntries.length} editable manual draft${manualEntries.length === 1 ? "" : "s"} added.`);
  }

  function preserveInputAsManualDrafts(reason: string) {
    if (!wordsReady.length) return;
    const manualEntries = wordsReady.map(word => createEntry(word, "", "", "needs-review"));
    const { entries, duplicates } = mergeVocabularyEntries([...library, ...drafts], manualEntries);
    const fresh = entries.slice(library.length + drafts.length);
    if (fresh.length) setDrafts(current => [...current, ...fresh]);
    setRawWords("");
    if (fresh.length) {
      toast.message(`${reason} ${fresh.length} editable draft${fresh.length === 1 ? " was" : "s were"} saved instead.`);
    } else if (duplicates.length) {
      toast.message(`${reason} That input already exists in your Library or review desk.`);
    }
  }

  function updateDraft(id: string, field: keyof Pick<VocabularyEntry, "word" | "meaning" | "example">, value: string) {
    setDrafts(current => current.map(entry => (entry.id === id ? { ...entry, [field]: value } : entry)));
  }

  function removeDraft(id: string) {
    setDrafts(current => current.filter(entry => entry.id !== id));
  }

  function markDraftForReview(id: string) {
    setDrafts(current => current.map(entry => (entry.id === id ? { ...entry, source: "needs-review" } : entry)));
    toast.message("Marked for your review. Edit the fields before syncing.");
  }

  function rateActiveReview(rating: ReviewRating) {
    if (!activeReviewEntry) return;
    const key = entryReviewKey(activeReviewEntry.word);
    const existing = reviewStoreRef.current[key] ?? createInitialReviewMetadata("imported");
    const nextStore = { ...reviewStoreRef.current, [key]: scheduleReview(existing, rating) };
    reviewStoreRef.current = nextStore;
    setReviewStore(nextStore);
    void pushReviewState(nextStore);
    setReviewRevealed(false);
    toast.success(rating === "again" ? "No stress. This word returns in 10 minutes." : "Review scheduled. Your future self says thanks.");
  }

  function exportBackup(format: "markdown" | "csv") {
    const cleanDrafts = drafts.filter(entry => entry.word.trim() && entry.meaning.trim() && entry.example.trim());
    const entries = mergeVocabularyEntries(library, cleanDrafts).entries;
    const content = format === "markdown"
      ? renderVocabularyMarkdown(entries)
      : [
        "Word or Phrase,Simple Meaning,Example",
        ...entries.map(entry => [entry.word, entry.meaning, entry.example]
          .map(value => `"${value.replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
    const blob = new Blob([content], { type: format === "markdown" ? "text/markdown" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = format === "markdown" ? "vocab-sync-backup.md" : "vocab-sync-backup.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${format === "markdown" ? "Markdown" : "CSV"} backup downloaded. Drive was not changed.`);
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
      preserveInputAsManualDrafts("You are offline, so AI could not run.");
      return;
    }
    if (!wordsReady.length) {
      toast.error("Paste at least one word or phrase first.");
      return;
    }
    const openRouterToken = normalizeOpenRouterApiKey(openRouterKey);
    if (!openRouterToken) {
      setSetupExpanded(true);
      preserveInputAsManualDrafts("Add your OpenRouter key to fill these automatically.");
      return;
    }

    setGenerating(true);
    try {
      const requestGeneratedEntries = async () => {
        const { value } = await requestWithFreeModelRouter(async selectedModels => {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterToken}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-OpenRouter-Title": "Vocab Sync",
          },
          body: JSON.stringify({
            models: selectedModels,
            messages: [
              {
                role: "system",
                content: "Return only valid JSON. Create concise vocabulary notes. Aim for a direct simple meaning of about 8 words and one natural example sentence of about 10 words. Keep every meaning and example complete: never stop in the middle of a sentence or phrase. Do not add alternatives or unnecessary detail.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  words: wordsReady,
                  requiredFormat: { entries: [{ word: "", meaning: "", example: "" }] },
                }),
              },
            ],
            response_format: {
              type: "json_object",
            },
            provider: {
              allow_fallbacks: true,
              require_parameters: true,
              sort: { by: "latency", partition: "model" },
            },
            plugins: [{ id: "response-healing" }],
            reasoning: { effort: "low", exclude: true },
            max_tokens: Math.min(300, Math.max(96, wordsReady.length * 48 + 48)),
            temperature: 0.2,
          }),
        });
          if (!response.ok) {
            const failure = await response.json().catch(() => null) as { error?: { message?: unknown; code?: unknown } } | null;
            if (response.status === 401) {
              throw new Error("OpenRouter did not accept the saved key. In Free browser setup, replace it with a fresh key from OpenRouter, then retry. Your words are still safe.");
            }
            const detail = typeof failure?.error?.message === "string"
              ? failure.error.message.replace(/\s+/g, " ").slice(0, 140)
              : "No provider detail was returned.";
            const code = typeof failure?.error?.code === "number" || typeof failure?.error?.code === "string"
              ? ` (${failure.error.code})`
              : "";
            throw new Error(`OpenRouter ${response.status}${code}: ${detail}`);
          }
          const payload = await response.json();
          const parsedEntries = parseGeneratedVocabularyEntries(payload.choices?.[0]?.message?.content);
          if (parsedEntries.length !== wordsReady.length) throw new Error("Model did not return every requested word.");
          return {
            entries: parsedEntries,
            model: typeof payload.model === "string" ? payload.model : "a verified free model",
          };
        });
        return {
          model: value.model,
          entries: value.entries.map(entry => createEntry(entry.word, entry.meaning, entry.example, "ai")),
        };
      };

      const { entries: rawGenerated, model } = await requestGeneratedEntries();
      const generated = rawGenerated.map(entry => {
        const conciseEntry = clampVocabularyEntryToConciseLimits(entry);
        return createEntry(conciseEntry.word, conciseEntry.meaning, conciseEntry.example, "ai");
      });
      if (!generated.length) throw new Error("The free model returned an unusable result. Try again or add entries manually.");
      if (generated.some(entry => !isConciseVocabularyEntry(entry))) {
        throw new Error("The free model returned an incomplete entry. Try again in a moment or add a manual draft.");
      }
      const { entries, duplicates } = mergeVocabularyEntries([...library, ...drafts], generated);
      const fresh = entries.slice(library.length + drafts.length);
      setDrafts(current => [...current, ...fresh]);
      setRawWords("");
      if (duplicates.length) toast.message(`${duplicates.length} duplicate word${duplicates.length === 1 ? " was" : "s were"} skipped.`);
      toast.success(`${fresh.length} draft ${fresh.length === 1 ? "entry" : "entries"} generated with ${model}.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Free generation could not be completed.";
      // If we have words to preserve, do it and show a message rather than a hard error toast
      if (wordsReady.length > 0) {
        preserveInputAsManualDrafts(reason);
      } else {
        toast.error(reason);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function fetchDictionaryEntry(word: string) {
    try {
      const primaryResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!primaryResponse.ok) throw new Error("primary_dictionary_miss");
      return parseInstantDictionaryEntry(await primaryResponse.json(), word);
    } catch {
      const wiktionaryResponse = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
      if (!wiktionaryResponse.ok) throw new Error("dictionary_miss");
      return parseWiktionaryDictionaryEntry(await wiktionaryResponse.json(), word);
    }
  }

  async function captureSmart() {
    if (!wordsReady.length) {
      toast.error("Paste at least one word or phrase first.");
      return;
    }
    if (!isOnline) {
      preserveInputAsManualDrafts("You are offline, so Smart capture could not look this up.");
      return;
    }

    const word = wordsReady[0] ?? "";
    if (wordsReady.length !== 1 || !isOrdinaryEnglishDictionaryWord(word)) {
      toast.message("Smart capture is sending this phrase, batch, or non-English input to AI.");
      await generateEntries();
      return;
    }

    setDictionaryLookingUp(true);
    try {
      const dictionaryEntry = await fetchDictionaryEntry(word);
      const { entries, duplicates } = mergeVocabularyEntries([...library, ...drafts], [
        createEntry(dictionaryEntry.word, dictionaryEntry.meaning, dictionaryEntry.example, "dictionary"),
      ]);
      const fresh = entries.slice(library.length + drafts.length);
      if (!fresh.length) {
        toast.message("That word is already in your Library or review desk.");
        return;
      }
      setDrafts(current => [...current, ...fresh]);
      setRawWords("");
      if (duplicates.length) toast.message(`${duplicates.length} duplicate word was skipped.`);
      toast.success("Dictionary draft added. No AI key or daily AI quota was used.");
      return;
    } catch (error) {
      toast.message("The dictionary could not give a clean result. Trying AI now.");
    } finally {
      setDictionaryLookingUp(false);
    }

    await generateEntries();
  }

  async function runSelectedCaptureMode() {
    if (captureMode === "manual") {
      addManualEntry();
      return;
    }
    if (captureMode === "smart") {
      await captureSmart();
      return;
    }
    await generateEntries();
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
      setReviewStore(current => {
        const next = { ...current };
        for (const entry of cleanDrafts) {
          const key = entryReviewKey(entry.word);
          if (!key) continue;
          next[key] = current[key] ?? createInitialReviewMetadata(entry.source ?? "needs-review");
        }
        return next;
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
              { id: "review", label: "Review", icon: Brain },
              { id: "library", label: "Library", icon: Library },
            ].map(item => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as WorkspaceView)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all ${active ? "bg-[#d9ece8] text-[#184d53] shadow-sm" : "text-[#66748a] hover:bg-[#f0ece3] hover:text-[#273d58]"}`}
                >
                  <Icon size={18} />
                  {item.label}
                  {item.id === "review" && reviewQueue.length > 0 && <span className="ml-auto rounded-full bg-white/75 px-1.5 py-0.5 font-mono text-[10px]">{reviewQueue.length}</span>}
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
                {!isOnline ? "Offline" : restoringDriveSession ? "Restoring Drive" : connectionReady ? "Drive connected" : "Drive not connected"}
              </span>
              <Button variant="outline" onClick={connectGoogleDrive} disabled={restoringDriveSession} className="h-10 rounded-xl border-[#c8d0d8] bg-white/70 px-3 text-xs font-semibold text-[#27415f] hover:bg-white sm:px-4">
                {restoringDriveSession ? <LoaderCircle size={15} className="mr-2 animate-spin" /> : <Cloud size={15} className="mr-2" />} {restoringDriveSession ? "Restoring" : connectionReady ? "Refresh Drive" : deviceSession ? "Restore Drive" : rememberedDestination?.name ? `Resume ${rememberedDestination.name}` : "Connect Drive"}
              </Button>
            </div>
          </header>

          <nav aria-label="Workspace navigation" className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-[#ddd6c8] bg-[#fffdf8]/90 p-2 lg:hidden">
            {[
              { id: "capture", label: "Capture", icon: PenLine },
              { id: "review", label: "Review", icon: Brain },
              { id: "library", label: "Library", icon: Library },
            ].map(item => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as WorkspaceView)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${active ? "bg-[#d9ece8] text-[#184d53]" : "text-[#66748a] hover:bg-[#f0ece3] hover:text-[#273d58]"}`}
                >
                  <Icon size={17} />
                  {item.label}
                  {item.id === "review" && reviewQueue.length > 0 && <span className="rounded-full bg-white/75 px-1.5 py-0.5 font-mono text-[10px]">{reviewQueue.length}</span>}
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
                      <div className="flex items-center gap-2 text-[#22716d]"><Sparkles size={16} /><span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">Choose your method</span></div>
                      <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.025em]">Drop in the words you met today.</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-[#617087]">Smart capture checks an English dictionary first, then uses AI for phrases, unfamiliar words, or misses. If AI cannot answer, your input still becomes an editable draft.</p>
                    </div>
                    <span className="rounded-full bg-[#edf3f7] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#4e637b]">{wordsReady.length} ready</span>
                  </div>
                  <Textarea
                    value={rawWords}
                    onChange={event => setRawWords(event.target.value)}
                    placeholder={"serenity\nepiphany, grit\nword or phrase"}
                    className="mt-6 min-h-[176px] resize-y rounded-2xl border-[#d9d4c8] bg-[#faf8f1] p-4 font-mono text-sm leading-6 shadow-none focus-visible:ring-[#3b768b]"
                  />
                  <div className="mt-5">
                    <button type="button" aria-pressed={captureMode === "smart"} onClick={() => setCaptureMode("smart")} className={`flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-colors ${captureMode === "smart" ? "border-[#22716d] bg-[#e8f5f1] text-[#174f51] shadow-sm" : "border-[#bddbd4] bg-[#f7fbf9] text-[#315f63] hover:border-[#7fb9ad]"}`}>
                      <span><span className="flex items-center gap-2 text-sm font-bold"><BookOpen size={17} /> Smart capture <span className="rounded-full bg-white/75 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]">recommended</span></span><span className="mt-1.5 block text-xs leading-5 opacity-85">Dictionary first, then free AI. Your input is never lost.</span></span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                    <div className="mt-2 flex items-center gap-2"><span className="h-px flex-1 bg-[#e2ddd2]" /><span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#8591a1]">Other ways</span><span className="h-px flex-1 bg-[#e2ddd2]" /></div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {([
                        { id: "manual" as const, label: "Manual", detail: "Write every field yourself", icon: Plus },
                        { id: "ai" as const, label: "Direct AI", detail: "Skip dictionary lookup", icon: Sparkles },
                      ]).map(mode => {
                        const Icon = mode.icon;
                        const active = captureMode === mode.id;
                        return <button key={mode.id} type="button" aria-pressed={active} onClick={() => setCaptureMode(mode.id)} className={`min-h-16 rounded-2xl border p-3 text-left transition-colors ${active ? "border-[#183e66] bg-[#eef4f7] text-[#183e66] shadow-sm" : "border-[#ddd6c8] bg-[#fffdf8] text-[#52657c] hover:border-[#aebfca] hover:bg-[#f8fbfc]"}`}><span className="flex items-center gap-2 text-sm font-bold"><Icon size={16} /> {mode.label}</span><span className="mt-1 block text-[10px] leading-4 opacity-80">{mode.detail}</span></button>;
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#77869a]">{captureMode === "manual" ? "Creates editable blank fields, prefilled with your words." : captureMode === "smart" ? "One simple word tries a clean dictionary first. Phrases and dictionary misses go to AI, then a safe manual draft if needed." : "Uses only the configured free OpenRouter models, then saves an editable draft if free AI is unavailable."}</p>
                    <Button onClick={() => void runSelectedCaptureMode()} disabled={generating || dictionaryLookingUp || (captureMode !== "manual" && !wordsReady.length)} className={`h-11 w-full rounded-xl px-4 text-xs font-bold sm:w-auto ${captureMode === "manual" ? "bg-[#7357a4] hover:bg-[#60488f]" : captureMode === "smart" ? "bg-[#22716d] hover:bg-[#195b58]" : "bg-[#183e66] hover:bg-[#123454]"}`}>
                      {generating || dictionaryLookingUp ? <LoaderCircle size={15} className="mr-2 animate-spin" /> : captureMode === "manual" ? <Plus size={15} className="mr-2" /> : captureMode === "smart" ? <BookOpen size={15} className="mr-2" /> : <Sparkles size={15} className="mr-2" />}
                      {captureMode === "manual" ? "Add manual draft" : captureMode === "smart" ? "Make Smart draft" : "Generate with AI"}
                    </Button>
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
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-semibold text-[#6b82a0]">DRAFT {String(index + 1).padStart(2, "0")}</span>
                              <span className={`rounded-full px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${entry.source === "needs-review" ? "bg-[#fff0ee] text-[#a64e45]" : "bg-[#eef4f2] text-[#32706b]"}`}>{sourceLabel(entry.source ?? "manual")}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {entry.source !== "needs-review" && <button type="button" onClick={() => markDraftForReview(entry.id)} className="min-h-10 rounded-lg px-3 py-1.5 text-[11px] font-bold text-[#7d6134] transition-colors hover:bg-[#fff5df]" aria-label={`Mark ${entry.word || "draft"} as needing your check`}>Needs your check</button>}
                              <button type="button" onClick={() => removeDraft(entry.id)} className="flex min-h-10 min-w-10 items-center justify-center rounded-lg p-2 text-[#8794a5] transition-colors hover:bg-[#fbebea] hover:text-[#b34b43]" aria-label="Remove draft"><X size={16} /></button>
                            </div>
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
                  <p className="mt-4 truncate font-display text-xl font-semibold">{selectedFile?.name ?? rememberedDestination?.name ?? "No file selected"}</p>
                  <p className="mt-2 text-xs leading-5 text-[#c5d5e1]">{selectedFile ? `Last loaded ${new Date(selectedFile.modifiedTime).toLocaleString()}` : rememberedDestination ? "Tap Resume to reload this file from Drive." : connectionReady ? "Choose vocab.md from The Shelf to start syncing." : "Connect Drive first, then choose vocab.md from The Shelf."}</p>
                  <Button variant="secondary" onClick={connectionReady ? pickMarkdownFile : connectGoogleDrive} className="mt-5 h-10 w-full rounded-xl bg-[#f0eee6] text-xs font-bold text-[#183e66] hover:bg-white"><FolderOpen size={15} className="mr-2" /> {connectionReady ? "Choose Markdown file" : "Connect Drive first"}</Button>
                </section>

                <section className="rounded-3xl border border-[#ddd6c8] bg-[#fffdf8] p-5 shadow-[0_12px_30px_rgba(44,57,78,0.04)]">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[#7357a4]"><RefreshCw size={16} /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">Safe sync</span></div><span className="rounded-full bg-[#f2edf8] px-2 py-1 font-mono text-[9px] font-bold text-[#7357a4]">MANUAL</span></div>
                  <p className="mt-3 text-sm leading-6 text-[#576a80]">{selectedFile ? "Every sync checks whether the file changed in Obsidian or Drive. If it did, Vocab Sync blocks the overwrite." : "Connect Drive and choose vocab.md before syncing. Your drafts stay safely in this browser until then."}</p>
                  <Button onClick={syncToDrive} disabled={syncing || !hasSyncableChanges || !isOnline} className="mt-5 h-11 w-full rounded-xl bg-[#22716d] text-xs font-bold text-white hover:bg-[#195b58]">
                    {syncing ? <LoaderCircle size={15} className="mr-2 animate-spin" /> : <Upload size={15} className="mr-2" />} {syncing ? "Checking and syncing" : "Sync to Drive"}
                  </Button>
                </section>

                <section className="rounded-3xl border border-[#e4d8bd] bg-[#fff7e3] p-5">
                  <div className="flex items-center gap-2 text-[#9a6c13]"><TriangleAlert size={16} /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">Free tier rule</span></div>
                  <p className="mt-2 text-xs leading-5 text-[#796131]">Manual creates editable drafts. Smart tries the public dictionary first, then AI if needed. Direct AI stays free-only and never uses paid models.</p>
                </section>

                {workerOrigin && deviceSession && (
                  <section className="rounded-3xl border border-[#d9d2c5] bg-[#f7f3ea] p-5">
                    <div className="flex items-center gap-2 text-[#506279]"><LockKeyhole size={16} /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">Device access</span></div>
                    <p className="mt-2 text-xs leading-5 text-[#63738a]">This device can restore short-lived Drive access without keeping a Google token in browser storage.</p>
                    <Button variant="outline" onClick={forgetThisDevice} disabled={syncing || hasSyncableChanges} className="mt-4 h-10 w-full rounded-xl border-[#cbd4da] bg-white text-xs font-semibold text-[#3f5873] hover:bg-[#f7fafb]">Forget this device</Button>
                    <Button variant="ghost" onClick={disconnectDriveEverywhere} disabled={syncing || hasSyncableChanges} className="mt-2 h-9 w-full rounded-xl text-xs font-semibold text-[#8b554f] hover:bg-[#fbebea] hover:text-[#9f443c]">Disconnect Drive everywhere</Button>
                  </section>
                )}
              </aside>
            </div>
          ) : activeView === "review" ? (
            <Suspense fallback={<div className="mx-auto max-w-3xl pt-7 text-center text-sm text-[#64758a]">Opening your review desk…</div>}>
              <ReviewWorkspace queueLength={reviewQueue.length} syncStatus={reviewSyncStatus} entry={activeReviewEntry} direction={activeReviewDirection} revealed={reviewRevealed} onReveal={() => setReviewRevealed(true)} onRate={rateActiveReview} onCapture={() => setActiveView("capture")} />
            </Suspense>
          ) : (
            <Suspense fallback={<div className="mx-auto max-w-6xl pt-7 text-center text-sm text-[#64758a]">Opening your Library…</div>}>
              <LibraryWorkspace library={library} visibleLibrary={visibleLibrary} reviewStore={reviewStore} search={librarySearch} filter={libraryFilter} reviewSyncStatus={reviewSyncStatus} rememberedFileName={rememberedDestination?.name} onSearch={setLibrarySearch} onFilter={setLibraryFilter} onEdit={updateLibraryEntry} onDelete={deleteLibraryEntry} onExport={exportBackup} onChangeFile={pickMarkdownFile} />
            </Suspense>
          )}

          <section className="mx-auto mt-6 max-w-6xl rounded-2xl border border-[#d8d1c4] bg-[#f3efe5]/80 px-4 py-3 sm:px-5">
            <button onClick={() => setSetupExpanded(current => !current)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 text-xs font-bold text-[#516780]"><KeyRound size={15} /> Free browser setup</span><ChevronRight size={16} className={`text-[#8191a4] transition-transform ${setupExpanded ? "rotate-90" : ""}`} /></button>
            {setupExpanded && <div className="mt-3 border-t border-[#dbd3c5] pt-3 text-xs leading-5 text-[#62748b]"><p>Drive uses a protected server connection. This browser stores only a revocable device session, while Google refresh tokens stay encrypted outside GitHub and browser storage. Add your OpenRouter key below for free-model generation.</p><Button variant="outline" onClick={() => void installHomeScreenApp()} className="mt-3 h-10 rounded-xl border-[#b8cec8] bg-[#f5fbf9] text-xs font-bold text-[#22615d] hover:bg-white"><Download size={15} className="mr-2" />{installPrompt ? "Install Vocab Sync" : "Add Vocab Sync to home screen"}</Button><p className="mt-2 text-[11px] leading-4 text-[#7a899b]">This creates an app-style home-screen shortcut with the Vocab Sync icon. A true interactive phone widget requires a native mobile app.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input type="password" value={openRouterKey} onChange={event => updateRouterKey(event.target.value)} placeholder="OpenRouter API key" className="h-10 flex-1 bg-white text-xs shadow-none" /><label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#cbd4da] bg-white px-3 text-xs font-semibold text-[#3f5873] hover:bg-[#f7fafb]"><input type="checkbox" checked={rememberKey} onChange={event => toggleRememberKey(event.target.checked)} className="h-4 w-4 rounded border-[#8ea0b4] accent-[#22716d]" />Remember key on this device</label></div><p className="mt-2 text-[11px] leading-4 text-[#7a899b]">Use this only on your own locked device. Drive restores silently after a browser restart unless you choose to forget this device.</p></div>}
          </section>
        </main>
      </div>
    </div>
  );
}
