# Wormstar

## التشغيل

شغّل Ollama أولًا، ثم شغّل المساعد من جذر المشروع:

```bash
ollama serve
python3 wormgpt.py
```

يتطلب تشغيل المساعد وجود نموذج Ollama باسم `llama3.2:1b`:

```bash
ollama pull llama3.2:1b
```