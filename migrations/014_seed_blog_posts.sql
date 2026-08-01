-- Seed blog categories + sample posts for public/admin blog

INSERT INTO blog_categories (id, slug, name)
VALUES
  ('c4100000-0000-4000-8000-000000000001', 'clinical-insights', 'Clinical Insights'),
  ('c4100000-0000-4000-8000-000000000002', 'programme-updates', 'Programme Updates'),
  ('c4100000-0000-4000-8000-000000000003', 'career', 'Career')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO blog_posts (
  id, slug, category_id, title, excerpt, body, image_url, author_name,
  read_time_minutes, status, published_at, seo_title, seo_description
)
SELECT
  v.id::uuid,
  v.slug,
  c.id,
  v.title,
  v.excerpt,
  v.body,
  NULL,
  'Skinfinity Academy',
  v.read_time,
  'published',
  now() - (v.days_ago || ' days')::interval,
  v.title,
  v.excerpt
FROM (
  VALUES
    (
      'b4100000-0000-4000-8000-000000000001',
      'getting-started-with-clinical-cosmetology',
      'clinical-insights',
      'Getting Started with Clinical Cosmetology',
      'A practical overview of how medical graduates begin aesthetic practice with structured training.',
      E'Clinical cosmetology blends medical science with aesthetic outcomes. For doctors entering this field, the most important first step is choosing a programme that balances theory, live cases, and supervised hands-on practice.\n\nAt Skinfinity Academy, our diploma pathways are designed for licensed medical graduates who want clinic-ready skills — from skin assessment and peels to lasers and regenerative therapies.\n\nStart with fundamentals, practise under faculty supervision, and build protocols you can take back to your own clinic.',
      5,
      12
    ),
    (
      'b4100000-0000-4000-8000-000000000002',
      'diploma-vs-pgdcc-which-path-fits-you',
      'programme-updates',
      'Diploma vs PGDCC: Which Path Fits You?',
      'Compare our 3-month Diploma and 6-month PG Diploma so you can choose the right intensity and curriculum depth.',
      E'Both programmes focus on clinical excellence, but they serve different goals.\n\nThe Diploma in Clinical Cosmetology is a focused 3-month pathway covering essential modules with intensive hands-on exposure — ideal if you want to start practising core aesthetic procedures quickly.\n\nThe PG Diploma (PGDCC) is a deeper 6-month programme with broader device training, more modules, and extended clinical mentoring — better suited for practitioners building a full aesthetic practice.\n\nSpeak with admissions if you are unsure; we help match your background and clinic goals to the right programme.',
      6,
      7
    ),
    (
      'b4100000-0000-4000-8000-000000000003',
      'building-confidence-with-hands-on-training',
      'career',
      'Building Confidence with Hands-on Training',
      'Why real-patient exposure under senior faculty is the fastest way to clinical confidence.',
      E'Reading protocols is not the same as performing them. Hands-on days at Skinfinity are structured around live patient procedures, faculty checkpoints, and immediate feedback.\n\nDoctors repeatedly tell us that supervised practice is where confidence compounds — case selection, complication awareness, and communication with patients all improve together.\n\nIf you are evaluating programmes, ask how many live sessions you will attend and how assessment works. Those details matter more than brochure claims.',
      4,
      3
    )
) AS v(id, slug, category_slug, title, excerpt, body, read_time, days_ago)
JOIN blog_categories c ON c.slug = v.category_slug
WHERE NOT EXISTS (
  SELECT 1 FROM blog_posts p WHERE p.id = v.id::uuid OR p.slug = v.slug
);
