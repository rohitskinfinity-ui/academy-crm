-- =============================================================================
-- 010: Wipe all business data and seed PGDCC course (13 modules)
-- Preserves schema and _migrations. Admin is re-seeded by seedAdmin after run.
-- Media URLs left NULL for manual upload in admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1 — Full wipe (keep _migrations)
-- -----------------------------------------------------------------------------

-- Break circular FK: calendar_events <-> live_class_recordings
UPDATE calendar_events
SET live_class_recording_id = NULL,
    recording_status = 'pending'
WHERE live_class_recording_id IS NOT NULL;

TRUNCATE TABLE
  -- Progress / LMS
  quiz_attempts,
  booklet_progress,
  video_progress,
  enrollment_treatment_stages,
  bookmarks,
  notes,
  discussion_posts,
  learning_stats_daily,
  user_achievements,
  achievements,
  -- Assignments
  assignment_feedback,
  assignment_files,
  assignment_submissions,
  assignment_targets,
  assignments,
  -- Live class / calendar
  event_quiz_attempts,
  event_quiz_questions,
  event_quizzes,
  event_attachments,
  event_attendance,
  event_reminders,
  event_registrations,
  live_class_recordings,
  calendar_events,
  -- Enrollment tree
  enrollment_treatments,
  enrollments,
  enrollment_applications,
  -- Payments / certificates / referrals
  payment_receipts,
  payments,
  student_certificates,
  institutional_certificates,
  affiliations,
  referrals,
  referral_codes,
  -- Course structure
  course_treatments,
  course_faqs,
  course_nav_items,
  batches,
  courses,
  -- Treatment library (CASCADE would cover children; listed explicitly)
  quiz_questions,
  treatment_quizzes,
  treatment_booklets,
  treatment_videos,
  treatment_stages,
  treatments,
  -- Catalog helpers
  campuses,
  course_categories,
  -- CMS / marketing
  blog_post_tags,
  blog_posts,
  blog_tags,
  blog_categories,
  testimonials,
  faculty_public,
  leadership,
  faqs,
  hero_banners,
  announcements,
  partners,
  milestones,
  pillars,
  site_stats,
  media_assets,
  leads,
  contact_inquiries,
  newsletter_subscribers,
  callback_requests,
  notifications,
  notification_preferences,
  -- Auth / users (last)
  sessions,
  oauth_accounts,
  student_profiles,
  instructor_profiles,
  users
RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- Part 2 — Seed PGDCC
-- Fixed UUIDs for stable media attachment later
-- -----------------------------------------------------------------------------

-- Category
INSERT INTO course_categories (id, slug, title, icon, sort_order)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'pg-diploma',
  'PG Diploma',
  NULL,
  1
);

-- Campus
INSERT INTO campuses (id, name, city, address, is_active)
VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'Skinfinity Academy of Cosmetology',
  NULL,
  NULL,
  true
);

-- Treatments (13 modules)
INSERT INTO treatments (id, slug, name, summary, image_url, status, sort_order, currency) VALUES
(
  'b1000000-0000-4000-8000-000000000001',
  'mda-peels',
  'MDA Peels',
  'Microdermabrasion and advanced peeling systems: mechanisms, indications, protocols, and combination approaches.',
  NULL,
  'published',
  1,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000002',
  'q-switch-laser',
  'Q-Switch Laser',
  'Q-switched laser technology for pigmented lesions, tattoo removal, melasma, and carbon laser peel.',
  NULL,
  'published',
  2,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000003',
  'laser-hair-reduction',
  'Laser Hair Reduction',
  'Selective photothermolysis for hair reduction across diode, alexandrite, and Nd:YAG systems.',
  NULL,
  'published',
  3,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000004',
  'mnrf',
  'MNRF (Micro-Needling Radiofrequency)',
  'Fractional radiofrequency with microneedling for scars, pores, laxity, stretch marks, and hyperhidrosis.',
  NULL,
  'published',
  4,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000005',
  'co2-laser-hifu',
  'CO2 Laser & HIFU',
  'Fractional ablative CO2 resurfacing and High-Intensity Focused Ultrasound for lifting and tightening.',
  NULL,
  'published',
  5,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000006',
  'prp-gfc-therapy',
  'PRP / GFC Therapy',
  'Platelet-rich plasma and growth factor concentrate for alopecia, rejuvenation, and under-eye hollows.',
  NULL,
  'published',
  6,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000007',
  'vampire-facial-dermafrac',
  'Vampire Facial | DermaFrac',
  'Vampire Facial (PRP + microneedling) and DermaFrac serum infusion for skin rejuvenation.',
  NULL,
  'published',
  7,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000008',
  'dp4-mirapeel-exosomes',
  'DP4 | MiraPeel | Exosomes',
  'Dermal Photon Platform, MiraPeel wet abrasion, and exosome therapy for skin and hair.',
  NULL,
  'published',
  8,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000009',
  'lipolytic-injection',
  'Lipolytic Injection',
  'Injectable lipolytic agents for submental fat, localised adiposity, jowls, and body contouring.',
  NULL,
  'published',
  9,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000010',
  'cautery-minor-procedures',
  'Cautery & Minor Cosmetic Procedures',
  'Electrocautery, mole/DPN/skin tag removal, intralesional injections, and minor OT protocols.',
  NULL,
  'published',
  10,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000011',
  'clinical-review',
  'Clinical Review & Advanced Considerations',
  'Drug interactions, complex patient workup, complications, documentation, and PGDCC exam prep.',
  NULL,
  'published',
  11,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000012',
  'hydra-facial-photo-facial',
  'Hydra Facial & Photo Facial',
  'HydraFacial vortex technology and Photo Facial (Q-Switch) for pigmentation and rejuvenation.',
  NULL,
  'published',
  12,
  'INR'
),
(
  'b1000000-0000-4000-8000-000000000013',
  'hair-mesotherapy-qr678',
  'Hair Mesotherapy, Scalp Treatments & QR678',
  'Scalp mesotherapy, hair cocktails, and QR678 protocols for hair growth stimulation.',
  NULL,
  'published',
  13,
  'INR'
);

-- Treatment stages (theory checklist from DOCX; other stages empty placeholders)
INSERT INTO treatment_stages (id, treatment_id, stage, title, description, checklist, sort_order) VALUES
-- Module 01 MDA Peels
('c1000000-0000-4000-8000-000000000101', 'b1000000-0000-4000-8000-000000000001', 'theory', 'Theory', NULL,
 '["Introduction to Microdermabrasion (MDA) and advanced peeling systems","Mechanism of action: crystal and diamond-tip MDA techniques","Indications: dull skin, mild acne scars, textural irregularities, photoageing","Pre-treatment patient assessment, contraindications, and skin priming","Step-by-step procedural protocols, endpoint recognition, and post-peel care","Combination peel approaches for enhanced clinical outcomes"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000102', 'b1000000-0000-4000-8000-000000000001', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000103', 'b1000000-0000-4000-8000-000000000001', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000104', 'b1000000-0000-4000-8000-000000000001', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 02 Q-Switch
('c1000000-0000-4000-8000-000000000201', 'b1000000-0000-4000-8000-000000000002', 'theory', 'Theory', NULL,
 '["Principles of Q-switched laser technology and photomechanical effect","Wavelengths: 1064 nm, 532 nm, 732 nm — clinical applications","Indications: pigmented lesions, naevus of Ota, tattoo removal, melasma","Laser-tissue interaction, fluence selection, and spot size optimisation","Managing post-laser hyperpigmentation and adverse effects in Indian skin","Carbon laser peel technique and its clinical use"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000202', 'b1000000-0000-4000-8000-000000000002', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000203', 'b1000000-0000-4000-8000-000000000002', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000204', 'b1000000-0000-4000-8000-000000000002', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 03 LHR
('c1000000-0000-4000-8000-000000000301', 'b1000000-0000-4000-8000-000000000003', 'theory', 'Theory', NULL,
 '["Principles of selective photothermolysis applied to laser hair reduction","Laser systems: diode (810 nm), alexandrite (755 nm), Nd:YAG (1064 nm)","Patient selection by Fitzpatrick skin type and hair colour","Parameters: fluence, pulse duration, spot size, and cooling systems","Treatment cycles, session intervals, and expected outcomes","Managing complications: burns, blistering, and paradoxical hypertrichosis"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000302', 'b1000000-0000-4000-8000-000000000003', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000303', 'b1000000-0000-4000-8000-000000000003', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000304', 'b1000000-0000-4000-8000-000000000003', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 04 MNRF
('c1000000-0000-4000-8000-000000000401', 'b1000000-0000-4000-8000-000000000004', 'theory', 'Theory', NULL,
 '["Principles of fractional radiofrequency and its synergy with microneedling","Insulated vs non-insulated needle tips — device-specific protocols","Indications: acne scars, open pores, skin laxity, stretch marks, hyperhidrosis","Treatment depth selection, energy settings, and pass techniques","Pre- and post-procedure care, downtime management, and combination protocols","Comparative overview of MNRF platforms available in India"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000402', 'b1000000-0000-4000-8000-000000000004', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000403', 'b1000000-0000-4000-8000-000000000004', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000404', 'b1000000-0000-4000-8000-000000000004', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 05 CO2 & HIFU
('c1000000-0000-4000-8000-000000000501', 'b1000000-0000-4000-8000-000000000005', 'theory', 'Theory', NULL,
 '["Fractional ablative CO2 laser: principles, resurfacing, and scar revision","Indications: acne scars, periorbital rejuvenation, skin resurfacing, mole removal","HIFU (High-Intensity Focused Ultrasound): mechanism and depth of tissue targeting","Clinical applications of HIFU: facial lifting, jowl tightening, brow lifting","SMAS layer targeting, transducer selection, and energy protocols","Patient preparation, post-procedure care, and managing expectations"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000502', 'b1000000-0000-4000-8000-000000000005', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000503', 'b1000000-0000-4000-8000-000000000005', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000504', 'b1000000-0000-4000-8000-000000000005', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 06 PRP / GFC
('c1000000-0000-4000-8000-000000000601', 'b1000000-0000-4000-8000-000000000006', 'theory', 'Theory', NULL,
 '["Biology of platelets and the mechanism of platelet-rich plasma (PRP) therapy","PRP preparation: centrifugation protocols, activation methods, and quality parameters","GFC (Growth Factor Concentrate): preparation and advantages over standard PRP","Clinical indications: androgenetic alopecia, skin rejuvenation, under-eye hollows","Injection techniques: scalp mesotherapy, intradermal, and subdermal delivery","Session protocols, interval planning, and expected clinical outcomes"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000602', 'b1000000-0000-4000-8000-000000000006', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000603', 'b1000000-0000-4000-8000-000000000006', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000604', 'b1000000-0000-4000-8000-000000000006', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 07 Vampire Facial | DermaFrac
('c1000000-0000-4000-8000-000000000701', 'b1000000-0000-4000-8000-000000000007', 'theory', 'Theory', NULL,
 '["Customisation with boosters: brightening, anti-ageing, and congestion control","Vampire Facial (PRP + Microneedling): combined protocol, rationale, and outcomes","DermaFrac: simultaneous microneedling and infusion of targeted serums","Patient selection, safety profile, and contraindications for each modality","Combining these platforms for enhanced skin rejuvenation results"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000702', 'b1000000-0000-4000-8000-000000000007', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000703', 'b1000000-0000-4000-8000-000000000007', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000704', 'b1000000-0000-4000-8000-000000000007', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 08 DP4 | MiraPeel | Exosomes
('c1000000-0000-4000-8000-000000000801', 'b1000000-0000-4000-8000-000000000008', 'theory', 'Theory', NULL,
 '["DP4 (Dermal Photon Platform): multi-wavelength light therapy and clinical indications","MiraPeel: wet abrasion technology, serum infusion, and dermaplaning integration","Exosome therapy: science of exosomes, extraction methods, and aesthetic applications","Exosomes in hair restoration, skin rejuvenation, and post-laser healing","Combining DP4, MiraPeel, and exosome protocols for comprehensive skin health","Patient counselling, session planning, and outcome documentation"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000802', 'b1000000-0000-4000-8000-000000000008', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000803', 'b1000000-0000-4000-8000-000000000008', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000804', 'b1000000-0000-4000-8000-000000000008', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 09 Lipolytic Injection
('c1000000-0000-4000-8000-000000000901', 'b1000000-0000-4000-8000-000000000009', 'theory', 'Theory', NULL,
 '["Mechanism of action of injectable lipolytic agents (phosphatidylcholine, deoxycholate)","Approved agents and off-label use: safety considerations and regulatory framework","Indications: submental fat, localised adiposity, jowls, and body contouring","Injection technique: depth, volume, grid mapping, and session intervals","Post-injection care, expected swelling, and managing complications","Patient selection, contraindications, and realistic expectation counselling"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000000902', 'b1000000-0000-4000-8000-000000000009', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000000903', 'b1000000-0000-4000-8000-000000000009', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000000904', 'b1000000-0000-4000-8000-000000000009', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 10 Cautery
('c1000000-0000-4000-8000-000000001001', 'b1000000-0000-4000-8000-000000000010', 'theory', 'Theory', NULL,
 '["Electrocautery: principles, device types, and clinical applications in cosmetology","Mole removal: shave excision, electrocautery, and laser ablation techniques","Dermatosis papulosa nigra (DPN), sebaceous cysts, xanthelasma, and syringoma removal","Skin tag removal, viral wart treatment, and ear keloid management","Intralesional injections: corticosteroids and 5-fluorouracil for hypertrophic scars","Infection control, instrument sterilisation, and minor OT protocols"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000001002', 'b1000000-0000-4000-8000-000000000010', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000001003', 'b1000000-0000-4000-8000-000000000010', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000001004', 'b1000000-0000-4000-8000-000000000010', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 11 Clinical Review
('c1000000-0000-4000-8000-000000001101', 'b1000000-0000-4000-8000-000000000011', 'theory', 'Theory', NULL,
 '["Drug interactions and contraindications relevant to aesthetic procedures","Pre-procedure workup and screening for medically complex patients","Recognising and managing complications and adverse events","Documentation, clinical photography, consent, and medico-legal best practices","Infection control, sterilisation standards, and clinic hygiene protocols","Comprehensive case reviews, structured Q&A, and PGDCC examination preparation"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000001102', 'b1000000-0000-4000-8000-000000000011', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000001103', 'b1000000-0000-4000-8000-000000000011', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000001104', 'b1000000-0000-4000-8000-000000000011', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 12 Hydra Facial & Photo Facial
('c1000000-0000-4000-8000-000000001201', 'b1000000-0000-4000-8000-000000000012', 'theory', 'Theory', NULL,
 '["Principles and technology behind HydraFacial: vortex cleansing, extraction, hydration","Customising HydraFacial boosters for skin type and concern","Photo Facial (Q Switch): mechanism, indications (pigmentation, vascular, rejuvenation)","Patient selection, Fitzpatrick considerations, and setting parameters","Combination protocols and session planning for optimal outcomes","Post-procedure care, expected downtime, and complication avoidance"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000001202', 'b1000000-0000-4000-8000-000000000012', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000001203', 'b1000000-0000-4000-8000-000000000012', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000001204', 'b1000000-0000-4000-8000-000000000012', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3),
-- Module 13 Hair Mesotherapy & QR678
('c1000000-0000-4000-8000-000000001301', 'b1000000-0000-4000-8000-000000000013', 'theory', 'Theory', NULL,
 '["Principles of mesotherapy: microinjection technique and depth of delivery","Commonly used hair mesotherapy cocktails: biotin, vitamins, amino acids, growth factors","QR678: composition, mechanism of action, and protocol for hair growth stimulation","Scalp mesotherapy vs PRP vs QR678: comparative overview and combination approaches","Injection technique, session intervals, and managing patient expectations","Scalp hygiene, folliculitis prevention, and complication management"]'::jsonb, 0),
('c1000000-0000-4000-8000-000000001302', 'b1000000-0000-4000-8000-000000000013', 'observation', 'Observation', NULL, '[]'::jsonb, 1),
('c1000000-0000-4000-8000-000000001303', 'b1000000-0000-4000-8000-000000000013', 'training', 'Training', NULL, '[]'::jsonb, 2),
('c1000000-0000-4000-8000-000000001304', 'b1000000-0000-4000-8000-000000000013', 'hands-on', 'Hands-on', NULL, '[]'::jsonb, 3);

-- Booklet placeholders (URLs NULL — attach manually in admin)
INSERT INTO treatment_booklets (id, treatment_id, stage, name, file_url, drive_url, sort_order) VALUES
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'theory', 'MDA Peels Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'theory', 'Q-Switch Laser Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'theory', 'Laser Hair Reduction Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 'theory', 'MNRF Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000005', 'theory', 'CO2 Laser & HIFU Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000006', 'theory', 'PRP / GFC Therapy Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000007', 'theory', 'Vampire Facial | DermaFrac Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000008', 'theory', 'DP4 | MiraPeel | Exosomes Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000009', 'theory', 'Lipolytic Injection Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000010', 'theory', 'Cautery & Minor Cosmetic Procedures Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000011', 'b1000000-0000-4000-8000-000000000011', 'theory', 'Clinical Review & Advanced Considerations Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000012', 'b1000000-0000-4000-8000-000000000012', 'theory', 'Hydra Facial & Photo Facial Study Material', NULL, NULL, 0),
('d1000000-0000-4000-8000-000000000013', 'b1000000-0000-4000-8000-000000000013', 'theory', 'Hair Mesotherapy, Scalp Treatments & QR678 Study Material', NULL, NULL, 0);

-- Course
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
) VALUES (
  'e1000000-0000-4000-8000-000000000001',
  'pg-diploma-in-clinical-cosmetology',
  'PG Diploma in Clinical Cosmetology (PGDCC)',
  'The PG Diploma in Clinical Cosmetology (PGDCC) offered by Skinfinity Academy of Cosmetology is a rigorous, advanced-level programme designed for medical and allied physicians who wish to establish or significantly expand their expertise in contemporary aesthetic and cosmetic medicine.

Spanning 6 months with one live lecture per week and 9 intensive weekly hands-on training days at the center, the PGDCC delivers in-depth, clinically immersive education across 13 carefully structured modules — encompassing advanced laser technologies, injectables, energy-based devices, regenerative aesthetics, and cutting-edge skin rejuvenation platforms.

Whether you are building a dedicated aesthetic practice or seeking to formalise your skills with a recognised PGDCC credential, the PGDCC provides the advanced clinical education you need to practise with confidence, safety, and distinction in modern medical cosmetology.',
  NULL,
  '6 Months',
  'hybrid',
  'advanced',
  'a1000000-0000-4000-8000-000000000001',
  NULL,
  'INR',
  'PGDCC',
  'PG Diploma',
  true,
  false,
  'published',
  'PG Diploma in Clinical Cosmetology (PGDCC) | Skinfinity Academy',
  'A comprehensive 6-month PGDCC for medical and allied physicians seeking advanced clinical expertise in modern medical cosmetology and aesthetic medicine.',
  now(),
  '{
    "live_lectures_per_week": 1,
    "hands_on_days_total": 9,
    "hands_on_months": 3,
    "module_count": 13,
    "programme_duration_months": 6
  }'::jsonb,
  ARRAY['MBBS', 'BAMS', 'MDS', 'BHMS', 'BDS']::text[]
);

-- Course ↔ treatments (modules) with delivery modes from DOCX
INSERT INTO course_treatments (
  id, course_id, treatment_id, sort_order, hands_on_default, delivery_modes, live_sessions_planned
) VALUES
('f1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 1, true,  ARRAY['lecture', 'hands_on']::text[], 1),
('f1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 2, true,  ARRAY['lecture', 'hands_on']::text[], 1),
('f1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 3, true,  ARRAY['lecture', 'hands_on']::text[], 1),
('f1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', 4, true,  ARRAY['lecture', 'hands_on']::text[], 1),
('f1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', 5, true,  ARRAY['lecture', 'hands_on']::text[], 1),
('f1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000006', 6, true,  ARRAY['lecture', 'hands_on']::text[], 1),
('f1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000007', 7, true,  ARRAY['lecture', 'hands_on']::text[], 1),
('f1000000-0000-4000-8000-000000000008', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000008', 8, false, ARRAY['lecture']::text[], 1),
('f1000000-0000-4000-8000-000000000009', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000009', 9, false, ARRAY['lecture']::text[], 1),
('f1000000-0000-4000-8000-000000000010', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000010', 10, false, ARRAY['lecture', 'practical']::text[], 1),
('f1000000-0000-4000-8000-000000000011', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000011', 11, false, ARRAY['lecture']::text[], 1),
('f1000000-0000-4000-8000-000000000012', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000012', 12, false, ARRAY['lecture', 'practical']::text[], 1),
('f1000000-0000-4000-8000-000000000013', 'e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000013', 13, false, ARRAY['lecture']::text[], 1);

-- Course FAQs from DOCX
INSERT INTO course_faqs (id, course_id, question, answer, sort_order) VALUES
(
  'a3000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'Who is eligible for the PGDCC?',
  'This programme is open to graduates holding recognised medical or allied health degrees: MBBS, BAMS, MDS, BHMS, BDS, and Allied Health Physicians with a recognised medical degree.',
  1
),
(
  'a3000000-0000-4000-8000-000000000002',
  'e1000000-0000-4000-8000-000000000001',
  'What is the programme duration and structure?',
  'The PGDCC is a 6-month structured curriculum with 1 live interactive lecture per week, Q&A and case discussions with expert faculty, comprehensive digital study material, and 9 intensive hands-on training days at Skinfinity Academy of Cosmetology.',
  2
),
(
  'a3000000-0000-4000-8000-000000000003',
  'e1000000-0000-4000-8000-000000000001',
  'How many modules does the course include?',
  'The PGDCC is delivered across 13 progressive modules covering foundational and advanced clinical cosmetology, including lasers, energy devices, regenerative aesthetics, injectables, and skin rejuvenation platforms.',
  3
),
(
  'a3000000-0000-4000-8000-000000000004',
  'e1000000-0000-4000-8000-000000000001',
  'What does hands-on training involve?',
  'Hands-on training comprises 9 intensive days at the academy with live procedures on real patients under senior faculty supervision. Skill assessment is evaluated by expert clinicians throughout. A minimum attendance threshold applies.',
  4
),
(
  'a3000000-0000-4000-8000-000000000005',
  'e1000000-0000-4000-8000-000000000001',
  'What certificate is awarded?',
  'A PGDCC certificate is awarded upon successful completion. Live lecture attendance and successful completion of assessments are mandatory. This is a vocational PG Diploma and does not confer a formal postgraduate medical degree.',
  5
),
(
  'a3000000-0000-4000-8000-000000000006',
  'e1000000-0000-4000-8000-000000000001',
  'Why choose Skinfinity Academy of Cosmetology?',
  'Expert faculty with extensive clinical and academic credentials; advanced clinic infrastructure with the latest aesthetic technology; small cohort sizes for personalised mentorship; curriculum built on evidence-based practice and real-world clinical scenarios; and a recognised PGDCC credential with a strong alumni network.',
  6
),
(
  'a3000000-0000-4000-8000-000000000007',
  'e1000000-0000-4000-8000-000000000001',
  'Are there important scope-of-practice considerations?',
  'All procedures must be performed in accordance with the practitioner''s degree-specific scope of practice and applicable state/national medical regulations. Skinfinity Academy reserves the right to modify module content, schedule, or faculty to maintain clinical relevance and quality. Seat availability is limited per cohort.',
  7
);
