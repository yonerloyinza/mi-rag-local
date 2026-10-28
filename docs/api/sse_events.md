# Eventos SSE

## Endpoint: `POST /api/query`

Content-Type: `text/event-stream`

Los eventos se envían en este orden:

| Evento | Timing | Payload | Frontend usa para |
|--------|--------|---------|-------------------|
| `condensed_query` | Antes del stream | `{query: "..."}` | Mostrar "Consulta purificada" en card del asistente |
| `token` | Durante stream | `{token: "..."}` | Acumular `fullAnswer`, renderizar en card del asistente |
| `sources` | Después del stream | `SourceInfo[]` | Mostrar badges de fuentes (solo si relevantes) |
| `evaluation` | Al final | `{faithfulness, relevance, reasoning}` | Mostrar badges de evaluación |
| `error` | On exception | `{detail: "..."}` | Mostrar error en card del asistente |

## Frontend SSE Handler

```typescript
// Event order is flexible — handler uses stateful updates
// Assistant message index is ALWAYS messages.length + 1
const assistantIndex = messages.length + 1;

// Sources sent AFTER streaming (not before)
// Empty array = "no info" response detected
// Non-empty = filtered by RRF score >= 1/(k+3)
```

## No-Info Detection

After streaming completes, backend checks:
1. Strip apology prefixes: "Lo siento", "Perdón", "Disculpa"
2. Check for no-info patterns: "no tengo información", "no dispongo", "no encontré"
3. If detected AND stripped answer < 50 chars → send empty sources array
4. Otherwise → send filtered sources_data
