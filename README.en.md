<div align="center">

# Word Atlas (fork)

**One word, one picture. Light up your IELTS vocabulary.**

[**Open this fork →**](https://words.quickform.cc/) &nbsp;·&nbsp; [Original demo →](https://0xlei.tech/words/) &nbsp;·&nbsp; [Original repo →](https://github.com/designfuchen/word-atlas)

</div>

---

This is a fork of [designfuchen/word-atlas](https://github.com/designfuchen/word-atlas).

For everything about Word Atlas itself — 7,298 core IELTS words, original illustrations and example sentences, UK/US audio, FSRS spaced repetition — see the [upstream README](https://github.com/designfuchen/word-atlas#readme). All vocabulary content and assets come from the upstream project; full credit to the original author.

## What this fork changes

### ☁️ QuickForm cloud progress backup

Powered by [QuickForm](https://quickform.cc/), learning progress can now be stored in the cloud:

- In "Me → Data (QuickForm)", save your progress with your email address as the id and a short note;
- On another device, load the list of saves and import any one to restore your local records.

### 🔊 Trimmed audio, TTS instead

To deploy on Cloudflare (keeping the site under 20,000 files), pronunciation files were trimmed:

- UK/US recordings are kept for A1/A2 words (1,824 in total);
- all other words and every example sentence are read by browser speech synthesis (TTS).

## Run locally

```bash
git clone https://github.com/xiezuoru/word-atlas.git
cd word-atlas
npm install
npm run dev
```

## License

Code under MIT, content under CC BY 4.0, both inherited from the upstream project.
