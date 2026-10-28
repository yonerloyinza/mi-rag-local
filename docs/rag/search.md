# Búsqueda Híbrida (RRF)

## Algoritmo

1. **Vector search**: Embed question → cosine_distance on `document_chunks.embedding` → top 8 (limited)
2. **Full-text search**: `search_vector @@ to_tsquery('pg_catalog.spanish', query)` → top 8 (filtered by rag_enabled=True)
3. **RRF merge** (k=60):
   ```
   score = Σ (1 / (k + rank + 1))  para cada aparición del chunk
   ```
4. **Threshold filter**: Only chunks with `score >= 1/(k+3)` ≈ 0.0159
5. **Top 3**: Sort by score descending, take top 3

## Configuración

```python
k = 60                    # RRF constant (standard)
vector_limit = 8          # Embedding search top-K
text_limit = 8            # Full-text search top-K
min_rrf_score = 1/(k+3)   # Filter threshold
context_chunks = 3        # Final chunks used for prompt
```

## Modos de búsqueda (`/api/search`)

| Modo | Vector | Full-text | Trigger |
|------|--------|-----------|---------|
| `hybrid` | ✅ | ✅ | Default |
| `semantic` | ✅ | ❌ | `search_mode` param |
| `exact` | ❌ | ✅ | Auto-detectado con comillas `"..."` |

## Filtrado adicional
- `types`: filter by `DocumentChunk.type in types`
- `tags`: filter by tag membership in `DocumentChunk.tags`
- `rag_enabled`: only chunks with `rag_enabled=True`
