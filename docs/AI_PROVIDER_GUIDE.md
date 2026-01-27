# AI Provider Guide för Musikquiz

## Översikt

Detta projekt stödjer nu flera AI-leverantörer för att generera låtförslag. Detta minskar kostnader och förbättrar skalbarhet.

## Tillgängliga AI-leverantörer

### 1. Google Gemini (Rekommenderad - Primär)
- **Modell**: Gemini 2.0 Flash (Experimental)
- **Kostnad**: Gratis upp till 1500 förfrågningar/dag (Flash Tier)
- **Fördelar**:
  - Mycket kostnadseffektiv med generös gratisnivå
  - Snabb responstid
  - JSON-mode för strukturerade svar
  - Högkvalitativa låtförslag
- **API-nyckel**: Kräver `GEMINI_API_KEY`
- **Dokumentation**: https://ai.google.dev/

### 2. OpenAI (Fallback)
- **Modell**: GPT-4o-mini
- **Kostnad**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Fördelar**:
  - Beprövad kvalitet
  - Stor musikkunskap
  - Används som backup om Gemini inte är tillgängligt
- **API-nyckel**: Kräver `OPENAI_API_KEY`
- **Dokumentation**: https://platform.openai.com/docs

## Konfiguration

### Firebase Functions Secrets

Konfigurera API-nycklar som Firebase Functions secrets:

```bash
# Primär provider - Gemini (Rekommenderat)
firebase functions:secrets:set GEMINI_API_KEY

# Backup provider - OpenAI (Valfritt men rekommenderat)
firebase functions:secrets:set OPENAI_API_KEY

# Befintliga secrets (krävs)
firebase functions:secrets:set SPOTIFY_CLIENT_ID
firebase functions:secrets:set SPOTIFY_CLIENT_SECRET
```

### Skaffa API-nycklar

#### Google Gemini API-nyckel
1. Gå till [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Logga in med ditt Google-konto
3. Klicka på "Get API key"
4. Kopiera din API-nyckel

#### OpenAI API-nyckel (om önskad som backup)
1. Gå till [OpenAI Platform](https://platform.openai.com/api-keys)
2. Logga in eller skapa ett konto
3. Klicka på "Create new secret key"
4. Kopiera din API-nyckel

## Hur systemet fungerar

### Provider-prioritet

Systemet använder en fallback-mekanism:

1. **Primär**: Försöker först med Gemini (om `GEMINI_API_KEY` finns)
2. **Fallback**: Om Gemini misslyckas eller inte är konfigurerad, använder OpenAI (om `OPENAI_API_KEY` finns)
3. **Felhantering**: Om båda misslyckas, försöker systemet upp till 3 gånger innan det returnerar ett fel

### Optimerad seenSongs-hantering

För att minska kostnader och tokenanvändning använder systemet smart sampling:

- **Max 100 låtar** skickas i varje prompt (ner från potentiellt 500+)
- **60% senaste låtar** - för att undvika upprepningar av nyligen spelade låtar
- **40% slumpmässiga äldre låtar** - för att bibehålla variation över tid

Detta minskar:
- Promptstorlek med ~80% för stora historikar
- API-kostnader proportionellt
- Responstid

## Kostnadsanalys

### Uppskattad kostnad per 1000 låtgenereringar

#### Gemini Flash (Rekommenderat)
- **Kostnad**: $0 (under gratisnivån på 1500 req/dag)
- **Efter gratisnivå**: ~$0.075 per 1M input tokens
- **Uppskattad kostnad**: Praktiskt taget gratis för de flesta användningsfall

#### OpenAI GPT-4o-mini (Tidigare lösning)
- **Input**: ~100 tokens × 1000 = 100K tokens = $0.015
- **Output**: ~50 tokens × 1000 = 50K tokens = $0.030
- **Total**: ~$0.045 per 1000 genereringar

### Besparing med Gemini
- **Kostnadsminskning**: ~100% (under gratisnivån)
- **Skalbarhet**: Upp till 45,000 låtgenereringar/månad gratis

## Testning

### Lokal utveckling

```bash
# Sätt miljövariabler för lokal testning
export GEMINI_API_KEY="din-gemini-nyckel"
export OPENAI_API_KEY="din-openai-nyckel"  # Valfri

# Kör funktionerna lokalt
cd functions
npm run serve
```

### Testa olika providers

Du kan testa systemet genom att:

1. Sätta endast `GEMINI_API_KEY` - testar Gemini isolerat
2. Sätta endast `OPENAI_API_KEY` - testar OpenAI isolerat  
3. Sätta båda - testar fallback-mekanismen

## Felsökning

### "No AI provider configured"
- Kontrollera att minst en av `GEMINI_API_KEY` eller `OPENAI_API_KEY` är satt i Firebase Functions secrets

### "All AI providers failed"
- Kontrollera API-nycklarnas giltighet
- Se Firebase Functions-loggarna för detaljerade felmeddelanden
- Verifiera att du inte har överskridit rate limits

### Låg kvalitet på låtförslag
- Detta är sällsynt men kan hända
- Systemet försöker automatiskt om upp till 3 gånger
- Fallback-providern används om primär provider ger dåliga resultat

## Framtida förbättringar

Potentiella förbättringar som kan göras:

1. **Bloom Filter**: För ännu mer effektiv deduplicering utan att skicka låtlistor
2. **Caching**: Cacha populära låtförslag för snabbare svar
3. **Fler providers**: Lägg till Claude, Llama, etc.
4. **A/B-testning**: Testa olika providers för att hitta bästa kvalitet
5. **Provider-statistik**: Logga prestanda och kvalitet per provider

## Support

För frågor eller problem:
1. Kolla Firebase Functions-loggarna
2. Verifiera API-nyckelkonfiguration
3. Testa med curl/Postman för att isolera problemet
