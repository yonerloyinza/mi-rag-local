import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { toast } from 'sonner';
import {
   Folder, FileText, Database, Bot, User, Loader2, CheckCircle2, Plus,
   Sparkles, Send, Layers, NotebookTabs, Trash2, MessageSquare,
    Search, Tags, ChevronLeft, Edit3, MoreVertical,
    Calendar, Hash, X, FileDown
 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface KnowledgeItem {
  filename: string;
  type: 'note' | 'document';
  tags: string[];
  rag_enabled: boolean;
}

interface DocumentDetail {
  id?: number;
  filename: string;
  type: 'note' | 'document';
  file_path?: string;
  tags: string[];
  rag_enabled: boolean;
  chunks_count: number;
  created_at: string | null;
  updated_at: string | null;
}

interface DocumentContent {
  filename: string;
  content: string;
}

interface SourceInfo {
  id: number;
  filename: string;
  type: string;
  tags: string[];
  preview: string;
}

interface Evaluation {
  faithfulness: number;
  relevance: number;
  reasoning: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceInfo[];
  evaluation?: Evaluation;
  condensedQuery?: string;
  thinking?: boolean;
}

type View = 'dashboard' | 'repository' | 'doc_detail';

const viewFromLocation = (): View => {
  const path = window.location.pathname;
  if (path === '/repository') return 'repository';
  if (path.startsWith('/document/')) return 'doc_detail';
  return 'dashboard';
};

const RiSvg = ({ d, className = 'w-5 h-5' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}><path d={d}/></svg>
);
const RiFilePdf     = ({ className }: { className?: string }) => <RiSvg d="M12 16H8V8H12C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16ZM10 10V14H12C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10H10ZM15 4H5V20H19V8H15V4ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918Z" className={className} />;
const RiFileText    = ({ className }: { className?: string }) => <RiSvg d="M21 8V20.9932C21 21.5501 20.5552 22 20.0066 22H3.9934C3.44495 22 3 21.556 3 21.0082V2.9918C3 2.45531 3.4487 2 4.00221 2H14.9968L21 8ZM19 9H14V4H5V20H19V9ZM8 7H11V9H8V7ZM8 11H16V13H8V11ZM8 15H16V17H8V15Z" className={className} />;
const RiMarkdown     = ({ className }: { className?: string }) => <RiSvg d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM4 5V19H20V5H4ZM7 15.5H5V8.5H7L9 10.5L11 8.5H13V15.5H11V11.5L9 13.5L7 11.5V15.5ZM18 12.5H20L17 15.5L14 12.5H16V8.5H18V12.5Z" className={className} />;
const RiFileCode     = ({ className }: { className?: string }) => <RiSvg d="M15 4H5V20H19V8H15V4ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918ZM17.6569 12L14.1213 15.5355L12.7071 14.1213L14.8284 12L12.7071 9.87868L14.1213 8.46447L17.6569 12ZM6.34315 12L9.87868 8.46447L11.2929 9.87868L9.17157 12L11.2929 14.1213L9.87868 15.5355L6.34315 12Z" className={className} />;
const RiFileExcel    = ({ className }: { className?: string }) => <RiSvg d="M13.2 12L16 16H13.6L12 13.7143L10.4 16H8L10.8 12L8 8H10.4L12 10.2857L13.6 8H15V4H5V20H19V8H16L13.2 12ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918Z" className={className} />;
const RiFileImage    = ({ className }: { className?: string }) => <RiSvg d="M15 8V4H5V20H19V8H15ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918ZM11 9.5C11 10.3284 10.3284 11 9.5 11C8.67157 11 8 10.3284 8 9.5C8 8.67157 8.67157 8 9.5 8C10.3284 8 11 8.67157 11 9.5ZM17.5 17L13.5 10L8 17H17.5Z" className={className} />;
const RiFileWord     = ({ className }: { className?: string }) => <RiSvg d="M16 8V16H14L12 14L10 16H8V8H10V13L12 11L14 13V8H15V4H5V20H19V8H16ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918Z" className={className} />;
const RiFileZip      = ({ className }: { className?: string }) => <RiSvg d="M20 22H4C3.44772 22 3 21.5523 3 21V3C3 2.44772 3.44772 2 4 2H20C20.5523 2 21 2.44772 21 3V21C21 21.5523 20.5523 22 20 22ZM19 20V4H5V20H19ZM14 12V17H10V14H12V12H14ZM12 4H14V6H12V4ZM10 6H12V8H10V6ZM12 8H14V10H12V8ZM10 10H12V12H10V10Z" className={className} />;
const RiFileLine     = ({ className }: { className?: string }) => <RiSvg d="M21 8V20.9932C21 21.5501 20.5552 22 20.0066 22H3.9934C3.44495 22 3 21.556 3 21.0082V2.9918C3 2.45531 3.4487 2 4.00221 2H14.9968L21 8ZM19 9H14V4H5V20H19V9Z" className={className} />;

const TYPE_COLORS: Record<string, string> = {
  note: 'text-emerald-400',
  document: 'text-amber-400',
};

const EXT_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  pdf:  { icon: RiFilePdf,     color: 'text-red-400' },
  txt:  { icon: RiFileText,   color: 'text-slate-300' },
  md:   { icon: RiMarkdown,    color: 'text-emerald-400' },
  csv:  { icon: RiFileExcel,  color: 'text-amber-400' },
  json: { icon: RiFileCode,   color: 'text-purple-400' },
  html: { icon: RiFileCode,   color: 'text-orange-400' },
  htm:  { icon: RiFileCode,   color: 'text-orange-400' },
  js:   { icon: RiFileCode,   color: 'text-purple-400' },
  ts:   { icon: RiFileCode,   color: 'text-purple-400' },
  jpg:  { icon: RiFileImage,  color: 'text-blue-400' },
  jpeg: { icon: RiFileImage,  color: 'text-blue-400' },
  png:  { icon: RiFileImage,  color: 'text-blue-400' },
  gif:  { icon: RiFileImage,  color: 'text-blue-400' },
  webp: { icon: RiFileImage,  color: 'text-blue-400' },
  doc:  { icon: RiFileWord,   color: 'text-blue-500' },
  docx: { icon: RiFileWord,   color: 'text-blue-500' },
  xlsx: { icon: RiFileExcel,  color: 'text-amber-400' },
  zip:  { icon: RiFileZip,    color: 'text-orange-400' },
};

const getDisplayFilename = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0) return filename.slice(0, lastDot);
  return filename;
};

const getDocIcon = (filename: string, docType: string): { icon: React.ElementType; color: string } => {
  if (docType === 'note') return { icon: RiMarkdown, color: 'text-emerald-400' };
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && EXT_ICONS[ext]) return EXT_ICONS[ext];
  return { icon: RiFileLine, color: 'text-slate-400' };
};

export default function App() {
  const [currentView, setCurrentViewState] = useState<View>(viewFromLocation);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [documents, setDocuments] = useState<DocumentDetail[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  const [ingestLoading, setIngestLoading] = useState(false);

  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [dataMode, setDataMode] = useState<'note' | 'document'>('note');
  const [dataTitle, setDataTitle] = useState('');
  const [dataTags, setDataTags] = useState<string[]>([]);
  const [dataTagInput, setDataTagInput] = useState('');
  const [dataContent, setDataContent] = useState('');
  const [dataFile, setDataFile] = useState<File | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'semantic' | 'exact'>('hybrid');
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);
  const [docContent, setDocContent] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [docTagsInput, setDocTagsInput] = useState('');

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [session_id] = useState(() => `session_${Math.random().toString(36).substring(2, 11)}`);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [documentsLoaded, setDocumentsLoaded] = useState<boolean>(false);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const API_BASE = '/api';

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // --- Auth ---
  const navigate = (path: string, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    setPathname(path);
  };

  const clearSession = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAuthChecked(true);
  };

  const refreshSession = async (): Promise<boolean> => {
    // Evita que varias peticiones 401 disparen refrescos en paralelo.
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then(res => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  };

  const fetchCurrentUser = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      let res = await fetch('/auth/me', {
        credentials: 'include',
        signal: controller.signal,
      });
      if (res.status === 401 && await refreshSession()) {
        res = await fetch('/auth/me', {
          credentials: 'include',
          signal: controller.signal,
        });
      }
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const authFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const isAuthRequest = typeof input === 'string' && input.startsWith('/auth/');
    const doFetch = () => fetch(input, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.headers || {}),
      },
    });

    let res = await doFetch();
    if (res.status === 401 && !isAuthRequest) {
      if (await refreshSession()) {
        res = await doFetch();
      }
      if (res.status === 401) {
        clearSession();
        navigate('/login', true);
      }
    }
    return res;
  };

  const login = async (email: string, password: string) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      let detail = 'Credenciales inválidas';
      try {
        const body = await res.json();
        if (body.detail) detail = body.detail;
      } catch {
        // La respuesta no era JSON: conserva el mensaje genérico.
      }
      throw new Error(detail);
    }

    const meRes = await fetch('/auth/me', { credentials: 'include' });
    if (!meRes.ok) throw new Error('No se pudo iniciar la sesión');
    const user = await meRes.json();
    setCurrentUser(user);
    setIsAuthenticated(true);
    setAuthChecked(true);
    setCurrentViewState('dashboard');
    navigate('/', true);
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearSession();
      setItems([]);
      setDocuments([]);
      setTags([]);
      setDocumentsLoaded(false);
      setActiveDoc(null);
      setMessages([]);
      navigate('/login', true);
    }
  };

  const checkAuth = async (): Promise<boolean> => {
    const user = await fetchCurrentUser();
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      setAuthChecked(true);
      return true;
    }
    clearSession();
    return false;
  };

  // --- View + URL sync ---
  const setView = (view: View, filename?: string) => {
    setCurrentViewState(view);
    let path = '/';
    if (view === 'repository') path = '/repository';
    if (view === 'doc_detail' && filename) {
      path = `/document/${encodeURIComponent(filename)}`;
    }
    navigate(path);
  };

  const handleViewChange = (view: View) => {
    if (view === 'dashboard') { setView('dashboard'); return; }
    setView(view);
  };

  // --- Data authFetching ---
  const authFetchItems = async () => {
    try {
      const res = await authFetch(`${API_BASE}/items`);
      if (res.ok) setItems(await res.json());
    } catch {
      console.error("Error al listar conocimiento");
    }
  };

  const authFetchDocuments = async () => {
    try {
      const res = await authFetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        const uniqueDocs = (data.documents || []).filter(
          (doc: any, idx: number, arr: any[]) =>
            arr.findIndex((d: any) => d.filename === doc.filename) === idx
        );
        setDocuments(uniqueDocs);
        const allTags = new Set<string>();
        data.documents?.forEach((doc: any) => {
          doc.tags?.forEach((t: string) => allTags.add(t));
        });
        setTags(Array.from(allTags).sort());
      }
    } catch {
      console.error("Error al listar documentos");
    } finally {
      setDocumentsLoaded(true);
    }
  };

  const authFetchDocContent = async (filename: string) => {
    setDocLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/documents/${encodeURIComponent(filename)}/content`);
      if (res.ok) {
        const data = await res.json() as DocumentContent;
        setDocContent(data.content);
      }
    } catch {
      console.error("Error loading content");
    } finally {
      setDocLoading(false);
    }
  };

  const checkDbHealth = async () => {
    try {
      const res = await authFetch(`${API_BASE}/health`);
      setDbConnected(res.ok);
    } catch {
      setDbConnected(false);
    }
  };
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setPathname(path);
      if (!isAuthenticated) return;

      if (path.startsWith('/document/')) {
        const filename = decodeURIComponent(path.slice('/document/'.length));
        const doc = documents.find(d => d.filename === filename);
        if (doc) {
          setActiveDoc(doc as any);
          authFetchDocContent(filename);
          setCurrentViewState('doc_detail');
        } else {
          navigate('/repository', true);
          setCurrentViewState('repository');
        }
      } else if (path === '/repository') {
        setCurrentViewState('repository');
      } else if (path === '/login' || path === '/register') {
        // El efecto de rutas de autenticación redirige a la vista principal.
        return;
      } else {
        setCurrentViewState('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [documents, isAuthenticated]);

  // --- Check auth FIRST on mount, before any rendering ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const authenticated = await checkAuth();
      if (cancelled || !authenticated) return;
      authFetchItems();
      authFetchDocuments();
      checkDbHealth();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mantiene la URL y la vista sincronizadas, incluso después de recargar.
  useEffect(() => {
    if (!authChecked) return;

    if (!isAuthenticated) {
      if (pathname !== '/login' && pathname !== '/register') {
        navigate('/login', true);
      }
      return;
    }

    if (pathname === '/login' || pathname === '/register') {
      navigate('/', true);
      return;
    }

    if (pathname === '/repository') {
      setCurrentViewState('repository');
      return;
    }

    if (pathname.startsWith('/document/')) {
      // Try to restore document detail view.
      // We check if documents have data; if not, we'll try on next cycle.
      if (documents.length === 0) {
        // Documents still loading, don't redirect yet.
        // The popstate handler or a later effect call will try again.
        return;
      }
      const filename = decodeURIComponent(pathname.slice('/document/'.length));
      const doc = documents.find(d => d.filename === filename);
      if (doc) {
        setActiveDoc(doc as any);
        authFetchDocContent(filename);
        setCurrentViewState('doc_detail');
      } else {
        // Documento no en la lista actual - ir a repository.
        // El usuario podrá abrirlo de nuevo desde el repositorio.
        navigate('/repository', true);
        setCurrentViewState('repository');
      }
      return;
    }

    setCurrentViewState('dashboard');
  }, [authChecked, isAuthenticated, pathname, documentsLoaded, documents]);

  useEffect(() => {
    if (aiOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [aiOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && e.ctrlKey) {
        e.preventDefault();
        setAiOpen(true);
        setTimeout(() => chatInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && aiOpen) {
        setAiOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiOpen]);

  useLayoutEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Modal "Nueva Data" ---
  const handleDataSubmit = async () => {
    if (!dataTitle.trim()) {
      toast('El título es requerido');
      return;
    }
    setIngestLoading(true);
    try {
      if (dataMode === 'note') {
        if (!dataContent.trim()) {
          toast('El contenido es requerido');
          return;
        }
        const res = await authFetch(`${API_BASE}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: dataTitle.endsWith('.md') ? dataTitle : `${dataTitle.replace(/\.txt$/, '')}.md`,
            text: dataContent,
            type: 'note',
            tags: dataTags
          })
        });
        const data = await res.json();
        if (res.ok) {
          toast(`Nota guardada e indexada (${data.chunks} fragmentos.)`);
        } else {
          toast.error(`Error: ${data.detail || 'Unknown error'}`);
        }
      } else {
        if (!dataFile) {
          toast('Selecciona un archivo');
          return;
        }
        const formData = new FormData();
        formData.append('file', dataFile);
        formData.append('filename', dataFile.name);
        formData.append('type', 'document');
        formData.append('tags', dataTags.join(','));
        const res = await authFetch(`${API_BASE}/ingest-file`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok) {
          const ext = dataFile.name.split('.').pop()?.toLowerCase();
          const typeLabel = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '') ? 'imagen' :
                            ['pdf'].includes(ext || '') ? 'PDF' :
                            ['md'].includes(ext || '') ? 'markdown' : 'archivo';
          toast(`${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} cargado e indexado (${data.chunks} fragmentos.)`);
        } else {
          toast.error(`Error: ${data.detail || 'Unknown error'}`);
        }
      }
      setDataModalOpen(false);
      setDataTitle('');
      setDataTags([]);
      setDataTagInput('');
      setDataContent('');
      setDataFile(null);
      authFetchItems();
      authFetchDocuments();
      setView('dashboard');
    } catch {
      toast("Error al conectar con el backend.");
      setDataModalOpen(false);
    } finally {
      setIngestLoading(false);
    }
  };
  const toggleRag = async (filename: string) => {
    try {
      await authFetch(`${API_BASE}/documents/${encodeURIComponent(filename)}/toggle-rag`, { method: 'PATCH' });
      authFetchDocuments();
    } catch (e) {
      console.error("Error toggling RAG:", e);
    }
  };

  const deleteDocument = async (filename: string) => {
    if (!confirm(`¿Eliminar "${filename}" y todos sus vectores?`)) return;
    try {
      await authFetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      authFetchItems();
      authFetchDocuments();
      if (activeDoc?.filename === filename) {
        setActiveDoc(null);
        setView('repository');
      }
    } catch (e) {
      console.error("Error deleting document:", e);
    }
  };

  const updateDocTags = async (filename: string, newTags: string[]) => {
    try {
      await authFetch(`${API_BASE}/documents/${encodeURIComponent(filename)}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTags)
      });
      authFetchDocuments();
    } catch (e) {
      console.error("Error updating tags:", e);
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          search_mode: searchMode === 'exact' ? 'exact' : searchMode === 'semantic' ? 'semantic' : 'hybrid',
          types: activeTypes.length > 0 ? activeTypes : [],
          tags: activeTags.length > 0 ? activeTags : [],
          limit: 12
        })
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.error("Error searching:", e);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (question.trim() && !chatLoading) {
        const form = e.currentTarget.form;
        form?.requestSubmit();
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // --- Chat ---
  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || chatLoading) return;

    const userQuestion = question;
    setQuestion('');
    setChatLoading(true);

    const assistantIndex = messages.length + 1;
    const newMessages = [...messages,
      { role: 'user', content: userQuestion } as Message,
      { role: 'assistant', content: '', thinking: true } as Message,
    ];
    setMessages(newMessages);

    try {
      const response = await authFetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion, session_id }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullAnswer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (currentEvent === 'sources') {
                newMessages[assistantIndex].sources = parsed;
              } else if (currentEvent === 'condensed_query') {
                newMessages[assistantIndex].condensedQuery = parsed.query;
              } else if (currentEvent === 'token') {
                if (newMessages[assistantIndex].thinking) {
                  newMessages[assistantIndex].thinking = false;
                }
                fullAnswer += parsed.token;
                newMessages[assistantIndex].content = fullAnswer;
              } else if (currentEvent === 'evaluation') {
                newMessages[assistantIndex].evaluation = parsed;
              } else if (currentEvent === 'error') {
                newMessages[assistantIndex].content = `❌ Error: ${parsed.detail || 'Error desconocido'}`;
              }
              setMessages([...newMessages]);
            } catch {}
          }
        }
      }
    } catch {
      newMessages[assistantIndex].content = '❌ Error: No se pudo conectar con el backend.';
      setMessages([...newMessages]);
    } finally {
      setChatLoading(false);
    }
  };

  const renderCenterView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div data-testid="dashboard-view" className="max-w-5xl space-y-8">
            <div>
              <h2 className="text-2xl font-black text-white">Panel de Control Global</h2>
              <p className="text-xs text-slate-400 mt-1">
                Salud del sistema RAG y analíticas de conocimiento.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-5 flex items-center gap-4">
                  <Folder size={32} className="text-indigo-400" />
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Total Documentos</span>
                    <div className="text-3xl font-black text-white mt-1">{documents.length}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-5 flex items-center gap-4">
                  <Layers size={32} className="text-amber-400" />
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Chunks Vectoriales</span>
                    <div className="text-3xl font-black text-white mt-1">
                      {documents.reduce((sum, d) => sum + (d.chunks_count || 0), 0)}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-5 flex items-center gap-4">
                  <Database size={32} className={dbConnected ? 'text-emerald-400' : 'text-red-400'} />
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Estado Conexión DB</span>
                    <div className="flex items-center mt-1">
                      {dbConnected === null ? (
                        <Loader2 size={20} className="animate-spin text-slate-500" />
                      ) : (
                        <span className={`text-sm font-medium ${dbConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                          {dbConnected ? 'Conectado' : 'Desconectado'}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {tags.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-300">Tags Populares</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 12).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs py-1 px-3 cursor-pointer hover:bg-slate-700">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {documents.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-300">Acceso Rápido Reciente</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {documents.slice(0, 4).map(doc => {
                    const { icon: Icon, color: iconColor } = getDocIcon(doc.filename, doc.type);
                    return (
                      <Card
                        key={doc.filename}
                        data-testid={`doc-card-${doc.filename}`}
                        className="bg-slate-900 border-slate-800 cursor-pointer hover:border-indigo-500 transition-colors"
                        onClick={() => { setActiveDoc(doc as any); authFetchDocContent(doc.filename); setView('doc_detail', doc.filename); }}
                      >
                        <CardContent className="pt-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-5 h-5 ${iconColor}`} />
                            <span className="text-xs font-medium text-slate-300 truncate">{getDisplayFilename(doc.filename)}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {doc.chunks_count} chunks
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'repository':
        return (
          <div data-testid="repository-view" className="max-w-5xl flex-1 flex flex-col space-y-5">
            <div>
              <h2 className="text-2xl font-black text-white">Activos de Información</h2>
              <p className="text-xs text-slate-400 mt-1">Tu repositorio de conocimiento indexado.</p>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Buscar notas, documentos o tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && runSearch()}
                className="pl-10 bg-slate-900 border-slate-800 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex gap-1">
                {(
                  <>
                    <Button
                      size="sm"
                      variant={searchMode === 'hybrid' ? 'default' : 'outline'}
                      onClick={() => setSearchMode('hybrid')}
                      className="text-xs"
                    >
                      Híbrido (Recomendado)
                    </Button>
                    <Button
                      size="sm"
                      variant={searchMode === 'semantic' ? 'default' : 'outline'}
                      onClick={() => setSearchMode('semantic')}
                      className="text-xs"
                    >
                      Solo Semántico
                    </Button>
                    <Button
                      size="sm"
                      variant={searchMode === 'exact' ? 'default' : 'outline'}
                      onClick={() => setSearchMode('exact')}
                      className="text-xs"
                    >
                      Palabra Exacta (Ctrl+F)
                    </Button>
                  </>
                )}
              </div>

              {searchResults.length > 0 && (
                <>
                  <Button size="sm" variant="ghost" onClick={runSearch} className="text-xs">
                    <Search size={12} className="mr-1" /> Buscar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSearchResults([]); setSearchQuery(''); }} className="text-xs">
                    Limpiar
                  </Button>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(searchResults.length > 0 ? searchResults : documents).map(doc => {
                const { icon: Icon, color: iconColor } = getDocIcon(doc.filename, doc.type);
                return (
                  <Card
                    key={doc.filename}
                    data-testid={`doc-card-${doc.filename}`}
                    className="bg-slate-900 border-slate-800 hover:border-indigo-500 transition-all cursor-pointer"
                    onClick={() => { setActiveDoc(doc as any); authFetchDocContent(doc.filename); setView('doc_detail', doc.filename); }}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <Icon className={`w-5 h-5 ${iconColor}`} />
                            <span className="font-medium text-sm text-white truncate">{getDisplayFilename(doc.filename)}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical size={12} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-slate-900 border-slate-800">
                            <DropdownMenuItem onClick={() => { setActiveDoc(doc as any); authFetchDocContent(doc.filename); setView('doc_detail', doc.filename); }}>
                              <Edit3 size={14} className="mr-2" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteDocument(doc.filename)} className="text-red-400">
                              <Trash2 size={14} className="mr-2" />Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {doc.tags.map((t: string) => (
                            <Badge key={t} variant="outline" className="text-[10px] py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {searchResults.length > 0 && doc.preview && (
                        <p className="text-[10px] text-slate-500 line-clamp-2">
                          "{doc.preview}"
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={doc.rag_enabled}
                            onCheckedChange={() => toggleRag(doc.filename)}
                            className="h-3 w-5"
                          />
                          <span className="text-[10px] text-slate-500">
                            {doc.rag_enabled ? 'RAG activado' : 'RAG desactivado'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <FileText size={10} />
                          {doc.chunks_count} chunks
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );

      case 'doc_detail':
        if (!activeDoc) {
          return (
            <div className="flex-1 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Cargando documento...
            </div>
          );
        }
        return (
          <div className="max-w-3xl flex-1 flex flex-col space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setActiveDoc(null); setView('repository'); }} className="p-0 h-auto">
                <ChevronLeft size={16} className="text-slate-400" />
              </Button>
              <span className="text-xs text-slate-500">Volver al repositorio</span>
            </div>

            <Input
              type="text"
              placeholder="Título del documento..."
              value={activeDoc.filename}
              onChange={e => setActiveDoc({ ...activeDoc, filename: e.target.value })}
              className="text-xl font-bold bg-transparent border-b border-slate-800 rounded-none focus:ring-0 focus:border-indigo-500"
            />

            <div className="flex flex-wrap gap-1">
              {(activeDoc.tags || []).map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  #{tag} <X size={10} className="ml-1 cursor-pointer" onClick={() => {
                    const newTags = activeDoc.tags.filter((_, i) => i !== idx);
                    setActiveDoc({ ...activeDoc, tags: newTags });
                  }} />
                </Badge>
              ))}
              <Input
                placeholder="+ Agregar tag..."
                value={docTagsInput}
                onChange={e => setDocTagsInput(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter' && docTagsInput.trim() && !(activeDoc.tags || []).includes(docTagsInput.trim())) {
                    const newTags = [...(activeDoc.tags || []), docTagsInput.trim()];
                    setActiveDoc({ ...activeDoc, tags: newTags });
                    setDocTagsInput('');
                  }
                }}
                className="w-36 text-xs h-6"
              />
               </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-1">
                                <Calendar size={14} />
                Creado: {activeDoc.created_at ? new Date(activeDoc.created_at).toLocaleDateString() : 'Desconocido'}
              </span>
              <span className="flex items-center gap-1">
                                <FileText size={14} />
                {activeDoc.chunks_count} chunks
              </span>
              {activeDoc.file_path && (
                <span className="flex items-center gap-1">
                                <FileDown size={14} />
                  <a href={`${API_BASE}/documents/${encodeURIComponent(activeDoc.filename)}/download`} className="hover:underline">Descargar original</a>
                </span>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Switch
                  checked={activeDoc.rag_enabled}
                  onCheckedChange={() => {
                    setActiveDoc({ ...activeDoc, rag_enabled: !activeDoc.rag_enabled });
                    toggleRag(activeDoc.filename);
                  }}
                />
                <span className="text-xs">{activeDoc.rag_enabled ? 'RAG activado' : 'RAG desactivado'}</span>
              </div>
            </div>

            {activeDoc.type === 'note' && (
              <Textarea
                placeholder="Contenido de la nota (Markdown soportado)..."
                value={docContent}
                onChange={e => setDocContent(e.target.value)}
                className="flex-1 min-h-[300px] bg-slate-900 border-slate-800 font-mono text-sm resize-y"
              />
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline" size="sm"
                onClick={() => { setActiveDoc(null); setView('repository'); }}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (activeDoc.type === 'note') {
                    await authFetch(`${API_BASE}/ingest`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        filename: activeDoc.filename,
                        text: docContent,
                        type: 'note',
                        tags: activeDoc.tags || []
                      })
                    });
                  }
                  await updateDocTags(activeDoc.filename, activeDoc.tags || []);
                  authFetchDocuments();
                   setView('repository');
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <CheckCircle2 size={14} /> Guardar
              </Button>
            </div>
          </div>
        );
      }
  };

  // --- Auth loading ---
  const renderAuthLoadingView = () => (
    <div data-testid="auth-loading" className="h-screen w-screen flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
      <Loader2 size={28} className="animate-spin text-indigo-500" />
      <span className="text-sm">Comprobando sesión...</span>
    </div>
  );

  // --- Login View ---
  const renderLoginView = () => (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-indigo-600 p-2 rounded-lg inline-block mb-4">
            <NotebookTabs size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Cerebro de Notas AI</h2>
          <p className="text-slate-400">Inicia sesión para continuar</p>
        </div>

        <form
          data-testid="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const email = (form.elements.namedItem('email') as HTMLInputElement).value;
            const password = (form.elements.namedItem('password') as HTMLInputElement).value;
            try {
              await login(email, password);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Error de autenticación');
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Correo electrónico</label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="usuario@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Contraseña</label>
            <input
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Iniciar sesión
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          ¿No tienes cuenta? <button
            type="button"
            onClick={() => navigate('/register')}
            className="text-indigo-400 hover:underline ml-1"
          >Regístrate aquí</button>
        </div>
      </div>
    </div>
  );

  // --- Register View ---
  const renderRegisterView = () => (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-indigo-600 p-2 rounded-lg inline-block mb-4">
            <NotebookTabs size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Crear cuenta</h2>
          <p className="text-slate-400">Regístrate para comenzar</p>
        </div>

        <form
          data-testid="register-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const email = (form.elements.namedItem('email') as HTMLInputElement).value;
            const username = (form.elements.namedItem('username') as HTMLInputElement).value;
            const password = (form.elements.namedItem('password') as HTMLInputElement).value;
            const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value;
            try {
              const res = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password, full_name: fullName }),
              });
              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Error al registrar');
              }
              await login(email, password);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Error al registrar');
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Correo electrónico</label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="usuario@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nombre de usuario</label>
            <input
              name="username"
              type="text"
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="miusuario"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Contraseña</label>
            <input
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nombre completo (opcional)</label>
            <input
              name="fullName"
              type="text"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Juan Pérez"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Crear cuenta
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
          ¿Ya tienes cuenta? <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-indigo-400 hover:underline ml-1"
          >Inicia sesión</button>
        </div>
      </div>
    </div>
  );

  // --- Main render ---
  if (!authChecked) {
    return renderAuthLoadingView();
  }

  if (!isAuthenticated) {
    const isRegisterPath = pathname === '/register';
    return isRegisterPath ? renderRegisterView() : renderLoginView();
  }

  return (
    <div data-testid="app-shell" className="h-screen w-screen flex bg-slate-950 overflow-hidden font-sans">

      {/* Left Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 shrink-0">
        <div className="flex items-center gap-2 px-2 py-3 mb-6">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><NotebookTabs size={18} /></div>
          <span className="font-bold text-sm tracking-tight">Cerebro de Notas AI</span>
        </div>

         <nav className="space-y-1 flex-1">
          <button
            onClick={() => handleViewChange('dashboard')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
              currentView === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
             <Layers size={20} /> Panel de Control
          </button>
          <button
            onClick={() => handleViewChange('repository')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
              currentView === 'repository' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
             <Folder size={20} /> Activos de Información
          </button>
        </nav>

        <div className="mt-4 space-y-1">
          <button
            onClick={() => {
              setDataModalOpen(true);
              setDataMode('note');
              setDataTitle('');
              setDataTags([]);
              setDataTagInput('');
              setDataContent('');
              setDataFile(null);
            }}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
          >
            <Plus size={16} /> Nueva Data
          </button>
        </div>

        {tags.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-4 mb-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2 block">
              Tags del Sistema
            </span>
            <div className="flex flex-wrap gap-1 px-2">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] cursor-pointer">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Base de datos</span>
            <span className={`font-medium ${dbConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {dbConnected ? 'Conectada' : 'Desconectada'}
            </span>
          </div>
          <Button
            onClick={() => setAiOpen(!aiOpen)}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white py-2.5 text-xs font-bold shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            {aiOpen ? 'Cerrar Copiloto' : 'Invocar Copiloto AI'}
          </Button>
          <div className="flex items-center gap-2 px-2 py-2 text-xs">
            <User size={14} className="text-slate-400" />
            <span className="text-slate-300 truncate">{currentUser?.username || currentUser?.email}</span>
          </div>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
          >
            <X size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Center Panel */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-y-auto p-8">
        {renderCenterView()}
      </main>

      {/* Right Sidebar (AI Copilot) */}
      <aside className={`border-l border-slate-800 flex flex-col transition-all duration-300 bg-slate-900 shrink-0 h-screen ${
        aiOpen ? 'w-96' : 'w-0 overflow-hidden'
      }`}>
        {aiOpen && (
          <>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" /> Copiloto Inteligente (SSE)
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
                  <MessageSquare size={12} className="mr-1" />
                  {messages.filter(m => m.role === 'user').length} en contexto
                </Badge>
                {messages.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearChat}
                    className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                    title="Limpiar chat"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <Bot size={36} className="text-slate-700 mb-3" />
                  <p className="text-xs text-slate-500 max-w-xs">
                    Pregúntale al copiloto sobre tus notas o documentos cargados. Posee memoria conversacional activa.
                  </p>
                  <p className="text-[10px] text-slate-600 mt-2">
                    Ctrl + / para enfocar &nbsp;|&nbsp; Esc para cerrar &nbsp;|&nbsp; Enter = enviar, Shift+Enter = salto
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`p-3 rounded-xl space-y-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-slate-800 ml-auto max-w-[85%]'
                      : 'bg-slate-950/40 border border-slate-800 max-w-[90%]'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {msg.role === 'user' ? <User size={12} /> : <Bot size={12} className="text-indigo-400" />}
                      <span className="font-semibold text-slate-400">
                        {msg.role === 'user' ? 'Tú' : 'Llama 3 RAG'}
                      </span>
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {msg.thinking ? (
                        <span className="inline-flex items-center gap-1 text-slate-500 italic">
                          <Loader2 size={10} className="animate-spin" />
                          pensando...
                        </span>
                      ) : msg.content || '\u00a0'}
                    </p>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Fuentes:</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.map(s => (
                            <Badge key={s.id} variant="default" className="text-[10px] cursor-pointer hover:bg-slate-700"
                              onClick={() => {
                                const doc = documents.find(d => d.filename === s.filename);
                                if (doc) {
                                  setActiveDoc(doc as any);
                                  setDocContent('');
                                  setView('doc_detail', doc.filename);
                                }
                              }}
                            >
                              [{s.id}] {s.filename}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.condensedQuery && (
                      <div className="pt-1.5">
                        <p className="text-[10px] text-slate-500 italic">
                          🔍 Consulta purificada: "{msg.condensedQuery}"
                        </p>
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.evaluation && (
                      <div className="pt-2 border-t border-slate-800/40">
                        <div className="flex gap-3">
                          <Badge variant={msg.evaluation.faithfulness >= 4 ? 'success' : 'destructive'}>
                            Fidelidad: {msg.evaluation.faithfulness}/5
                          </Badge>
                          <Badge variant={msg.evaluation.relevance >= 4 ? 'success' : 'destructive'}>
                            Relevancia: {msg.evaluation.relevance}/5
                          </Badge>
                        </div>
                        {msg.evaluation.reasoning && (
                          <p className="text-[10px] text-slate-500 mt-1 italic">
                            "{msg.evaluation.reasoning}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800">
              <form onSubmit={handleQuery} className="flex gap-2">
                <Textarea
                  ref={chatInputRef}
                  placeholder="Pregúntale a tu conocimiento... (Enter = enviar, Shift+Enter = salto de línea)"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  disabled={chatLoading}
                  className="flex-1 text-xs bg-slate-950 border-slate-800 resize-none min-h-[40px] max-h-32"
                  rows={1}
                />
                <Button type="submit" disabled={!question.trim() || chatLoading} size="sm" variant="default">
                  <Send size={16} />
                </Button>
              </form>
            </div>
          </>
        )}
      </aside>

      {/* Modal: Nueva Data */}
      {dataModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setDataModalOpen(false); }}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Plus size={16} /> Nueva Data
              </h3>
              <button
                onClick={() => setDataModalOpen(false)}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setDataMode('note')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    dataMode === 'note'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Edit3 size={14} /> Nota
                </button>
                <button
                  onClick={() => setDataMode('document')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    dataMode === 'document'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }"`}
                >
                  <FileDown size={14} /> Archivo
                </button>
              </div>

              <Input
                type="text"
                placeholder="Título"
                value={dataTitle}
                onChange={e => setDataTitle(e.target.value)}
                className="text-sm"
              />

              <div className="flex flex-wrap gap-1">
                {dataTags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    #{tag}
                    <X size={10} className="ml-1 cursor-pointer" onClick={() => setDataTags(dataTags.filter((_, i) => i !== idx))} />
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="+ Agregar tag..."
                value={dataTagInput}
                onChange={e => setDataTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && dataTagInput.trim() && !dataTags.includes(dataTagInput.trim())) {
                    setDataTags([...dataTags, dataTagInput.trim()]);
                    e.currentTarget.value = '';
                    setDataTagInput('');
                  }
                }}
                className="text-xs h-8"
              />

              {dataMode === 'note' ? (
                <Textarea
                  placeholder="Contenido de la nota..."
                  value={dataContent}
                  onChange={e => setDataContent(e.target.value)}
                  className="min-h-[120px] text-xs"
                />
              ) : (
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.html,.csv,.json,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={e => setDataFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="data-file-input"
                  />
                  <label htmlFor="data-file-input" className="cursor-pointer">
                    <FileDown size={24} className="mx-auto text-slate-500 mb-2" />
                    <p className="text-xs text-slate-400">
                      {dataFile ? dataFile.name : 'Haz clic para seleccionar un archivo'}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      PDF, MD, TXT, CSV, JSON, imágenes
                    </p>
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDataModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleDataSubmit}
                disabled={ingestLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500"
              >
                {ingestLoading ? (
                  <><Loader2 size={12} className="animate-spin mr-1" /> Indexando...</>
                ) : (
                  <>Guardar</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
