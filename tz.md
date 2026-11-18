# Technical Specification (TZ) — "Asbob-uskunalar ijarasi" (Tool & Equipment Rental)

> Source: `shartlar.jpg` — competition task "Eng yaxshi veb-sayt | Viloyat bosqichi", page 5/11, category *Jihoz va ijara*.
> Scope of this phase: **UI only**, built with **Next.js**, using **seeded (hard-coded) data**. No backend, no database, no real requests.

---

## 1. Goal (paraphrased)

Build a simple, working website that helps a user **find a tool they need for a one-time job** and **calculate how much renting it will cost**. The user browses a catalog of 6 tools, picks one, enters the number of rental days (1–7), sees the total price, enters their name, and submits a rental request. A confirmation screen then summarizes the request.

The site is a **demo/prototype**: no real purchase, booking, or message is ever sent.

---

## 2. Tech stack

| Item | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS (or CSS Modules — pick one and stay consistent) |
| State | React local state (`useState`) — no global store needed |
| Data | Static seed file `src/data/tools.ts` |
| Backend / API | **None** in this phase |
| Package manager | npm |
| Target browsers | Latest Chrome, Firefox, Edge, Safari; mobile ≥ 360px width |

UI language: **Uzbek (Latin script)**. All user-visible labels in this document are given in Uzbek as they must appear.

---

## 3. Seed data

File: `src/data/tools.ts`

```ts
export type Tool = {
  id: string;          // "A01".."A06"
  name: string;        // display name
  description: string; // short description
  pricePerDay: number; // in so'm, integer
};

export const tools: Tool[] = [
  { id: "A01", name: "Drel",             description: "Teshish ishlari uchun",      pricePerDay: 30000 },
  { id: "A02", name: "Narvon",           description: "Uy ichidagi ishlar uchun",   pricePerDay: 20000 },
  { id: "A03", name: "Proyektor",        description: "Taqdimot uchun",             pricePerDay: 100000 },
  { id: "A04", name: "Mikrofon",         description: "Kichik tadbir uchun",        pricePerDay: 40000 },
  { id: "A05", name: "Tikuv mashinasi",  description: "Oddiy tikish ishlari uchun", pricePerDay: 60000 },
  { id: "A06", name: "Gilam tozalagich", description: "Gilam tozalash uchun",       pricePerDay: 80000 },
];
```

Optional (UI polish, not required): an `image` field per tool pointing to `/public/tools/A01.svg` etc. If no image exists, show an icon/placeholder.

### 3.1 Price formatting

- Prices are displayed with a space as thousands separator and the suffix `so'm`: `30 000 so'm`, `200 000 so'm`.
- Implement a helper `formatSom(n: number): string` in `src/lib/format.ts`
  (e.g. `n.toLocaleString("ru-RU").replace(/ /g, " ") + " so'm"` or a manual implementation).

---

## 4. Pages & routes

The app can be a single page with a modal, or multiple routes. Recommended structure:

| Route | Purpose |
|---|---|
| `/` | Header + intro + catalog grid of 6 tool cards |
| `/ijara/[id]` | Rental form for the selected tool (e.g. `/ijara/A03`) |
| `/ijara/[id]/tasdiq` | Confirmation screen (data passed via query params or client state) |

**Alternative (acceptable):** everything on `/`, with the rental form opened in a modal/side panel and the confirmation shown in the same modal. Whichever is chosen, the behavior in sections 5–7 must be identical.

Unknown `id` in `/ijara/[id]` → show Next.js `notFound()` page with a link back to the catalog.

---

## 5. Functional requirements

### FR-1 — Catalog of tools (cards)
- Show **all 6 tools** as cards in a responsive grid (1 column on mobile, 2 on tablet, 3 on desktop).
- Each card shows:
  - Tool ID (small badge, e.g. `A01`)
  - Name (`Drel`)
  - Short description (`Teshish ishlari uchun`)
  - Daily price (`30 000 so'm / kun`)
  - Button **"Tanlash"** (Select)
- The whole card or the button is clickable; keyboard accessible (Tab + Enter).

### FR-2 — Rental form opens on selection
- When a tool is selected, the rental form opens and displays the selected tool's:
  - **name**, **description**, **daily price** (read-only summary at the top of the form).
- The user can go back to the catalog ("Orqaga" link/button) or close the modal.

### FR-3 — Number of days & total price
- Field **"Kunlar soni"** (number of days):
  - Input type `number`, `min=1`, `max=7`, `step=1`.
  - Allowed values: **integers 1 to 7 inclusive** only.
  - Default value: `1` (or empty — but then total shows `—`).
- **Total** is calculated live as the user types:

  ```
  Jami = kunlar soni × kunlik narx
  ```
- Display: `Jami: 90 000 so'm`.
- If the days value is invalid, the total shows `—` (not `NaN`, not a wrong number).

### FR-4 — Name field & submission
- Field **"Ismingiz"** (your name) — **required**.
  - Trimmed value must be non-empty (whitespace-only counts as empty).
  - Recommended: max length 50 characters.
- Submit button labelled exactly **"Ijara so'rovi"**.
- On submit, run validation (section 6). If any error → show messages, **do not** show confirmation.
- If valid → show confirmation (FR-5). No network request is made.

### FR-5 — Confirmation
The confirmation screen/block shows:
- Tool name (e.g. `Proyektor`)
- Number of days (e.g. `2 kun`)
- Total price (e.g. `200 000 so'm`)
- User's name

Plus:
- A note: *"Bu sinov loyihasi: haqiqiy ijara amalga oshirilmaydi."*
- Button **"Yangi so'rov"** / **"Katalogga qaytish"** that resets the form and returns to the catalog.

---

## 6. Validation rules

| Field | Rule | Error message (Uzbek) |
|---|---|---|
| Kunlar soni | Required | `Kunlar sonini kiriting` |
| Kunlar soni | Must be an integer (no `2.5`, no `1,5`) | `Kunlar soni butun son bo'lishi kerak` |
| Kunlar soni | 1 ≤ value ≤ 7 | `Kunlar soni 1 dan 7 gacha bo'lishi kerak` |
| Ismingiz | Not empty after `trim()` | `Ismni kiriting` |

Implementation notes:
- Do **not** rely only on HTML `min/max` attributes — validate in JS on submit (and optionally on blur/change).
- Read the days input as a string and validate with `/^\d+$/` before converting with `Number()`, so values like `2.5`, `1e1`, `-3`, `07.0` are handled correctly.
- Error messages appear directly under the related field, in red, with `aria-invalid="true"` and `aria-describedby` linking to the message.
- The submit button may stay enabled; submitting with errors just shows errors and keeps the user on the form.

Put pure logic in `src/lib/rental.ts` so it is testable:

```ts
export function validateDays(raw: string): string | null;   // returns error text or null
export function validateName(raw: string): string | null;
export function calcTotal(days: number, pricePerDay: number): number;
```

---

## 7. Acceptance tests (must pass)

| # | Steps | Expected |
|---|---|---|
| T1 | Select **A01 (Drel)**, enter **3** days | Total shows **90 000 so'm** |
| T2 | Select **A03 (Proyektor)**, enter **2** days, name "Ali", submit | Confirmation shows **Proyektor**, **2 kun**, **200 000 so'm**, **Ali** |
| T3 | Days = **0**, submit | Error shown, no confirmation |
| T4 | Days = **8**, submit | Error shown, no confirmation |
| T5 | Days = **2.5** (fraction), submit | Error shown, no confirmation |
| T6 | Valid days, name empty or only spaces, submit | `Ismni kiriting` error, no confirmation |
| T7 | Open catalog | Exactly 6 cards with correct names, descriptions, prices |
| T8 | Reload `/ijara/A99` (if routes used) | Not-found page with link back |

Additional sanity checks (all 6 tools × 1 and 7 days):

| ID | 1 day | 7 days |
|---|---|---|
| A01 | 30 000 | 210 000 |
| A02 | 20 000 | 140 000 |
| A03 | 100 000 | 700 000 |
| A04 | 40 000 | 280 000 |
| A05 | 60 000 | 420 000 |
| A06 | 80 000 | 560 000 |

---

## 8. UI / UX requirements

- **Layout:** header with site title *"Asbob-uskunalar ijarasi"* and subtitle *"Bir martalik ish uchun kerakli asbobni toping va ijara narxini hisoblang"*; main content; footer with *"Sinov loyihasi"* note.
- **Responsive:** works from 360px to 1440px+, no horizontal scrolling.
- **Accessibility:**
  - All inputs have visible `<label>`s.
  - Focus states visible on all interactive elements.
  - Color contrast ≥ WCAG AA.
  - Modal (if used) traps focus and closes on `Esc`.
- **Feedback:** total updates instantly; selected tool is clearly highlighted; confirmation is visually distinct (e.g. green success panel with a check icon).
- **Optional nice-to-haves** (only if time allows, not required):
  - Search/filter by name on the catalog.
  - Quick day buttons (1, 3, 7) next to the input.
  - Dark mode.

---

## 9. Suggested project structure

```
src/
  app/
    layout.tsx            # html shell, header, footer, fonts
    page.tsx              # catalog
    ijara/
      [id]/
        page.tsx          # rental form (client component inside)
        tasdiq/page.tsx   # confirmation
    not-found.tsx
  components/
    ToolCard.tsx
    ToolGrid.tsx
    RentalForm.tsx        # "use client"
    Confirmation.tsx
    PriceTag.tsx
  data/
    tools.ts              # seed data (section 3)
  lib/
    format.ts             # formatSom
    rental.ts             # validateDays, validateName, calcTotal
public/
  tools/                  # optional images
```

---

## 10. Out of scope (do NOT implement)

As stated in the task ("Vazifa chegarasi"):
- Deposit (garov)
- Payment (to'lov)
- Contract (shartnoma)
- Delivery (yetkazish)
- Availability calendar (mavjudlik kalendari)
- Chat with the owner (egasi bilan chat)
- Any real purchase, booking, or sending of messages/emails
- Authentication, database, API routes

> Note: the task says *"Umumiy talablar 1-betda berilgan"* — general requirements are on page 1 of the competition document, which is not included in `shartlar.jpg`. Those must also be followed once available (e.g. hosting, file naming, code quality rules).

---

## 11. Definition of done

- [ ] `npm run dev` starts the app without errors; `npm run build` succeeds with no TypeScript/ESLint errors.
- [ ] Catalog shows the 6 seeded tools with correct data.
- [ ] Selecting a tool opens the form with its name, description, price.
- [ ] Total = days × daily price, updates live.
- [ ] Validation blocks 0, 8, fractions, empty/whitespace name.
- [ ] Submit button text is exactly **"Ijara so'rovi"**.
- [ ] Confirmation shows tool, days, total, name.
- [ ] All acceptance tests T1–T8 pass manually.
- [ ] Responsive on mobile and desktop; keyboard-usable.
