# License Handling

This document describes how NFIF (Norges Friidrettsforbund) license fees are handled in Runners Hub.

## Background

For all competitions sanctioned by NFIF, participants must have either:
1. A **full-year license** (helårslisens), or
2. A **one-time license** (engangslisens) purchased per race

The official rules are documented at: https://www.friidrett.no/lisens/engangslisens/

## One-Time License Fees (Løp utenfor bane)

For races outside the track ("løp utenfor bane"), the one-time license fee is calculated based on the participation fee:

| Participation Fee | License Fee |
|-------------------|-------------|
| ≤ 50 kr           | Optional (0 kr or 20 kr) |
| 51 - 100 kr       | 20 kr |
| 101 - 250 kr      | 30 kr |
| 251 - 400 kr      | 40 kr |
| > 400 kr          | 50 kr |

**Note:** For participation fees of 50 kr or less, the license is optional for the participant.

## Implementation in Runners Hub

### Data Model

Each `raceDistance` in an `eventEdition` can have its own `fees` object:

```typescript
fees: {
  participation: number;     // Entry fee
  oneTimeLicense: number;    // License fee (0 if not applicable)
}
```

### Registration Flow

1. User selects a race distance
2. If the selected distance has `oneTimeLicense > 0`:
   - Ask: "Do you have a full-year NFIF athletics license?"
   - If **Yes**: 
     - Require license number input
     - Do NOT charge license fee
   - If **No**:
     - Add license fee to total
3. Store `hasYearLicense` and `licenseNumber` with registration

### License Number Format

NFIF license numbers follow the format: `NNNNNN-YYYY`
- Example: `221393-2025`
- 6 digits, hyphen, 4-digit year

### License Lookup

Runners can look up their license number at:
https://isonen.no/event/cm1qawqik00o613hlk5o1kjjq/

This link is provided in the registration form for convenience.

## MO 2026 Configuration

| Race Class | Participation | License Fee | Total (no year license) |
|------------|---------------|-------------|-------------------------|
| Konkurranse | 250 kr | 30 kr | 280 kr |
| Trim med tidtaking | 250 kr | 30 kr | 280 kr |
| Turklasse | 50 kr | 0 kr | 50 kr |

The hiking class (Turklasse) does not require a license.

## Future Considerations

### EQ Timing Integration

Currently, only EQ Timing's registration system has automatic license verification with NFIF. If NFIF provides an API or opens integration to other systems in the future, we should:

1. Implement automatic license verification
2. Remove the need for manual license number entry
3. Update this documentation accordingly

### Refund Process

Runners with a full-year license who are charged a one-time license fee (e.g., through other registration systems) can apply for a refund from NFIF:
https://surveys.enalyzer.com/survey/linkindex?pid=n4n5s7q4

Since we skip the license fee for runners who declare they have a year license, this refund process is not needed for Runners Hub registrations.

## Related Documentation

- [DATA_MODEL.md](./DATA_MODEL.md) - Fees structure in eventEditions
- [OPERATIONS.md](./OPERATIONS.md) - Event management procedures
