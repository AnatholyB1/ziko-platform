# Product

## Register

product

## Users

Independent personal trainers with 1–20 active clients. They open the dashboard daily on desktop — usually between client sessions or early morning — to check who needs attention, review progress data, and plan upcoming programs. Mobile is a secondary surface: a quick status check between sessions, not a full workflow. They are fitness experts, not software professionals; the tool must earn their trust through accuracy and speed, not through feature density.

## Product Purpose

Ziko Coach is the command center for independent coaches managing clients via the Ziko fitness app. It surfaces client signals (missed sessions, mood drops, stale measurements), gives the coach AI-assisted analysis and program generation, and handles the operational side of coaching: invitations, program assignment, import of existing plans. Success looks like: coach opens the dashboard, sees who needs attention, acts on it, and closes the tab — in under 5 minutes.

## Brand Personality

Expert, direct, warm. The platform speaks like a trusted colleague who has coached for a decade: it gives you the information you need without dressing it up, celebrates real progress without patronizing, and adapts to each coach's style without getting in the way.

## Anti-references

- **Generic SaaS dashboards**: Notion/Linear clones — too corporate and cold for a daily coaching tool. The product should feel built for coaches, not for knowledge workers.
- **Consumer wellness apps**: Soft pastels, mindfulness aesthetic, rounded-everything UI. Calm/Headspace energy is wrong here; coaches are performance professionals.
- **AI-forward startup look**: Purple gradients, particle backgrounds, "powered by AI" CTAs everywhere. The AI is one capability, not the brand identity.

## Design Principles

1. **Surface the signal, not the noise.** A coach checking in at 7am needs to see immediately which clients need attention. Hierarchy is earned by urgency, not by visual decoration.
2. **Earn familiarity.** The coach should be thinking about their clients, not the interface. Consistent affordances, predictable layouts, and standard navigation patterns let the tool disappear.
3. **Data deserves respect.** Coaches are experts. Show real numbers, real trends, real context. Don't over-interpret or over-smooth. They will form their own conclusions.
4. **Desktop-first, mobile-functional.** Full workflows live on desktop. Mobile surfaces the minimum needed for a quick check: alerts, client status, nothing more.
5. **AI enhances, never overrides.** The AI coach assistant is a tool in the coach's hands. It suggests, analyzes, and generates — but the coach decides. Never position AI as the authority.

## Accessibility & Inclusion

- Target: WCAG 2.1 AA
- Keyboard navigation fully supported across all interactive surfaces
- All modal dialogs must trap focus and restore focus on close
- Color is never the sole indicator of state (signal chips must have labels, not just color dots)
- Reduced motion: animations must respect `prefers-reduced-motion`
