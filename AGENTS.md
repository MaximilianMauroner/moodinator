# Agent Notes

Keep this file limited to project-specific constraints that are not obvious from a quick code search.

- Mood scale is inverted: `0` means best (`Elated`), `10` means worst (`Emergency`). Lower is better everywhere.
- In UI code, go through service-layer APIs such as `moodService` and `analyticsService` instead of calling repositories directly.
- Avoid NativeWind `shadow-*` classes in dynamic/native-screen components. Use inline iOS shadow props plus Android `elevation` instead to avoid navigation-related warnings.
- The app's privacy promise is local-only storage: no accounts, no analytics, no external sync by default.
- If data collection, storage, or sharing changes, update both the root legal docs and the in-app settings screens together, including their "Last Updated" dates.
