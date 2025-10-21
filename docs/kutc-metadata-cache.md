# KUTC cached metadata notes

## Summary
- **Problem**: The `kutcResults/<edition>` documents include a `metadata` or `summary` object that caches derived values (e.g., `totalParticipants`, `totalFinishers`, `races`, `resultsStatus`). When the Firestore data is updated outside of the process that refreshes this snapshot, the cached values become stale, causing the UI to present incorrect counts or statuses.
- **Scope**: Affects all consumers of `listKUTCEditions()` and `getEditionMetadata()` in `src/services/kutcResultsService.ts`.
- **Impact**: Results pages can misreport participant counts, finisher totals, or result statuses until the metadata is manually rebuilt.

## User-facing symptoms observed
- **Race finishers freeze at zero**: Cards on `KUTCYearResultsPage.tsx` showed `0 finishers` because cached `metadata.races[].finishers` did not reflect runner status values stored as `"finished"` vs `"Finished"`.
- **Results status lag**: Even after an `eventEdition` document moved from `"preliminary"` to `"final"`, overview pages continued displaying the cached status value.
- **Potential for stale dates/participants**: If editions are edited in Firestore (e.g., adjusting participants or race lists), the cached `metadata` may diverge, leading to misleading counts on `KUTCResultsOverviewPage.tsx`, `KUTCRecordsPage.tsx`, and `KUTCAllTimeLeaderboardPage.tsx`.

## Technical analysis
- `listKUTCEditions()` loads `metadata` from `kutcResults/<edition>` and only patches a few fields (event start time, status label). Until the recent patch, the finisher counts were accepted as-is.
- `getEditionMetadata()` performs the same pattern for single editions.
- Higher-level services (leaderboard, records, appearance leader calculations) still rely on the cached metadata to understand available races and status, though they fetch results collections for detailed aggregation.
- The cached snapshot was intended to avoid recomputing aggregates but has no automatic invalidation when Firestore data changes elsewhere.

## Known use cases affected
- **Results overview grid (`src/pages/KUTCResultsOverviewPage.tsx`)**: Displays participant totals, event dates, and status chips sourced from cached metadata.
- **Year results view (`src/pages/KUTCYearResultsPage.tsx`)**: Uses metadata for race cards, total participants/finishers, and status chips.
- **Records and leaderboard pages**: Use `listKUTCEditions()` to populate edition lists and perform data-integrity checks.
- **Admin tools or future exports**: Any feature that consumes `KUTCEdition.metadata` risks reusing stale numbers (e.g., upcoming summary tables, newsletter snippets, etc.).

## Recommended remediation options
- **Option A – Runtime recomputation (preferred)**
  - Introduce a helper (e.g., `buildKUTCEditionSnapshot(editionId)`) that fetches `eventEditions/<id>` plus the latest results collections and derives metadata on demand (participants, finishers, races, statuses, dates).
  - Update `listKUTCEditions()` / `getEditionMetadata()` to call the helper so every UI load reflects live Firestore data.
  - With <40 participants per edition, the extra reads remain negligible.
- **Option B – Deterministic cache rebuild**
  - Keep the cached metadata but add a job or cloud function to rewrite `kutcResults/<edition>/metadata` whenever results change.
  - Requires comprehensive triggers or a manual “recalculate” button to ensure future updates are captured.
- **Option C – Hybrid caching**
  - Compute metadata at runtime and cache the result with a short TTL (e.g., store in local state or memory) to reduce repeated Firestore reads during a single session.
  - Only write back to Firestore when an explicit “publish summary” action is triggered.

## Additional considerations
- **Data integrity flags**: Continue deriving `resultsStatus` from `eventEditions` as the source of truth to avoid mismatched statuses.
- **Race definitions**: Ensure race metadata (names, distance keys) comes from either results documents or `eventEdition` definitions rather than the stale snapshot.
- **Future migrations**: If cached metadata is eventually removed, plan a script to delete obsolete `metadata` sub-documents so no code mistakenly reads them later.
- **Testing**: Add regression tests that load editions with mixed-case runner statuses to confirm runtime calculations treat statuses case-insensitively.

## Next steps (deferred)
1. Prototype a runtime aggregation helper and validate with historical editions (2018, 2020, 2023, 2025).
2. Update UI and service layers to consume runtime data structures instead of cached metadata.
3. Decide whether to delete existing cached metadata or keep it for archival purposes once runtime calculations are proven stable.
