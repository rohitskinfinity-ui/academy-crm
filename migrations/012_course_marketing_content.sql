-- Course marketing sections for public/admin course pages
-- Eligibility, Programme Highlights, Training Structure, Why Choose, Important Considerations

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS marketing_content jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN courses.marketing_content IS
  'Marketing page sections: eligibility, highlights, training_structure, why_choose, important_considerations';

-- Seed Diploma in Clinical Cosmetology
UPDATE courses
SET marketing_content = $json$
{
  "eligibility": {
    "intro": "This diploma is open to graduates holding the following recognised medical degrees:",
    "items": [
      "MBBS – Bachelor of Medicine and Bachelor of Surgery",
      "BAMS – Bachelor of Ayurvedic Medicine and Surgery",
      "MDS – Master of Dental Surgery",
      "BHMS – Bachelor of Homeopathic Medicine and Surgery",
      "BDS – Bachelor of Dental Surgery"
    ]
  },
  "highlights": [
    "13 structured curriculum modules",
    "1 month of hands-on clinical training",
    "1 live interactive lecture per week",
    "Training on real patients under expert supervision",
    "Concise 3-month intensive format",
    "MDA Peels, Hydra Facial & Photo Facial",
    "Vampire Facial – PRP / GFC",
    "Hair Mesotherapy, Scalp Treatments & QR678",
    "Exosome therapy",
    "Laser Hair Reduction & Q-Switch Laser",
    "Cautery & Minor Cosmetic Procedures",
    "Skin Tightening Devices",
    "Diploma certificate awarded upon successful completion"
  ],
  "training_structure": {
    "groups": [
      {
        "title": "Online Component",
        "items": [
          "Live online lectures – 1 session per week",
          "3-month structured curriculum format",
          "Interactive Q&A and case discussions",
          "Comprehensive study material provided"
        ]
      },
      {
        "title": "Hands-on Component",
        "items": [
          "1 month intensive hands-on training",
          "Training at Skinfinity Academy",
          "Live patient procedures under expert guidance",
          "Skill assessment by senior faculty",
          "Diploma certificate awarded on completion"
        ]
      }
    ]
  },
  "why_choose": {
    "intro": "Skinfinity Academy is a leading aesthetic dermatology centre dedicated to clinical excellence and physician education. Our faculty brings decades of combined experience in dermatology, aesthetic medicine, and surgical cosmetology — both nationally and internationally.",
    "items": [
      "Expert faculty with extensive clinical and academic credentials",
      "Advanced clinic infrastructure with the latest aesthetic technology",
      "Small cohort sizes ensuring personalised attention and mentorship",
      "Curriculum built on evidence-based practice and real-world clinical scenarios",
      "Recognised diploma with a strong alumni and professional network"
    ]
  },
  "important_considerations": [
    "All procedures must be performed in accordance with the practitioner's degree-specific scope of practice and applicable state/national medical regulations.",
    "Hands-on training is conducted in a clinical environment with real patients — a minimum attendance threshold applies.",
    "Live lecture attendance and successful completion of assessments are mandatory for diploma award.",
    "Skinfinity Academy reserves the right to modify module content, schedule, or faculty to maintain clinical relevance and quality.",
    "This is a vocational diploma in clinical cosmetology and does not confer a formal postgraduate medical degree.",
    "Candidates are encouraged to enrol early — seat availability is limited per cohort."
  ]
}
$json$::jsonb,
    updated_at = now()
WHERE slug = 'diploma-in-clinical-cosmetology';

-- Seed PG Diploma (PGDCC)
UPDATE courses
SET marketing_content = $json$
{
  "eligibility": {
    "intro": "This PGDCC is open to graduates holding the following recognised medical or allied health degrees:",
    "items": [
      "MBBS – Bachelor of Medicine and Bachelor of Surgery",
      "BAMS – Bachelor of Ayurvedic Medicine and Surgery",
      "MDS – Master of Dental Surgery",
      "BHMS – Bachelor of Homeopathic Medicine and Surgery",
      "BDS – Bachelor of Dental Surgery",
      "Allied Health Physicians with a recognised medical degree"
    ]
  },
  "highlights": [
    "13 structured curriculum modules",
    "3 months of intensive hands-on clinical training",
    "1 live interactive lecture per week",
    "Training on real patients under expert supervision",
    "Comprehensive 6-month PGDCC format",
    "Advanced laser therapies: Q-Switch, CO2, Laser Hair Reduction",
    "Energy devices: MNRF, HIFU, and Body Contouring",
    "Regenerative aesthetics: PRP, GFC, Exosomes",
    "Next-gen platforms: HydraFacial, DermaFrac, MiraPeel, DP4",
    "Injectables: Lipolytic injections and advanced MDA peels",
    "PGDCC certificate awarded upon completion"
  ],
  "training_structure": {
    "groups": [
      {
        "title": "Live Online Lectures",
        "items": ["1 session per week — interactive, case-based"]
      },
      {
        "title": "Programme Duration",
        "items": ["6-month structured curriculum"]
      },
      {
        "title": "Q&A & Case Discussions",
        "items": ["Interactive sessions with expert faculty"]
      },
      {
        "title": "Study Material",
        "items": ["Comprehensive digital material provided"]
      },
      {
        "title": "Hands-on Training",
        "items": ["9 intensive days at Skinfinity Academy of Cosmetology"]
      },
      {
        "title": "Patient Procedures",
        "items": ["Live procedures under senior faculty supervision"]
      },
      {
        "title": "Skill Assessment",
        "items": ["Evaluated by expert clinicians throughout"]
      },
      {
        "title": "Certification",
        "items": ["PGDCC certificate awarded on successful completion"]
      }
    ]
  },
  "why_choose": {
    "intro": "Skinfinity Academy of Cosmetology is a leading aesthetic dermatology centre dedicated to clinical excellence and physician education. Our faculty brings decades of combined experience in dermatology, aesthetic medicine, and surgical cosmetology — both nationally and internationally.",
    "items": [
      "Expert faculty with extensive clinical and academic credentials",
      "Advanced clinic infrastructure with the latest aesthetic technology",
      "Small cohort sizes ensuring personalised attention and mentorship",
      "Curriculum built on evidence-based practice and real-world clinical scenarios",
      "Recognised PGDCC credential with a strong alumni and professional network"
    ]
  },
  "important_considerations": [
    "All procedures must be performed in accordance with the practitioner's degree-specific scope of practice and applicable state/national medical regulations.",
    "Hands-on training is conducted in a clinical environment with real patients — a minimum attendance threshold applies.",
    "Live lecture attendance and successful completion of assessments are mandatory for PGDCC awards.",
    "Skinfinity Academy reserves the right to modify module content, schedule, or faculty to maintain clinical relevance and quality.",
    "This is a vocational PG Diploma in Clinical Cosmetology (PGDCC) and does not confer a formal postgraduate medical degree.",
    "Candidates are encouraged to enrol early — seat availability is limited per cohort."
  ]
}
$json$::jsonb,
    updated_at = now()
WHERE slug = 'pg-diploma-in-clinical-cosmetology';
