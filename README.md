# Susan AI - Your Personal Jarvis-like Assistant

Susan is an intelligent AI assistant with voice interaction capabilities, similar to JARVIS from Iron Man. She can understand speech, respond naturally, and help with various tasks.

## Features

🗣️ **Voice Interaction**: Full speech-to-text and text-to-speech capabilities  
🧠 **AI-Powered**: Uses Claude and GPT models for intelligent responses  
💬 **Natural Conversation**: Maintains conversation context and memory  
⚡ **Command System**: Built-in commands for system operations  
🌐 **Web Interface**: Beautiful, responsive web UI  
📝 **Memory**: Persistent conversation history  

## Quick Start

1. **Copy the environment file:**
   ```bash
   copy .env.example .env
   ```

2. **Add your API keys to .env:**
   ```
   OPENAI_API_KEY=your_key_here
   ANTHROPIC_API_KEY=your_key_here
   ```

3. **Start Susan:**
   ```bash
   npm start
   ```

4. **Open your browser to:**
   ```
   http://localhost:3001
   ```

## Available Commands

- **System**: `time`, `date`, `system info`
- **Files**: `list files`, `current directory`  
- **Math**: `calculate [expression]`
- **Reminders**: `remind me [text]`, `show reminders`
- **Susan**: `who are you`, `your capabilities`, `help`

## Voice Controls

- Click the Susan orb or "Start Listening" to begin voice interaction
- Susan will respond with both text and speech
- Click during speech to interrupt Susan

## Requirements

- Node.js 18+
- Modern web browser with speech recognition support
- At least one AI API key (OpenAI or Anthropic)

## Development

```bash
npm run dev    # Start with auto-reload
npm test       # Run tests
```

## API

REST endpoint available at `/api/message` for text-only interactions:

```javascript
POST /api/message
{
  "message": "Hello Susan!"
}
```

---

**Susan** - Your intelligent AI companion 🤖