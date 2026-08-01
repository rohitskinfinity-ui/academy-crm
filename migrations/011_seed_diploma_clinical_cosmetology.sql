-- =============================================================================
-- 011: Seed Diploma in Clinical Cosmetology as a second course (keep PGDCC)
-- Creates 5 new treatments; reuses overlapping treatments by slug from 010.
-- Media URLs left NULL for manual upload.
-- =============================================================================

-- Category
INSERT INTO course_categories (id, slug, title, icon, sort_order)
VALUES (
  'a1100000-0000-4000-8000-000000000001',
  'diploma',
  'Diploma',
  NULL,
  2
)
ON CONFLICT (slug) DO NOTHING;

-- Campus (reuse from 010 if present)
INSERT INTO campuses (id, name, city, address, is_active)
VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'Skinfinity Academy of Cosmetology',
  NULL,
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- New treatments (modules 01, 02, 03, 08, 12)
-- -----------------------------------------------------------------------------

INSERT INTO treatments (id, slug, name, summary, image_url, status, sort_order, currency)
VALUES
(
  'b2000000-0000-4000-8000-000000000001',
  'introduction-to-clinical-cosmetology',
  'Introduction to Clinical Cosmetology',
  'Aesthetic dermatology landscape, scope of practice, ethics, consultation, and clinic setup.',
  NULL,
  'published',
  1,
  'INR'
),
(
  'b2000000-0000-4000-8000-000000000002',
  'skin-anatomy-physiology-assessment',
  'Skin – Anatomy, Physiology & Assessment',
  'Skin layers, physiology, Fitzpatrick/Glogau classification, ageing, and pre-treatment assessment.',
  NULL,
  'published',
  2,
  'INR'
),
(
  'b2000000-0000-4000-8000-000000000003',
  'hair-biology-disorders-management',
  'Hair – Biology, Disorders & Management',
  'Hair follicle biology, alopecia classification, trichoscopy, and scalp disorder management.',
  NULL,
  'published',
  3,
  'INR'
),
(
  'b2000000-0000-4000-8000-000000000008',
  'clear-lift-exosomes',
  'Clear Lift & Exosomes',
  'Observation of advanced treatments: CO2, MNRF, Dermapen 4, DermaFrac, and HIFU.',
  NULL,
  'published',
  8,
  'INR'
),
(
  'b2000000-0000-4000-8000-000000000012',
  'skin-tightening-devices',
  'Skin Tightening Devices',
  'Clinical overview of skin tightening device platforms used in aesthetic practice.',
  NULL,
  'published',
  12,
  'INR'
)
ON CONFLICT (slug) DO NOTHING;

-- Stages for new treatments
INSERT INTO treatment_stages (id, treatment_id, stage, title, description, checklist, sort_order)
SELECT v.id::uuid, v.treatment_id::uuid, v.stage::treatment_stage, v.title, NULL, v.checklist::jsonb, v.sort_order
FROM (VALUES
  -- Module 01
  ('c2000000-0000-4000-8000-000000000101', 'b2000000-0000-4000-8000-000000000001', 'theory', 'Theory',
   '["Overview of the aesthetic dermatology landscape in India and globally","Scope of practice for MBBS, BDS, BAMS, BHMS, and MDS practitioners","Ethics, medicolegal framework, and informed consent in cosmetic practice","Patient consultation techniques, documentation, and clinical photography","Setting up and managing a cosmetic clinic or aesthetic practice"]', 0),
  ('c2000000-0000-4000-8000-000000000102', 'b2000000-0000-4000-8000-000000000001', 'observation', 'Observation', '[]', 1),
  ('c2000000-0000-4000-8000-000000000103', 'b2000000-0000-4000-8000-000000000001', 'training', 'Training', '[]', 2),
  ('c2000000-0000-4000-8000-000000000104', 'b2000000-0000-4000-8000-000000000001', 'hands-on', 'Hands-on', '[]', 3),
  -- Module 02
  ('c2000000-0000-4000-8000-000000000201', 'b2000000-0000-4000-8000-000000000002', 'theory', 'Theory',
   '["Detailed anatomy of skin layers: epidermis, dermis, and hypodermis","Skin physiology: barrier function, pigmentation, and sebaceous activity","Fitzpatrick skin phototypes and Glogau classification of photoageing","Skin ageing: intrinsic vs extrinsic factors and their clinical implications","Skin assessment tools and pre-treatment evaluation"]', 0),
  ('c2000000-0000-4000-8000-000000000202', 'b2000000-0000-4000-8000-000000000002', 'observation', 'Observation', '[]', 1),
  ('c2000000-0000-4000-8000-000000000203', 'b2000000-0000-4000-8000-000000000002', 'training', 'Training', '[]', 2),
  ('c2000000-0000-4000-8000-000000000204', 'b2000000-0000-4000-8000-000000000002', 'hands-on', 'Hands-on', '[]', 3),
  -- Module 03
  ('c2000000-0000-4000-8000-000000000301', 'b2000000-0000-4000-8000-000000000003', 'theory', 'Theory',
   '["Hair follicle anatomy and the hair growth cycle (anagen, catagen, telogen)","Classification of alopecia: androgenetic, alopecia areata, telogen effluvium","Clinical evaluation of hair loss: trichoscopy and scalp assessment","Overview of medical and procedural management options for hair disorders","Scalp conditions: seborrhoea, dandruff, folliculitis, and their management"]', 0),
  ('c2000000-0000-4000-8000-000000000302', 'b2000000-0000-4000-8000-000000000003', 'observation', 'Observation', '[]', 1),
  ('c2000000-0000-4000-8000-000000000303', 'b2000000-0000-4000-8000-000000000003', 'training', 'Training', '[]', 2),
  ('c2000000-0000-4000-8000-000000000304', 'b2000000-0000-4000-8000-000000000003', 'hands-on', 'Hands-on', '[]', 3),
  -- Module 08
  ('c2000000-0000-4000-8000-000000000801', 'b2000000-0000-4000-8000-000000000008', 'theory', 'Theory',
   '["Observation of advanced treatments: CO2 laser","Observation of advanced treatments: MNRF","Observation of advanced treatments: Dermapen 4","Observation of advanced treatments: DermaFrac","Observation of advanced treatments: HIFU"]', 0),
  ('c2000000-0000-4000-8000-000000000802', 'b2000000-0000-4000-8000-000000000008', 'observation', 'Observation', '[]', 1),
  ('c2000000-0000-4000-8000-000000000803', 'b2000000-0000-4000-8000-000000000008', 'training', 'Training', '[]', 2),
  ('c2000000-0000-4000-8000-000000000804', 'b2000000-0000-4000-8000-000000000008', 'hands-on', 'Hands-on', '[]', 3),
  -- Module 12
  ('c2000000-0000-4000-8000-000000001201', 'b2000000-0000-4000-8000-000000000012', 'theory', 'Theory', '[]', 0),
  ('c2000000-0000-4000-8000-000000001202', 'b2000000-0000-4000-8000-000000000012', 'observation', 'Observation', '[]', 1),
  ('c2000000-0000-4000-8000-000000001203', 'b2000000-0000-4000-8000-000000000012', 'training', 'Training', '[]', 2),
  ('c2000000-0000-4000-8000-000000001204', 'b2000000-0000-4000-8000-000000000012', 'hands-on', 'Hands-on', '[]', 3)
) AS v(id, treatment_id, stage, title, checklist, sort_order)
WHERE EXISTS (SELECT 1 FROM treatments t WHERE t.id = v.treatment_id::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM treatment_stages ts
    WHERE ts.treatment_id = v.treatment_id::uuid AND ts.stage = v.stage::treatment_stage
  );

-- Booklet placeholders for new treatments
INSERT INTO treatment_booklets (id, treatment_id, stage, name, file_url, drive_url, sort_order)
SELECT v.id::uuid, v.treatment_id::uuid, 'theory'::treatment_stage, v.name, NULL, NULL, 0
FROM (VALUES
  ('d2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Introduction to Clinical Cosmetology Study Material'),
  ('d2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'Skin – Anatomy, Physiology & Assessment Study Material'),
  ('d2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000003', 'Hair – Biology, Disorders & Management Study Material'),
  ('d2000000-0000-4000-8000-000000000008', 'b2000000-0000-4000-8000-000000000008', 'Clear Lift & Exosomes Study Material'),
  ('d2000000-0000-4000-8000-000000000012', 'b2000000-0000-4000-8000-000000000012', 'Skin Tightening Devices Study Material')
) AS v(id, treatment_id, name)
WHERE EXISTS (SELECT 1 FROM treatments t WHERE t.id = v.treatment_id::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM treatment_booklets tb WHERE tb.id = v.id::uuid
  );

-- -----------------------------------------------------------------------------
-- Course
-- -----------------------------------------------------------------------------

INSERT INTO courses (
  id,
  slug,
  title,
  description,
  image_url,
  duration_label,
  mode,
  level,
  category_id,
  list_price,
  currency,
  certificate_label,
  tag,
  is_bestseller,
  is_customizable,
  status,
  seo_title,
  seo_description,
  published_at,
  programme_meta,
  eligible_qualifications
)
VALUES (
  'e2000000-0000-4000-8000-000000000001',
  'diploma-in-clinical-cosmetology',
  'Diploma in Clinical Cosmetology',
  'The Diploma in Clinical Cosmetology offered by Skinfinity Academy is a streamlined, high-impact programme crafted for licensed medical practitioners who wish to establish or expand their practice in aesthetic and cosmetic medicine.

Spanning 3 months with one live lecture per week and 6 intensive hands-on training days, the programme delivers focused, clinically practical education across 13 carefully sequenced modules — from foundational skin science to advanced laser therapies, vampire facials, QR678 hair treatments, and beyond.

Whether you are newly entering the aesthetic space or looking to formalise your cosmetic skills with a recognised diploma, this programme provides the structured clinical education you need to practise with confidence, safety, and excellence.',
  NULL,
  '3 Months',
  'hybrid',
  'intermediate',
  (SELECT id FROM course_categories WHERE slug = 'diploma' LIMIT 1),
  NULL,
  'INR',
  'Diploma',
  'Diploma',
  false,
  false,
  'published',
  'Diploma in Clinical Cosmetology | Skinfinity Academy',
  'A concise 3-month diploma for medical practitioners seeking practical clinical education in aesthetic and cosmetic medicine across 13 structured modules.',
  now(),
  '{
    "live_lectures_per_week": 1,
    "hands_on_days_total": 6,
    "hands_on_months": 1,
    "module_count": 13,
    "programme_duration_months": 3
  }'::jsonb,
  ARRAY['MBBS', 'BAMS', 'MDS', 'BHMS', 'BDS']::text[]
)
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- course_treatments (resolve treatment_id by slug)
-- -----------------------------------------------------------------------------

INSERT INTO course_treatments (
  id, course_id, treatment_id, sort_order, hands_on_default, delivery_modes, live_sessions_planned
)
SELECT
  v.id::uuid,
  c.id,
  t.id,
  v.sort_order,
  v.hands_on_default,
  v.delivery_modes::text[],
  1
FROM (VALUES
  ('f2000000-0000-4000-8000-000000000001', 'introduction-to-clinical-cosmetology', 1,  false, '{lecture}'),
  ('f2000000-0000-4000-8000-000000000002', 'skin-anatomy-physiology-assessment',   2,  false, '{lecture}'),
  ('f2000000-0000-4000-8000-000000000003', 'hair-biology-disorders-management',   3,  false, '{lecture}'),
  ('f2000000-0000-4000-8000-000000000004', 'mda-peels',                            4,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000005', 'hydra-facial-photo-facial',            5,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000006', 'vampire-facial-dermafrac',             6,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000007', 'hair-mesotherapy-qr678',               7,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000008', 'clear-lift-exosomes',                  8,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000009', 'laser-hair-reduction',                 9,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000010', 'q-switch-laser',                      10,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000011', 'cautery-minor-procedures',            11,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000012', 'skin-tightening-devices',             12,  true,  '{lecture,hands_on}'),
  ('f2000000-0000-4000-8000-000000000013', 'clinical-review',                     13,  false, '{lecture}')
) AS v(id, treatment_slug, sort_order, hands_on_default, delivery_modes)
JOIN courses c ON c.slug = 'diploma-in-clinical-cosmetology'
JOIN treatments t ON t.slug = v.treatment_slug AND t.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM course_treatments ct
  WHERE ct.course_id = c.id AND ct.treatment_id = t.id
);

-- -----------------------------------------------------------------------------
-- FAQs
-- -----------------------------------------------------------------------------

INSERT INTO course_faqs (id, course_id, question, answer, sort_order)
SELECT v.id::uuid, c.id, v.question, v.answer, v.sort_order
FROM (VALUES
  (
    'a3100000-0000-4000-8000-000000000001',
    'Who is eligible for this diploma?',
    'This diploma is open to graduates holding recognised medical degrees: MBBS, BAMS, MDS, BHMS, and BDS.',
    1
  ),
  (
    'a3100000-0000-4000-8000-000000000002',
    'What is the programme duration and structure?',
    'The diploma is a 3-month structured curriculum with 1 live online lecture per week, interactive Q&A and case discussions, comprehensive study material, and 1 month of intensive hands-on training (6 days) at Skinfinity Academy with live patient procedures under expert guidance.',
    2
  ),
  (
    'a3100000-0000-4000-8000-000000000003',
    'How many modules does the course include?',
    'The programme is delivered across 13 progressive modules covering essential and applied clinical cosmetology — from foundational skin and hair science to lasers, regenerative aesthetics, and clinical review.',
    3
  ),
  (
    'a3100000-0000-4000-8000-000000000004',
    'What does hands-on training involve?',
    'Hands-on training is conducted at Skinfinity Academy with live patient procedures under expert guidance. Skill assessment is by senior faculty. A minimum attendance threshold applies.',
    4
  ),
  (
    'a3100000-0000-4000-8000-000000000005',
    'What certificate is awarded?',
    'A diploma certificate is awarded upon successful completion. Live lecture attendance and successful completion of assessments are mandatory. This is a vocational diploma and does not confer a formal postgraduate medical degree.',
    5
  ),
  (
    'a3100000-0000-4000-8000-000000000006',
    'Why choose Skinfinity Academy?',
    'Expert faculty with extensive clinical and academic credentials; advanced clinic infrastructure with the latest aesthetic technology; small cohort sizes for personalised mentorship; curriculum built on evidence-based practice and real-world clinical scenarios; and a recognised diploma with a strong alumni network.',
    6
  ),
  (
    'a3100000-0000-4000-8000-000000000007',
    'Are there important scope-of-practice considerations?',
    'All procedures must be performed in accordance with the practitioner''s degree-specific scope of practice and applicable state/national medical regulations. Skinfinity Academy reserves the right to modify module content, schedule, or faculty to maintain clinical relevance and quality. Seat availability is limited per cohort.',
    7
  )
) AS v(id, question, answer, sort_order)
JOIN courses c ON c.slug = 'diploma-in-clinical-cosmetology'
WHERE NOT EXISTS (
  SELECT 1 FROM course_faqs f WHERE f.id = v.id::uuid
);
