# Milestones — Retour Vidéo Coach

## v1.13 — Retour Vidéo Coach

**Shipped:** 2026-05-27
**Phases:** 45–47 | **Plans:** 12 | **Timeline:** 2026-05-26 → 2026-05-27 (2 days)
**Git range:** b072b34 → f22ec33

### Delivered

Complete 1:1 coach-to-athlete video feedback loop: athlete uploads a squat video from mobile → coach annotates at specific timecodes with text and voice comments → athlete reviews annotations synchronized with the video on mobile.

### Key Accomplishments

1. Supabase `coach-videos` private bucket + migration 057 (coach_client_videos + coach_video_annotations, 5 RLS policies)
2. Hono backend: 9 routes — signed URL upload flow, annotation CRUD with double-column ownership guards, send-feedback push notification, Whisper+Claude voice pipeline
3. Mobile upload: VideoUploadSheet with H.264/MP4 enforcement (VideoExportPreset), XHR progress bar, title input, push token registration
4. Web player: @vidstack/react@1.15.1 MediaPlayer + AnnotatedTimeSlider (orange dots at timecodes) + 5-state AnnotationPanel with full CRUD and GSAP animations
5. Voice annotations: `lib/whisper.ts` shared utility extracted from v1.9 retour-vocal; VoiceComposer 5-state recording component; inline `<audio controls>` player in annotation panel
6. Mobile review: expo-video 3.0.16 VideoPlayerScreen with annotation timeline strip, seek-on-tap, voice mic badge

### Stats

- Requirements delivered: 19/19 (UPLOAD-01–04, INFRA-01–04, PLAYER-01–02, ANNOT-01–03, REVIEW-01–02, VOICE-01–04)
- Phase 45 velocity: ~3 tasks/plan avg (~18 min/plan)
- Phase 47 velocity: Phase 47 total ~32 min (47-01: 12 min, 47-02: 4 min, 47-03: 15 min, 47-04: <5 min)

### Deferred to Post-v1.13

- Audio player for voice annotations on mobile (TODO in VideoPlayerScreen.tsx)
- Retour vidéo webcam coach (coach records and sends video) — explicitly out of scope
- Upload resumable TUS for files > 500 MB
- Telestration / drawn annotations on video

### Archive

- [milestones/v1.13-ROADMAP.md](milestones/v1.13-ROADMAP.md)
- [milestones/v1.13-REQUIREMENTS.md](milestones/v1.13-REQUIREMENTS.md)
