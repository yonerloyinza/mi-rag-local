# Prompt del Asistente

## Ubicación
`backend/main.py:query_rag()` — `prompt_completo` variable

## Estructura

```
Eres un asistente de IA. Responde usando ÚNICAMENTE la información en
[CONOCIMIENTO RECUERDO]. No pidas disculpas, NO empieces diciendo
'No tengo información' si el contexto contiene datos relevantes.
Si [CONOCIMIENTO RECUERDO] está vacío o no contiene información para
responder, di exactamente: 'No tengo información sobre eso.'

[HISTORIAL DE CHAT RECIENTE]
{last 4 messages format}

[NUEVA PREGUNTA]
{user question}

[CONOCIMIENTO RECUERDO]
{context_text or 'VACÍO - No se encontró información relevante.'}

RESPUESTA:
```

## Parameters de Ollama

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| model | llama3.1:8b | Local model |
| stream | true | Token-by-token streaming |
| temperature | 0.3 | Deterministic, less hedging |
| top_p | 0.9 | Foco en tokens más probables |

## Post-procesamiento de respuestas

After streaming completes:

1. **Strip apology prefixes**: `^(Lo siento|Lo lamento|Perd[oó]n|Disculpa|...)`
2. **Strip post-hoc connective**: `^(sin embargo|no obstante)`
3. **Strip self-correction phrases**: `la verdad es que|en realidad`
4. **No-info detection**:
   - Patterns: `no (tengo|dispongo|poseo|cuento)`, `no (información|datos|registros)`
   - If detected AND cleaned answer < 50 chars → don't send sources
5. **Saved answer**: cleaned version stored in `ChatHistory`

## Condense Query

Separate prompt for query rewriting:
- Resolves pronouns/references using chat history
- Returns ONLY the rewritten query (no intro/comments)
- Falls back to original question on error
