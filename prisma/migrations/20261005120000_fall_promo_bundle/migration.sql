-- The Start of Fall Special (service-catalog.ts: fall-boots), after the three standing Bundles.
INSERT INTO "bundles" ("id", "name", "priceCents", "perks", "position", "updatedAt") VALUES
    ('fall-boots', 'Start of Fall Special: 3 Boots', 12000, ARRAY['Basic Clean, Boot Restoration or Fall Finish, chosen after inspection', 'Deep clean, stain lift, scuff repair, suede revival', 'UGGs, Timberlands, any boot type', 'Suede fee waived', 'Typical turnaround 3–7 business days'], 3, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
