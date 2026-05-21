---
name: Moodinator
description: Private mood tracking with warm local-first clarity.
colors:
  paper-canvas: "#FAF8F4"
  paper-surface: "#FDFCFA"
  paper-soft: "#F5F1E8"
  paper-line: "#E5D9BF"
  forest-night: "#1E2D26"
  forest-surface: "#2C4038"
  forest-lifted: "#3E5649"
  ink-brown: "#3D352A"
  muted-brown: "#5C4E3D"
  sage: "#5B8A5B"
  sage-soft: "#E8EFE8"
  sage-bright: "#7BA87B"
  coral: "#E06B55"
  coral-soft: "#FDE8E4"
  coral-deep: "#C75441"
  dusk: "#847596"
  dusk-soft: "#EFECF2"
  sand: "#BDA77D"
  sand-soft: "#F9F5ED"
  amber-low: "#D4A574"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "32px"
    lineHeight: 1.125
    letterSpacing: "-0.6px"
  headline:
    fontFamily: "Georgia, serif"
    fontSize: "26px"
    lineHeight: 1.154
    letterSpacing: "-0.4px"
  title:
    fontFamily: "Avenir Next, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Avenir Next, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.467
  label:
    fontFamily: "Avenir Next, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "0.8px"
rounded:
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.paper-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  card-surface:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-brown}"
    rounded: "{rounded.xl}"
    padding: "20px"
  chip-sage:
    backgroundColor: "{colors.sage-soft}"
    textColor: "{colors.sage}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  mood-pill-coral:
    backgroundColor: "{colors.coral-soft}"
    textColor: "{colors.coral-deep}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: Moodinator

## 1. Overview

**Creative North Star: "The Private Field Journal"**

Moodinator should feel like a personal record kept close at hand: warm paper, botanical greens, quiet structure, and clear controls that do not over-explain themselves. The product is used during small daily check-ins and sometimes during difficult moments, so the design must stay fast, readable, and emotionally unforced.

The current system is a warm organic product UI. It uses paper-toned surfaces, sage as the primary action color, coral for difficult-state semantics, dusk for pattern and context material, and sand for privacy, time, and neutral metadata. It rejects clinical UI, generic AI aesthetics, forced cheerfulness, surgical sterility, and anything that makes emotional data feel harvested.

**Key Characteristics:**
- Warm local-first surfaces rather than medical white or SaaS slate.
- Clear mobile-native controls with generous touch targets.
- Color carries emotional meaning, not decoration.
- Calm visual hierarchy for repeated check-ins and later review.
- Privacy and export flows must feel deliberate, consent-based, and reversible.

## 2. Colors

The palette is restrained but not monochrome: tinted neutrals carry the app, while sage, coral, dusk, and sand mark distinct emotional and product roles.

### Primary
- **Grounded Sage:** Used for brand moments, primary actions, selected positive states, and the welcome/leaf identity.
- **Soft Sage Wash:** Used behind selected or positive elements when a full-fill primary action would be too loud.

### Secondary
- **Human Coral:** Used for mood tracking, difficult emotional states, delete actions, and urgent-but-not-alarmist feedback.
- **Dusk Pattern Purple:** Used for insights, context tags, calendar pattern language, and reflective surfaces.
- **Sand Privacy Gold:** Used for privacy, security, timestamps, neutral energy, and export-adjacent metadata.

### Neutral
- **Paper Canvas:** The primary light background. It should feel like warm paper, never blank white.
- **Paper Surface:** Cards, sheets, list rows, and active panel surfaces.
- **Soft Paper Layer:** Secondary panels, icon wells, quiet controls, and hover-like states.
- **Forest Night:** The primary dark background. It should feel botanical and grounded, not blue-black.
- **Forest Surface:** Dark-mode card and sheet surfaces.
- **Ink Brown:** Main light-mode text, warmer than black.
- **Muted Brown:** Secondary text and labels.

### Named Rules

**The Emotional Semantics Rule.** Sage means stable or positive, coral means difficult or destructive, dusk means pattern and reflection, sand means privacy or neutral context. Do not swap these roles for novelty.

**The No Sterile White Rule.** Pure white and pure black are forbidden. Light surfaces stay warm; dark surfaces stay botanical.

**The Emergency With Restraint Rule.** Coral may become prominent for crisis states, but it must not make the whole product feel punitive, diagnostic, or alarmist.

## 3. Typography

**Display Font:** Georgia (with serif fallback)  
**Body Font:** Avenir Next (with system sans fallback)  
**Label/Mono Font:** Avenir Next for labels, Menlo for compact numeric metadata

**Character:** The serif display voice gives the app a journal-like warmth, while the sans body keeps repeated controls and settings legible. This pairing is useful only when each role stays disciplined.

### Hierarchy
- **Display** (regular, 32px, 36px line-height): Welcome, screen-level emotional prompts, and expressive empty states.
- **Headline** (regular, 26px, 30px line-height): Secondary page titles, modal titles, and compact screen headings.
- **Title** (700, 17px, tight line-height): Card names, setting rows, list section names, and primary component labels.
- **Body** (regular, 15px, 22px line-height): Notes, descriptions, settings copy, and helper text. Prose should stay within 65-75ch.
- **Label** (600, 12px, 0.8px letter-spacing, uppercase when needed): Section labels, metadata, and compact state markers.

### Named Rules

**The Serif Has a Job Rule.** Use the display serif for screen prompts and reflective moments only. Do not use it in buttons, tab labels, settings rows, or dense data.

**The Number Clarity Rule.** Mood values, averages, counts, and dates use tabular numerals where possible because users compare them repeatedly.

## 4. Elevation

Moodinator uses a hybrid of tonal layering and soft ambient shadow. Light mode shadows are warm and low-opacity, mostly to separate paper layers. Dark mode relies more on tonal contrast, with restrained shadow only for lifted sheets and cards.

### Shadow Vocabulary
- **Card Ambient Light** (`0 5px 14px rgba(157, 134, 96, 0.08)`): Default card lift on light paper.
- **Card Ambient Dark** (`0 5px 14px rgba(20, 30, 26, 0.24)`): Dark-mode card lift, used sparingly.
- **Row Lift Light** (`0 2px 8px rgba(157, 134, 96, 0.06)`): Settings rows and small repeated surfaces.
- **Mood Pill Lift** (`0 3px 8px currentColor at 18% opacity`): Selected mood pill emphasis.

### Named Rules

**The Paper Layers Rule.** Prefer tonal separation before shadow. If a surface can be separated with `paper-soft`, a border, or spacing, do that first.

**The Native Shadow Rule.** In native screens, avoid NativeWind `shadow-*` utilities. Use inline iOS shadow props plus Android `elevation`.

## 5. Components

### Buttons
- **Shape:** Soft rounded rectangle (16px radius), never pill-by-default.
- **Primary:** Grounded Sage fill with Paper Surface text, minimum 44px height, 12px vertical and 24px horizontal padding.
- **Hover / Focus:** Browser previews use a subtle lift and a sage focus ring. Native uses pressed opacity or haptic feedback.
- **Secondary / Ghost:** Paper or transparent background, warm border, ink text, and sage icon or active state.

### Chips
- **Style:** Small rounded rectangles (12px radius) with role-tinted backgrounds and readable role text.
- **State:** Selected chips invert into their role color with paper text. Unselected chips stay quiet with a border or tonal wash.

### Cards / Containers
- **Corner Style:** Large soft corners (20-24px), matching the app's existing `rounded-3xl` vocabulary.
- **Background:** Paper Surface in light mode, Forest Surface or Forest Lifted in dark mode.
- **Shadow Strategy:** Ambient, warm, and low opacity. Avoid heavy floating panels.
- **Border:** One-pixel warm borders are allowed. Colored side stripes are not part of the future design vocabulary.
- **Internal Padding:** Usually 16-24px depending on density.

### Inputs / Fields
- **Style:** Paper Soft background, warm border, 16px radius, body typography.
- **Focus:** Sage border or ring, not a glow.
- **Error / Disabled:** Coral for error text and borders, muted brown for disabled copy, with icon or text support so color is never the only signal.

### Navigation
- **Style:** Three-tab product navigation with Ionicons. Active state uses sage and clear text contrast; inactive state uses muted brown or warm paper gray.
- **Mobile treatment:** Bottom tabs remain familiar and native. Browser preview may use a phone frame but should keep the same tab vocabulary.

### Mood Selector

The mood selector is the signature component. It uses the inverted scale where 0 is best and 10 is worst, with number-first buttons and labels. The selector must make that direction explicit through labels and ordering, not through color alone.

### Therapist Export

Export surfaces should feel like preparing a private record for a chosen professional. Use sand or dusk accents, clear summaries, and explicit consent language. Never imply automatic sync or external analysis.

## 6. Do's and Don'ts

### Do:
- **Do** keep the default register product-focused: familiar controls, predictable navigation, and fast repeated use.
- **Do** preserve local-only language in data, export, privacy, and security surfaces.
- **Do** use Ionicons for iconography, not emoji, with the established role colors: leaf sage, heart coral, calendar dusk, lock sand.
- **Do** make mood direction clear in text because lower numbers are better.
- **Do** use coral carefully for difficult states without making the screen feel punitive or diagnostic.
- **Do** use warm paper neutrals and botanical dark surfaces instead of pure white or pure black.

### Don't:
- **Don't** create clinical UI, hospital-like layouts, or surgical sterility.
- **Don't** use generic AI-dashboard aesthetics, glassmorphism by default, gradient text, or decorative data cards.
- **Don't** make the product feel forced, gamified, extractive, or like data is being harvested.
- **Don't** use colored side-stripe borders on cards, list items, callouts, or alerts. Use full borders, icon badges, headers, or tonal backgrounds instead.
- **Don't** call insights diagnoses or imply the app evaluates the user.
- **Don't** change data collection, storage, or sharing without updating legal docs and in-app settings copy together.
