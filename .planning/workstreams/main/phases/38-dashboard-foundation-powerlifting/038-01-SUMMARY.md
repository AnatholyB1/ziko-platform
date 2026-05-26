---
plan: "038-01"
status: complete
---

# 038-01 Summary: TanStack Query install + QueryProvider setup

## What was done
- Installed @tanstack/react-query v5 in apps/web
- Created QueryProvider.tsx with useState factory pattern and 60s staleTime
- Updated client detail layout.tsx to wrap children in QueryProvider

## Artifacts created/modified
- apps/web/package.json — @tanstack/react-query added to dependencies
- apps/web/src/components/coach/QueryProvider.tsx — new file
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx — QueryProvider wrapping children
