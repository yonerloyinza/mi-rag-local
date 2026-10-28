import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Folder, FileText, Bot, User, Loader2, CheckCircle2, Plus,
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
  filename: string;
  type: 'note' | 'document';
  tags: string[];
  rag_enabled: boolean;
  chunks_count: number;
  created_at: string | null;
  updated_at: string | null;
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

type View = 'dashboard' | 'repository' | 'editor' | 'doc_detail';

const TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  note: { icon: FileText, color: 'text-emerald-400' },
  document: { icon: Folder, color: 'text-amber-400' },
};

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [documents, setDocuments] = useState<DocumentDetail[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

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
  const [docTagsInput, setDocTagsInput] = useState('');

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [session_id] = useState(() => `session_${Math.random().toString(36).substring(2, 11)}`);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  const API_BASE = 'http://127.0.0.1:8000/api';

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // --- Data fetching ---
  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_BASE}/items`);
      if (res.ok) setItems(await res.json());
    } catch {
      console.error("Error al listar conocimiento");
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        const allTags = new Set<string>();
        data.documents?.forEach((doc: any) => {
          doc.tags?.forEach((t: string) => allTags.add(t));
        });
        setTags(Array.from(allTags).sort());
      }
    } catch {
      console.error("Error al listar documentos");
    }
  };

  const checkDbHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      setDbConnected(res.ok);
    } catch {
      setDbConnected(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchDocuments();
    checkDbHealth();
  }, []);

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

  // --- Ingest ---
  const saveNoteOrDoc = async (title: string, textContent: string, itemType: 'note' | 'document', itemTags: string[] = []) => {
    if (!title.trim() || !textContent.trim()) return;
    setIngestLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: title.endsWith('.txt') || title.endsWith('.md') ? title : `${title}.md`,
          text: textContent,
          type: itemType,
          tags: itemTags
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`${itemType === 'note' ? 'Nota guardada' : 'Documento cargado'} e indexado (${data.chunks} fragmentos).`);
        if (itemType === 'note') { setNoteTitle(''); setNoteContent(''); }
        else { setDocTitle(''); setDocContent(''); }
        fetchItems();
        fetchDocuments();
        setCurrentView('dashboard');
      } else {
        alert(`Error: ${data.detail || 'Unknown error'}`);
      }
    } catch {
      alert("Error al conectar con el backend.");
    } finally {
      setIngestLoading(false);
    }
  };

  // --- Modal "Nueva Data" ---
  const handleDataSubmit = async () => {
    if (!dataTitle.trim()) {
      alert('El título es requerido');
      return;
    }
    setIngestLoading(true);
    try {
      if (dataMode === 'note') {
        if (!dataContent.trim()) {
          alert('El contenido es requerido');
          return;
        }
        const res = await fetch(`${API_BASE}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: dataTitle.endsWith('.txt') || dataTitle.endsWith('.md') ? dataTitle : `${dataTitle}.md`,
            text: dataContent,
            type: 'note',
            tags: dataTags
          })
        });
        const data = await res.json();
        if (res.ok) {
          alert(`Nota guardada e indexada (${data.chunks} fragmentos).`);
        } else {
          alert(`Error: ${data.detail || 'Unknown error'}`);
        }
      } else {
        if (!dataFile) {
          alert('Selecciona un archivo');
          return;
        }
        const formData = new FormData();
        formData.append('file', dataFile);
        formData.append('filename', dataFile.name);
        formData.append('type', 'document');
        formData.append('tags', dataTags.join(','));
        const res = await fetch(`${API_BASE}/ingest-file`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok) {
          const ext = dataFile.name.split('.').pop()?.toLowerCase();
          const typeLabel = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '') ? 'imagen' :
                            ['pdf'].includes(ext || '') ? 'PDF' :
                            ['md'].includes(ext || '') ? 'markdown' : 'archivo';
          alert(`${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} cargado e indexado (${data.chunks} fragmentos).`);
        } else {
          alert(`Error: ${data.detail || 'Unknown error'}`);
        }
      }
      setDataModalOpen(false);
      setDataTitle('');
      setDataTags([]);
      setDataTagInput('');
      setDataContent('');
      setDataFile(null);
      fetchItems();
      fetchDocuments();
      setCurrentView('dashboard');
    } catch {
      alert("Error al conectar con el backend.");
    } finally {
      setIngestLoading(false);
    }
  };
  const toggleRag = async (filename: string) => {
    try {
      await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}/toggle-rag`, { method: 'PATCH' });
      fetchDocuments();
    } catch (e) {
      console.error("Error toggling RAG:", e);
    }
  };

  const deleteDocument = async (filename: string) => {
    if (!confirm(`¿Eliminar "${filename}" y todos sus vectores?`)) return;
    try {
      await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      fetchItems();
      fetchDocuments();
      if (activeDoc?.filename === filename) {
        setActiveDoc(null);
        setCurrentView('repository');
      }
    } catch (e) {
      console.error("Error deleting document:", e);
    }
  };

  const updateDocTags = async (filename: string, newTags: string[]) => {
    try {
      await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTags)
      });
      fetchDocuments();
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
      const res = await fetch(`${API_BASE}/search`, {
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
      const response = await fetch(`${API_BASE}/query`, {
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
          <div className="max-w-5xl space-y-8">
            <div>
              <h2 className="text-2xl font-black text-white">Panel de Control Global</h2>
              <p className="text-xs text-slate-400 mt-1">
                Salud del sistema RAG y analíticas de conocimiento.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-5">
                  <span className="text-xs text-slate-400 font-medium">Total Documentos</span>
                  <div className="text-3xl font-black text-white mt-2">{documents.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-5">
                  <span className="text-xs text-slate-400 font-medium">Chunks Vectoriales</span>
                  <div className="text-3xl font-black text-white mt-2">
                    {documents.reduce((sum, d) => sum + (d.chunks_count || 0), 0)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-5">
                  <span className="text-xs text-slate-400 font-medium">Estado Conexión DB</span>
                  <div className="flex items-center mt-2">
                    {dbConnected === null ? (
                      <Loader2 size={20} className="animate-spin text-slate-500" />
                    ) : (
                      <>
                        <div className={`w-2 h-2 rounded-full mr-2 ${dbConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className={`text-xs font-medium ${dbConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                          {dbConnected ? 'Conectado' : 'Desconectado'}
                        </span>
                      </>
                    )}
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
                    const Icon = TYPE_ICONS[doc.type]?.icon || FileText;
                    return (
                      <Card
                        key={doc.filename}
                        className="bg-slate-900 border-slate-800 cursor-pointer hover:border-indigo-500 transition-colors"
                        onClick={() => { setActiveDoc(doc as any); fetchLinks(doc.filename); setCurrentView('doc_detail'); }}
                      >
                        <CardContent className="pt-3">
                          <div className="flex items-center gap-2">
                            <Icon size={16} className={TYPE_ICONS[doc.type]?.color || 'text-slate-400'} />
                            <span className="text-xs font-medium text-slate-300 truncate">{doc.filename}</span>
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
          <div className="max-w-5xl flex-1 flex flex-col space-y-5">
            <div>
              <h2 className="text-2xl font-black text-white">Invernadero de Datos</h2>
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
                const Icon = TYPE_ICONS[doc.type]?.icon || FileText;
                return (
                  <Card key={doc.filename} className="bg-slate-900 border-slate-800 hover:border-indigo-500 transition-all">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon size={16} className={TYPE_ICONS[doc.type]?.color || 'text-slate-400'} />
                          <span className="font-medium text-sm text-white truncate">{doc.filename}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                              <MoreVertical size={12} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-slate-900 border-slate-800">
                            <DropdownMenuItem onClick={() => { setActiveDoc(doc as any); setCurrentView('doc_detail'); }}>
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

      case 'editor':
        return (
          <div className="max-w-3xl flex-1 flex flex-col space-y-4">
            <Input
              type="text"
              placeholder="Título de la nota..."
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
              className="text-xl font-bold bg-transparent border-b border-slate-800 rounded-none focus:ring-0 focus:border-indigo-500"
            />
            <div className="flex flex-wrap gap-1">
              {noteTags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  #{tag} <X size={10} className="ml-1 cursor-pointer" onClick={() => setNoteTags(noteTags.filter((_, i) => i !== idx))} />
                </Badge>
              ))}
              <Input
                placeholder="+ Agregar tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter' && tagInput.trim() && !noteTags.includes(tagInput.trim())) {
                    setNoteTags([...noteTags, tagInput.trim()]);
                    setTagInput('');
                  }
                }}
                className="w-36 text-xs h-6"
              />
            </div>
            <Textarea
              placeholder="Empieza a escribir tu conocimiento aquí..."
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              className="flex-1 min-h-[300px]"
            />
            <Button
              onClick={() => saveNoteOrDoc(noteTitle, noteContent, 'note', noteTags)}
              disabled={ingestLoading}
              variant="default"
              className="w-fit ml-auto bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {ingestLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Guardar e Indexar Nota
             </Button>
          </div>
        );

      case 'doc_detail':
        if (!activeDoc) {
          setCurrentView('repository');
          return null;
        }
        return (
          <div className="max-w-3xl flex-1 flex flex-col space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setActiveDoc(null); setCurrentView('repository'); }} className="p-0 h-auto">
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
                <Calendar size={12} />
                Creado: {activeDoc.created_at ? new Date(activeDoc.created_at).toLocaleDateString() : 'Desconocido'}
              </span>
              <span className="flex items-center gap-1">
                <FileText size={12} />
                {activeDoc.chunks_count} chunks
              </span>
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


            <Textarea
              placeholder="Contenido del documento..."
              value={docContent}
              onChange={e => setDocContent(e.target.value)}
              className="flex-1 min-h-[400px]"
            />

            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" className="text-xs">
                Exportar como PDF
              </Button>
              <Button
                onClick={async () => {
                  await updateDocTags(activeDoc.filename, activeDoc.tags || []);
                  setDocContent('');
                  fetchDocuments();
                  setCurrentView('repository');
                }}
                disabled={ingestLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {ingestLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Guardar cambios
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <div className="max-w-3xl flex-1 flex flex-col space-y-4">
            <Input
              type="text"
              placeholder="Título de la nota..."
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
              className="text-xl font-bold bg-transparent border-b border-slate-800 rounded-none focus:ring-0 focus:border-indigo-500"
            />
            <Textarea
              placeholder="Empieza a escribir tu conocimiento aquí..."
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              className="flex-1 min-h-[300px]"
            />
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen flex bg-slate-950 overflow-hidden font-sans">

      {/* Left Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 shrink-0">
        <div className="flex items-center gap-2 px-2 py-3 mb-6">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><NotebookTabs size={18} /></div>
          <span className="font-bold text-sm tracking-tight">Cerebro de Notas AI</span>
        </div>

         <nav className="space-y-1 flex-1">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
              currentView === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Layers size={14} /> Panel de Control
          </button>
          <button
            onClick={() => setCurrentView('repository')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
              currentView === 'repository' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Folder size={14} /> Invernadero de Datos
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
            <Plus size={14} /> Nueva Data
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
                                  setCurrentView('doc_detail');
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
