-- Seed sample course reviews (testimonials linked to courses)

INSERT INTO testimonials (
  id, type, person_name, credentials, course_id, course_label, rating,
  quote, sort_order, status, published_at, is_featured
)
SELECT
  v.id::uuid,
  'text',
  v.person_name,
  v.credentials,
  c.id,
  c.title,
  v.rating,
  v.quote,
  v.sort_order,
  'published',
  now(),
  false
FROM (
  VALUES
    (
      'a4100000-0000-4000-8000-000000000001',
      'diploma-in-clinical-cosmetology',
      'Dr. Ananya Mehta',
      'MBBS, Aesthetic Physician',
      5.0,
      'The diploma gave me a clear clinical foundation and the hands-on days were genuinely useful. I started offering peels and PRP confidently within weeks.',
      0
    ),
    (
      'a4100000-0000-4000-8000-000000000002',
      'diploma-in-clinical-cosmetology',
      'Dr. Rohan Kapoor',
      'BDS',
      4.5,
      'Structured modules, practical mentorship, and realistic case discussions. Exactly what I needed to move from theory into clinic practice.',
      1
    ),
    (
      'a4100000-0000-4000-8000-000000000003',
      'pg-diploma-in-clinical-cosmetology',
      'Dr. Sneha Iyer',
      'MBBS, MD Dermatology',
      5.0,
      'PGDCC is comprehensive — lasers, injectables, and regenerative aesthetics covered with real patient exposure. Faculty feedback was excellent.',
      0
    ),
    (
      'a4100000-0000-4000-8000-000000000004',
      'pg-diploma-in-clinical-cosmetology',
      'Dr. Vikram Shah',
      'BAMS',
      4.5,
      'The hybrid format worked perfectly with my clinic schedule. Live lectures plus intensive hands-on days built skills I use every week.',
      1
    ),
    (
      'a4100000-0000-4000-8000-000000000005',
      'pg-diploma-in-clinical-cosmetology',
      'Dr. Priya Nair',
      'MDS',
      5.0,
      'Clear protocols, small batches, and supervised procedures. I recommend PGDCC to colleagues looking for serious clinical training.',
      2
    )
) AS v(id, course_slug, person_name, credentials, rating, quote, sort_order)
JOIN courses c ON c.slug = v.course_slug AND c.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM testimonials t WHERE t.id = v.id::uuid
);

-- Sync course rating from published reviews
UPDATE courses c
SET rating = sub.avg_rating,
    updated_at = now()
FROM (
  SELECT course_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
  FROM testimonials
  WHERE deleted_at IS NULL
    AND status = 'published'
    AND course_id IS NOT NULL
    AND rating IS NOT NULL
  GROUP BY course_id
) sub
WHERE c.id = sub.course_id
  AND c.deleted_at IS NULL;
