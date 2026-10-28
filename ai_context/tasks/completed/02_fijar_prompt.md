# Task: Fijar prompt y calidad de respuesta
Status: COMPLETADA
Fecha: 2026-10-28

## Logros
- Agregado `import re` (fix NameError)
- Prompt reescrito: instrucciones anti-disculpas
- Post-procesamiento: strip apology prefixes, no-info detection
- Sources enviados after stream (no antes)
- RRF threshold: 1/(k+3) para filtrar chunks no relevantes
- temperature=0.3, top_p=0.9 para deterministic responses

## Archivos modificados
- backend/main.py (prompt_completo, sse_generator, RRF threshold)
