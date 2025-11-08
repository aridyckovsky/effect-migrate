---
"@effect-migrate/core": minor
---

Add time-series checkpoint persistence with Time and ProcessInfo services. New checkpoint manager provides automatic thread linking via AMP_CURRENT_THREAD_ID, delta computation between audits, and manifest-based history navigation. Checkpoints use normalized FindingsGroup schema for 40-70% size reduction. New services enable testable date/time and environment variable access.
