# RunnersHub Color System

Updated: 2025-11-15

This document captures the shared color palette and theming mechanisms used to align RunnersHub with the KrUltra web experience. Keep this file current when introducing new tokens or component-specific styling rules.

## Palette Overview

| Token              | Hex      | Notes / Primary Usage |
| ------------------ | -------- | --------------------- |
| `brand-50`         | `#EEF6FD` | Ultra-light backgrounds, hero gradients |
| `brand-100`        | `#DBEEFD` | Page sections, cards, banners |
| `brand-200`        | `#B7DCF9` | Card accents, secondary fills |
| `brand-300`        | `#8BC2F0` | Info highlights, hover tint for light surfaces |
| `brand-400`        | `#69A9E1` | Focus rings, lightweight borders |
| `brand-500`        | `#609CD2` | Secondary buttons, icons |
| `brand-600`        | `#4E82B4` | Links, button hover state |
| `brand-700`        | `#41719C` | Primary buttons, CTAs, header accents |
| `brand-800`        | `#355A7B` | Active button state, dark hover |
| `brand-900`        | `#2D4A63` | Header/footer background, dark cards |
| `brand-950`        | `#1B2E3F` | Full-bleed dark backgrounds |
| `accent-400`       | `#FFD966` | Badges, notification pills, active nav indicator |
| `neutral-bg-light` | `#FFFFFF` | Default light background (body/root) |
| `neutral-bg-dark`  | `#0F172A` | Default dark background |
| `neutral-card-dark`| `#1E293B` | Dark mode cards |
| `text-primary`     | `#111827` | Standard body text |
| `text-secondary`   | `#1F2937` | Subheadings, muted text |
| `text-inverse`     | `#FFFFFF` | Text on dark surfaces |

### Contrast Guidance

* Maintain WCAG AA (4.5:1) contrast for text. When `brand-500` on white does not pass, prefer `brand-600` or `brand-700`.
* For dark mode, ensure `brand-400` and lighter tokens sit on sufficiently dark surfaces for contrast.

## Theme Integration (Material UI)

### Event Signature Palettes

| Event | Primary Tone | Hex | Usage |
| ----- | ------------ | --- | ----- |
| KUTC | Deep sky blue | `#1976D2` | Feature card gradients (`rgba(25,118,210,0.24 → 0.08)`), button accents, status chips |
| Malvikingen Opp | Evergreen | `#2E7D32` | Feature card gradients (`rgba(46,125,50,0.24 → 0.08)`), success CTAs |

Implementation notes:

1. Keep gradients defined in `HomePage.tsx` in sync with these references.
2. Light mode text on the MO cards now follows the global palette (`text.primary` / `text.secondary`) to preserve contrast on the lighter green backgrounds.
3. For custom components, prefer pulling hues from the `brand-*` scale for KUTC and reuse the documented evergreen tone for MO to avoid visual drift.

### Core Theme Factory

* File: `src/config/theme.ts`
* Function: `createRunnersHubTheme(mode)` returns a mode-aware `createTheme` instance.
* Background defaults and `MuiCssBaseline` overrides must both reference the same neutral background tokens (`neutral-bg-light` / `neutral-bg-dark`).
* `palette.primary` should map to `brand-700` in light mode and `brand-400` or `brand-500` in dark mode (pending final decision). Secondary and info palettes continue to use neutral greys until redesigned.

### Global Surface Application

* `MuiCssBaseline.styleOverrides` applies `body` and `#root` background colors. In light mode this is now pure white to match prod.krultra.no; ensure values stay in sync with `palette.background.default` to avoid flashes between MUI components and raw DOM nodes.
* When testing alternate backgrounds (e.g., verification red), revert to the documented neutral token after validation.

### Component Styling Rules

| Component / Area | Tokens | Notes |
| ---------------- | ------ | ----- |
| App header (`AppHeader.tsx`) | `palette.background.paper`, `palette.text.primary`, `palette.divider` | Consider switching to explicit `brand-900` once palette is finalized. |
| Primary buttons (`MuiButton`, contained) | `brand-700` base, `brand-600` hover, `brand-800` active, white text | Update hover/active overrides in `MuiButton.styleOverrides`. |
| Secondary buttons (`MuiButton`, outlined) | Border `brand-600`, text `brand-700`, hover fill `brand-100` | Pending implementation. |
| Links (`MuiLink`) | `brand-600` default, `brand-500` hover | Ensure automatic underline for accessibility. |
| Alerts / info banners | Background `brand-100`, text `brand-800`, icon `brand-600` | Extend via `Alert` component overrides when implemented. |
| Forms (inputs, focus) | Focus ring `brand-400` (semi-transparent), label text `brand-700` | Example: use `boxShadow: 0 0 0 3px rgba(105,169,225,0.35)` for focus. |

## CSS Variables (Optional Layer)

Introduce CSS variables for reuse outside MUI (e.g., plain CSS, Tailwind overlays):

```css
:root {
  --color-brand-50: #EEF6FD;
  --color-brand-100: #DBEEFD;
  --color-brand-200: #B7DCF9;
  --color-brand-300: #8BC2F0;
  --color-brand-400: #69A9E1;
  --color-brand-500: #609CD2;
  --color-brand-600: #4E82B4;
  --color-brand-700: #41719C;
  --color-brand-800: #355A7B;
  --color-brand-900: #2D4A63;
  --color-brand-950: #1B2E3F;
  --color-accent-400: #FFD966;

  --surface-background: #F3F4F6;
  --surface-card: var(--color-brand-100);
  --surface-contrast: var(--color-brand-900);

  --text-primary: #111827;
  --text-secondary: #1F2937;
  --text-inverse: #FFFFFF;
}

[data-theme="dark"] {
  --surface-background: #0F172A;
  --surface-card: #1E293B;
  --text-primary: #F1F5F9;
  --text-secondary: #E2E8F0;
}
```

Export these from a central CSS module or global stylesheet when needed. Ensure MUI palette values remain the source of truth to prevent drift.

## Maintenance Checklist

1. Update this document whenever tokens, component rules, or background defaults change.
2. Run UI regression checks after adjusting primary/secondary colors.
3. Validate contrast for new combinations using tools like axe, Lighthouse, or Stark.
4. Sync palette updates with KrUltra Tailwind config (`webhost/krultra/frontend/tailwind.config.mjs`).
5. Capture before/after screenshots in design reviews to document visual impact.

## Pending Actions

* Harmonize secondary/tertiary palettes (success/warning/info) with KrUltra branding.
* Align dark-mode typography colors with documented tokens.
* Introduce storybook or visual regression tests to catch unintended color changes.
