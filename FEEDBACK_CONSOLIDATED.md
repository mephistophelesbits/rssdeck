# RSS Deck - Comments & Feedback Consolidation

## Reddit Posts Live

| Subreddit | Post Link | Status |
|----------|-----------|--------|
| r/selfhosted | https://www.reddit.com/r/selfhosted/comments/1r47z1b/rss_deck_self_host_rss_reader_powered_by_ai/ | ✅ Live |
| r/opensource | https://www.reddit.com/r/opensource/comments/1r4gw7e/rss_deck_open_source_rss_reader_with_ai_features/ | ✅ Live |

---

## Comments & Questions Received

### 1. OPML Import (from r/selfhosted)
**Question:** "How to import my OPML files for different kind of RSS?"

**Status:** Not yet addressed

**Suggested Reply:**
> OPML import is planned for V2. Currently add feeds manually in Settings → Add Column → RSS URL. Or use: `https://rssdeck.vercel.app/api/rss?url=YOUR_FEED_URL`

---

### 2. Docker & QoL Features (from r/selfhosted)
**Comment:** "This is a cool combo. For the docker image thing — i'd ship a ghcr image + a minimal docker compose in the repo (env vars for ollama host, telegram bot token/chat id, db url, etc). makes it way easier for ppl to actually try."

**Suggestions:**
- ✅ Ship GHCR image + minimal docker compose (env vars for ollama host, telegram token, db url)
- ⬜ Add "Send test notification" button
- ⬜ Dedupe + rate limit Telegram pushes
- ⬜ Store fulltext + summary with stable ID (don't re-summarize)

**Status:** Already working on GHCR image

---

## Feature Requests (Priority Order)

### High Priority
| Feature | Status | Notes |
|---------|--------|-------|
| GHCR Image | ✅ Done | Just set up |
| Stable Article IDs | ⬜ Next | Don't re-summarize |

### Medium Priority
| Feature | Status |
|---------|--------|
| "Send test notification" button | ⬜ Todo |
| Rate limiting for Telegram | ⬜ Todo |
| Notification deduplication | ⬜ Todo |

### Future
| Feature | Status |
|---------|--------|
| OPML import (categories) | ⬜ Todo |

---

## Action Items for Monday

1. ✅ GHCR image already deployed - test and verify
2. ⬜ Add "Send test notification" button
3. ⬜ Implement rate limiting for Telegram pushes
4. ⬜ Add stable article IDs to prevent re-summarizing
5. ⬜ Plan OPML import for V2

---

## Links

- **GitHub:** https://github.com/mephistophelesbits/rssdeck
- **Live Demo:** https://rssdeck.vercel.app/
- **Docker Hub:** https://hub.docker.com/r/kianfong/rssdeck

---

*Last updated: Feb 14, 2026*
