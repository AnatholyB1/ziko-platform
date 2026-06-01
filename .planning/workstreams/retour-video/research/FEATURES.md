# Features — Retour Vidéo Coach

**Domain:** Coaching video annotation & feedback
**Researched:** 2026-05-25
**Confidence:** MEDIUM (corroborated across Onform, CoachNow, Hudl, Coach Logic, CoachFeedback)

---

## Table Stakes (must have v1)

These are present on every platform in the category. Missing any one of them makes the product feel broken to coaches familiar with tools like Onform or CoachFeedback.

| Feature | Why Expected | Notes for Ziko |
|---------|--------------|----------------|
| Mobile video upload from camera roll | Athlete workflow starts here — no coach tool matters without this | Expo `ImagePicker` / `DocumentPicker`, upload to Supabase Storage |
| Video playback on web with timeline scrubbing | Coach must be able to seek freely to annotate the right moment | Standard `<video>` is sufficient for v1; no HLS needed if files are reasonable size |
| Timecoded text comments | Every platform supports timestamped notes tied to a specific second | Store `{ timecode_ms, text, author_id }` in Supabase |
| Visual timeline markers | Annotations appear as dots/pins on the scrub bar so coach knows where to look | Pure CSS overlay on `<video>` element, low complexity |
| Athlete notification when annotation is ready | Athletes expect to be notified — silence after upload feels like the video was lost | Push notification (existing infra) + in-app badge |
| Athlete can view annotations synchronized with video | Clicking an annotation marker jumps the video to that timecode | Core interaction loop — must work on mobile |
| Coach can replay video at reduced speed | Technique analysis requires at least 0.5x / 0.25x | Native `<video>` `playbackRate` property, zero extra libs |

---

## Differentiators (nice to have v1)

Things that make a coaching video tool stand out, valued by coaches but not expected by default.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Timecoded voice comments (retour vocal) | Coach talks naturally at a specific moment → transcript auto-generated via Whisper + Claude (already built in v1.9) | Low (stack reuse) | Core differentiator for Ziko — leverages existing retour-vocal pipeline |
| Coach reply thread on annotation | Athlete can react / ask a question on a specific annotation | Medium | Keeps feedback loop in context; avoid generic chat for this |
| Annotation categories / tags | Tag an annotation as "technique", "breathing", "good rep" — gives structure to feedback | Low | Simple enum, useful for coaches who annotate at volume |
| Progress comparison: two videos side-by-side | Compare this week's squat vs last week | High | Needs synchronized dual player — defer to v1.x+1 |
| Auto-thumbnail at annotation timecode | Preview frame shown in annotation card list | Low | `canvas.drawImage(video, ...)` at the stored timecode |
| Coach markup / drawing on a frame | Draw arrows and circles on a paused frame | High | Telestration is complex (canvas layer, coordinate normalization, storage) — defer |

---

## Anti-features (avoid)

Things that seem useful but add complexity disproportionate to the value at v1 scale (Guillaume coaching Joaquim, not a 300-athlete team).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Video transcoding pipeline | Transcoding to HLS or multiple resolutions requires a worker queue (FFmpeg, Lambda, or third-party like Mux/Cloudinary) — massive infra overhead | Store original file in Supabase Storage; let the browser native player handle it. Mobile shoots in H.264/HEVC which plays natively in all modern browsers. |
| In-app video recording by coach | "Coach sends video back" is explicitly out of scope v1.13 per STATE.md | Voice comment covers the feedback layer; skip coach-camera entirely |
| Real-time collaborative annotation | Multiple coaches annotating simultaneously with live cursors | Not relevant for Guillaume's solo workflow |
| Playlist / clip compilation | Cutting and stitching video clips into highlight reels | Hudl-tier feature; irrelevant for 1:1 personal coaching at v1 |
| Team-level video broadcast | Sharing one annotated video to all athletes at once | Ziko is 1:1 coaching, not team sports |
| AI auto-detection of reps / form errors | Computer vision on video to auto-flag bad squats | Requires ML infrastructure; retour-vocal + timecoded text achieves 80% of the value without the complexity |
| Waveform display for voice comments | Audio waveform visualization on voice annotations | Visual nicety, zero coaching value |

---

## Athlete Review Flow

What Joaquim experiences after Guillaume annotates his squat video:

**1. Upload confirmation (immediate)**
Athlete uploads video → sees upload progress + "Vidéo envoyée — en attente du retour de ton coach". Clears the anxiety of "did it send?".

**2. Push notification (when coach submits annotations)**
"Guillaume a annoté ta vidéo — 3 commentaires". Tap opens the video review screen directly.

**3. Video review screen on mobile**
- Video player with timeline
- Annotation markers visible as colored dots on the scrub bar
- Annotation list below (or slide-up panel): `[1:23] "Descent trop rapide — brace tes abdos"` with play icon
- Tapping an annotation card: video seeks to that timecode + auto-plays 2s from that point
- Voice comments play inline as audio (with transcript text shown below)

**4. Reaction / acknowledgment**
- Simple emoji reaction on an annotation (thumbs up = "j'ai compris"), not a full reply thread
- Keeps the friction extremely low for athletes who just want to confirm receipt

**5. Video stays accessible**
Video + annotations stored persistently — athlete can review again before next session. No expiry.

**Athlete expectation from competitive tools (Onform, CoachFeedback):** Notifications are instant. Annotations are synchronized with video (not a separate list). Voice is preferred over long text. Less than 3 taps from notification to watching the annotated moment.

---

## Feature Complexity Notes

These are the features most likely to be underestimated during planning:

**Video upload on mobile — deceptively hard**
Large video files (a 3-min squat set at 1080p = 300–600 MB) create three problems: upload time on mobile data, Supabase Storage default file size limits (50 MB by default, must be raised), and timeout handling. A resumable upload strategy (Supabase Storage supports TUS protocol) is non-negotiable for files > 100 MB. Without it, coaches get support tickets every time an upload fails halfway.

**Timecode synchronization — looks simple, isn't**
Storing `timecode_ms` is trivial. Rendering markers on the `<video>` scrub bar is not — the native `<progress>` element is not styleable in a cross-browser way. A custom scrub bar (Canvas or div overlay) is required. Interaction (click-to-seek on the custom bar) must be pixel-accurate relative to video duration. Plan 4–6 hours of careful implementation.

**Voice comment playback alongside video — race condition risk**
When the athlete taps an annotation with a voice comment: video seeks to T, voice comment audio starts. If video buffering stalls, the voice comment plays out of sync with what's on screen. This requires a "wait for video to be ready before playing audio" gate using the `canplay` / `seeked` event — easy to miss in a first pass.

**Push notifications on iOS for video-ready state**
iOS requires explicit permission grant for push notifications. If the athlete hasn't granted permission at upload time, the "annotation ready" notification is silently dropped. This must be requested proactively at the video upload screen ("Active les notifications pour savoir quand Guillaume a annoté ta vidéo"), not deferred to a system default prompt.

**Supabase Storage signed URLs**
Videos should not be publicly accessible — they are private athlete data. Supabase Storage signed URLs expire (default 1 hour). The video player must request a fresh signed URL on every session open, not cache the URL. Cached expired URLs cause "video not found" errors that look like bugs.

**Annotation ordering after coach edits**
If Guillaume adds annotations non-sequentially (annotates T+1:23, then goes back and adds T+0:45), the list must render in timecode order, not insertion order. Simple `ORDER BY timecode_ms` in the query — but easy to forget and produces confusing UX.

---

## Sources

- [Onform — Sports Video Analysis Platform](https://onform.com/)
- [CoachNow — Video Analysis](https://coachnow.com/video-analysis)
- [CoachFeedback App](https://coachfeedback.app/)
- [A Coach's Guide: Hudl, Dartfish & Alternatives](https://blog.callplaybook.com/blog/coach-video-review-software-hudl-dartfish-alternatives)
- [Folio3 AI — Top 8 Sports Video Analysis Solutions 2026](https://www.folio3.ai/blog/top-8-sports-video-analysis-software-solutions-for-coaches)
- [Coach Logic — Psychology of Video Analysis](https://www.coach-logic.com/blog/the-psychology-of-video-analysis-building-stronger-smarter-athletes)
- [videojs-annotation-comments plugin](https://github.com/trilogy-group/contently-videojs-annotation-comments)
