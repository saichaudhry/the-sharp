// "The Desk": chat with one of the four characters. Each keeps its own thread.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { PERSONAS, personaById } from '../personas.js';
import Face, { moodFor } from './Face.jsx';

const MAX_CHARS = 500; // matches api/chat.js
const QUICK_PROMPTS = ['Roast my record.', 'Who should I take this week?', 'Grade my last pick.', 'Explain what 54¢ means.'];
const PERSONA_KEY = 'the-sharp:persona';
const savedPersona = () => {
  try { return personaById(localStorage.getItem(PERSONA_KEY)).id; } catch { return 'lou'; }
};

export default function Desk({ stats, picks, draft, onDraftUsed }) {
  const [persona, setPersona] = useState(savedPersona);
  const [threads, setThreads] = useState({}); // persona id -> messages (undefined = not loaded)
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const contextRef = useRef(null); // which game the next question is about, if any
  const p = personaById(persona);
  const messages = threads[persona];

  useEffect(() => {
    try { localStorage.setItem(PERSONA_KEY, persona); } catch { /* ignore */ }
    if (threads[persona]) return;
    api(`chat?persona=${persona}`)
      .then((d) => setThreads((t) => ({ ...t, [persona]: d.messages })))
      .catch(() => setThreads((t) => ({ ...t, [persona]: [] })));
  }, [persona]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Ask" buttons elsewhere pre-fill the box (and can pick a character).
  useEffect(() => {
    if (!draft) return;
    if (draft.persona) setPersona(draft.persona);
    setInput(draft.text);
    contextRef.current = draft.context;
    onDraftUsed();
    inputRef.current?.focus();
  }, [draft, onDraftUsed]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    const who = persona;
    const context = contextRef.current;
    contextRef.current = null;
    setBusy(true);
    setError(null);
    setInput('');
    setThreads((t) => ({ ...t, [who]: [...(t[who] || []), { role: 'user', content: message }] }));
    try {
      const { reply } = await api('chat', { method: 'POST', body: { message, persona: who, ...(context && { context }) } });
      setThreads((t) => ({ ...t, [who]: [...t[who], { role: 'assistant', content: reply }] }));
    } catch (err) {
      setThreads((t) => ({ ...t, [who]: t[who].slice(0, -1) })); // put their message back
      setInput(message);
      contextRef.current = context;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const mood = busy ? 'thinking' : moodFor(stats, picks);

  return (
    <section className="desk" style={{ '--p': p.color }}>
      <div className="desk-switch" role="tablist" aria-label="Choose who to talk to">
        {PERSONAS.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === persona} className={x.id === persona ? 'on' : ''}
            style={{ '--p': x.color }} onClick={() => setPersona(x.id)} disabled={busy} title={x.full}>
            <Face persona={x} size={36} mood={x.id === persona ? mood : 'neutral'} />
            <span>{x.name}</span>
          </button>
        ))}
      </div>

      <div className="desk-head">
        <Face persona={p} mood={mood} size={44} />
        <div>
          <strong>{p.full}</strong>
          <div className="muted small">{busy ? 'thinking…' : p.title}</div>
        </div>
      </div>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages === undefined && <div className="spinner small" />}
        {messages?.length === 0 && <div className="bubble assistant">{p.hello}</div>}
        {messages?.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.content}</div>)}
        {busy && <div className="bubble assistant typing"><span /><span /><span /></div>}
      </div>

      {messages?.length < 4 && !busy && (
        <div className="quick-prompts">
          {QUICK_PROMPTS.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <textarea
          ref={inputRef}
          rows={1}
          placeholder={`Ask ${p.name}…`}
          maxLength={MAX_CHARS}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
        />
        <button className="btn primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </section>
  );
}
