# Design direction (reskin 2026-10-02)

Subject: a gamified career/major path planner for students and families; the metaphor is a quest board with resources (skill / network / capital / energy), levels and weekly actions.

- Palette: cool pale-blue page, white cards, deep navy for the side rail and the "focus" cards. One game-reward accent (quest gold) for the main call to action and hover/selection. The four resource colours (green skill, blue network, amber capital, red energy) are semantic and only used for those meters and warnings. No cream/paper tones, no grid-paper background.
- Type: system sans only (no web fonts, offline-safe); heavy weight for headings and numerals, no serif, no italics, no monospace. Eyebrows are plain small caps-free labels without numbering.
- Shape: 10px card radius, 4px for tags/badges; buttons are rectangular "keys" with a 2px navy border and a 3px press shadow that sinks on :active (no pills).
- Density: roomy cards on a 4px-based scale; long single page kept, nav and copy unchanged.
- Tokens: everything authored lives in the `:root` block at the top of `styles.css` (primitive -> semantic -> component). Breakpoints (literal, documented there): 1180px, 760px.
- Note: ranking numbers on majors (1-10) and "Lv.N" level labels are data (rank / game level), not section labels, and were kept.
