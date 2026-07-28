import { db, withTransaction } from "./index";
import {
  QUIZ_QUESTIONS_TABLE,
  TREATMENT_BOOKLETS_TABLE,
  TREATMENT_QUIZZES_TABLE,
  TREATMENT_STAGES_TABLE,
  TREATMENT_VIDEOS_TABLE,
  TREATMENTS_TABLE,
} from "./schema";

export const DUMMY_TREATMENTS_DATA = [
  {
    slug: "basics-of-cosmetology",
    name: "Basics of Cosmetology & Skin Analysis",
    summary:
      "Foundation course covering skin anatomy, Fitzpatrick phototyping, skin barrier function, and aesthetic consultation protocols.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/basics-of-cosmetology/image/basics_cover.jpeg",
    status: "published",
    sort_order: 1,
    base_price: 10000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Skin Anatomy & Fitzpatrick Phototyping",
        description: "Epidermal layers, dermis structure, sebum production, and skin barrier chemistry.",
        checklist: [
          "Read Fundamentals of Cosmetology Manual",
          "Watch Skin Analysis & Wood's Lamp Video",
          "Pass Cosmetology Basics Quiz",
        ],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Patient Consultation Observation",
        description: "Observing aesthetic patient history taking, skin analysis, and treatment plan design.",
        checklist: [
          "Observe 3 Patient Skin Consultations",
          "Log Fitzpatrick Typing & Skin Moisture Metrics",
        ],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Skin Analyzer Calibration & Patch Testing",
        description: "Operating digital skin scope devices and conducting sensitivity patch tests.",
        checklist: [
          "Demonstrate Digital Skin Analyzer Usage",
          "Conduct Sensitivity Patch Testing Drill",
        ],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Patient Skin Assessment",
        description: "Conducting full aesthetic skin assessment under faculty supervision.",
        checklist: [
          "Conduct Patient Consultation & Skin Type Charting",
          "Design Customized Aesthetic Treatment Pathway",
        ],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Skin Anatomy & Fitzpatrick Classification Lecture",
        kind: "lecture",
        duration_seconds: 900,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/basics-of-cosmetology/videos/theory/skin_anatomy.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Cosmetology Basics & Skin Analysis Handbook",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/basics-of-cosmetology/booklets/theory/basics_handbook.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 2500000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Basics of Cosmetology Theory Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Which layer of the skin contains melanocytes responsible for pigment production?",
          options: [
            "Stratum Corneum",
            "Stratum Basale (Basal Layer) ✅",
            "Reticular Dermis",
            "Hypodermis",
          ],
          correct_index: 1,
          explanation: "Melanocytes reside in the stratum basale layer of the epidermis.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "laser-hair-reduction",
    name: "Laser Hair Reduction (Diode & Triple Wavelength)",
    summary:
      "Triple-wavelength diode laser technique for permanent hair reduction across Fitzpatrick skin types I-VI.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/laser-hair-reduction/image/laser_cover.jpeg",
    status: "published",
    sort_order: 2,
    base_price: 18000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Laser Physics & Skin Phototypes",
        description:
          "Understanding diode/triple-wavelength laser physics, Fitzpatrick skin typing, and hair growth cycles.",
        checklist: [
          "Read Laser Physics & Safety Booklet",
          "Watch Laser Fluence & Pulse Duration Video",
          "Pass Laser Safety Theory Quiz",
        ],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Clinical Laser Patch Testing & Case Study",
        description:
          "Observing patch testing, fluence selection, and cooling techniques on different skin types.",
        checklist: [
          "Observe 3 Live Laser Cases (Face & Underarms)",
          "Learn Fluence & Pulse Width Adjustment by Skin Type",
          "Understand Cooling Tip Contact & Gel Application",
        ],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Equipment Calibration & Grid Pass Practice",
        description:
          "Calibrating laser machine settings, handpiece movement, and cooling system checks.",
        checklist: [
          "Calibrate Diode Machine Energy Parameters",
          "Practice Gliding & Stacking Pass Speed",
          "Perform Patch Test Simulation & Thermal Check",
        ],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Laser Procedure",
        description:
          "Executing full laser hair reduction session under faculty supervision.",
        checklist: [
          "Check Patient Skin Type & Shaving Preparation",
          "Apply Ultrasound Gel & Equip Safety Goggles",
          "Execute Laser Treatment Passes",
          "Apply Post-Laser Soothing Cream & Sunscreen",
        ],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Selective Photothermolysis & Diode Wavelengths",
        kind: "lecture",
        duration_seconds: 1050,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/laser-hair-reduction/videos/theory/laser_physics.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Laser Hair Reduction Parameter & Safety Handbook",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/laser-hair-reduction/booklets/theory/laser_handbook.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 3800000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Laser Safety & Photothermolysis Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "How does laser hair reduction work?",
          options: [
            "It removes hair with chemicals",
            "It targets the pigment in hair follicles with light energy ✅",
            "It pulls hair out from the root",
            "It freezes hair follicles",
          ],
          correct_index: 1,
          explanation: "Selective photothermolysis targets melanin in the hair follicle shaft.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "chemical-peels",
    name: "Chemical Peels & Skin Resurfacing",
    summary:
      "AHA/BHA, TCA, and Jessner solution application protocols for acne, melasma, and skin rejuvenation.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/chemical-peels/image/peel_cover.jpeg",
    status: "published",
    sort_order: 3,
    base_price: 12000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Peel Chemistry & Skin Priming",
        description:
          "Classification of superficial, medium, and deep peels, skin conditioning, and post-peel care.",
        checklist: [
          "Read Chemical Peel Selection Guide",
          "Watch Neutralization & Frosting Video Lectures",
          "Pass Chemical Peel Theory Quiz",
        ],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Peel Application Observation",
        description:
          "Observing peel selection, application time, and neutralizing techniques.",
        checklist: [
          "Observe 3 Live Peel Cases (Acne & Pigmentation)",
          "Learn Post-Peel Erythema & Neutralization Indicators",
        ],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Neutralization Speed & Layering Simulation",
        description:
          "Simulated application of peel solutions and rapid neutralization drills.",
        checklist: [
          "Practice Even Layering Technique with Brush",
          "Simulate Rapid Neutralizer Application",
        ],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Patient Chemical Peel",
        description:
          "Conducting live patient peel treatment from skin prep to neutralization.",
        checklist: [
          "Perform Degreasing & Sensitive Area Protection (Vaseline)",
          "Apply Peel Solution & Monitor Time/Frosting",
          "Neutralize & Apply Post-Peel Barrier Cream",
        ],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "AHA vs BHA Chemical Peel Science",
        kind: "lecture",
        duration_seconds: 840,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/chemical-peels/videos/theory/peel_science.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Chemical Peel Protocol & Neutralization Guide",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/chemical-peels/booklets/theory/peel_guide.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 2900000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Chemical Peel Safety Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Which chemical peel is oil-soluble and ideal for acne-prone skin?",
          options: [
            "Glycolic Acid (AHA)",
            "Salicylic Acid (BHA) ✅",
            "Lactic Acid",
            "Trichloroacetic Acid (TCA)",
          ],
          correct_index: 1,
          explanation: "Salicylic acid is lipophilic and penetrates comedones effectively.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "microdermabrasion",
    name: "Microdermabrasion & Diamond Polish",
    summary: "Mechanical exfoliation technique using diamond tips for stratum corneum renewal.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/microdermabrasion/image/mda_cover.jpeg",
    status: "published",
    sort_order: 4,
    base_price: 8000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Mechanical Exfoliation Principles",
        description: "Suction pressure, diamond grit sizing, and epidermal resurfacing.",
        checklist: ["Read Microdermabrasion Protocol", "Watch Suction Pressure Video"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live MDA Observation",
        description: "Observing facial pass directions and pressure control.",
        checklist: ["Observe 2 Live MDA Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Handpiece Suction Calibration",
        description: "Adjusting vacuum bars and practicing stroke overlapping.",
        checklist: ["Calibrate Vacuum Bar Pressure"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Patient Microdermabrasion",
        description: "Full facial diamond microdermabrasion under supervision.",
        checklist: ["Execute 2-Pass Diamond Polish Session"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Diamond Head Microdermabrasion Technique",
        kind: "lecture",
        duration_seconds: 750,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/microdermabrasion/videos/theory/mda_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Microdermabrasion Clinical Operating Manual",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/microdermabrasion/booklets/theory/mda_manual.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 2100000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Microdermabrasion Theory Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "What is the primary target layer for diamond head microdermabrasion?",
          options: [
            "Stratum Corneum ✅",
            "Dermis",
            "Subcutaneous Fat",
            "Muscular Layer",
          ],
          correct_index: 0,
          explanation: "MDA exfoliates the outermost dead stratum corneum layer mechanically.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "q-switch-tattoo-removal",
    name: "Q-Switch Nd:YAG Laser (Tattoo & Pigment Removal)",
    summary: "High-peak-power nanosecond Nd:YAG laser for tattoo ink and dermal pigmentation breakdown.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/q-switch-tattoo-removal/image/qswitch_cover.jpeg",
    status: "published",
    sort_order: 5,
    base_price: 20000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Photoacoustic Laser Physics",
        description: "Nanosecond Q-switching, 1064nm vs 532nm wavelengths, and ink fragmentation.",
        checklist: ["Study Q-Switch Nd:YAG Physics Manual", "Pass Photoacoustic Safety Quiz"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Tattoo & Carbon Peel Observation",
        description: "Observing tissue whitening (frosting) response during laser passes.",
        checklist: ["Observe 3 Tattoo Removal Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Spot Size & Fluence Calibration",
        description: "Calibrating spot diameter, repetition rate, and aiming beam alignment.",
        checklist: ["Calibrate 1064nm Handpiece Spot Size"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Tattoo Removal Session",
        description: "Performing Q-switch laser pass on live patient under senior supervision.",
        checklist: ["Execute Laser Tattoo Pass & Apply Antibiotic Ointment"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Q-Switch Nd:YAG Ink Fragmentation Lecture",
        kind: "lecture",
        duration_seconds: 1100,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/q-switch-tattoo-removal/videos/theory/qswitch_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Q-Switch Laser Tattoo Removal Safety Protocol",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/q-switch-tattoo-removal/booklets/theory/qswitch_protocol.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 3100000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Q-Switch Nd:YAG Laser Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Which laser wavelength is standard for removing dark black and blue tattoo ink?",
          options: ["532 nm", "1064 nm ✅", "755 nm", "2940 nm"],
          correct_index: 1,
          explanation: "1064 nm penetrates deeply and is absorbed effectively by dark black ink.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "medifacial-hydra",
    name: "Medifacial Hydra & Bio-Glow Rejuvenation",
    summary: "Multi-step hydra-dermabrasion combining vortex extraction, salicylic infusion, and LED phototherapy.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/medifacial-hydra/image/hydra_cover.jpeg",
    status: "published",
    sort_order: 6,
    base_price: 15000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Vortex Exfoliation & Serum Infusion Chemistry",
        description: "Vortex tip physics, lactic/salicylic acid serums, and hyaluronic hydration.",
        checklist: ["Read Medifacial Hydra Protocol Manual"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Hydra Facial Observation",
        description: "Observing multi-step facial cleansing, extraction, and bio-glow serum infusion.",
        checklist: ["Observe 2 Live Medifacial Hydra Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Vortex Tip & LED Light Setup",
        description: "Setting up serum bottle flow rates and blue/red LED phototherapy.",
        checklist: ["Calibrate Vortex Flow Rate"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Medifacial Execution",
        description: "Performing full 60-minute medifacial hydra session on live patient.",
        checklist: ["Execute 6-Step Medifacial Hydra Procedure"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Medifacial Hydra 6-Step Protocol Lecture",
        kind: "lecture",
        duration_seconds: 880,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/medifacial-hydra/videos/theory/hydra_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Medifacial Hydra Treatment & Infusion Guide",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/medifacial-hydra/booklets/theory/hydra_guide.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 2700000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Medifacial Hydra Protocol Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "What is the primary function of vortex extraction in a medifacial hydra session?",
          options: [
            "Pore vacuum extraction & serum delivery ✅",
            "Laser thermal coagulation",
            "Muscular paralysis",
            "Epidermal freezing",
          ],
          correct_index: 0,
          explanation: "Vortex tip vacuum removes comedones while simultaneously infusing hydrating serums.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "carbon-facial",
    name: "Carbon Laser Peel Facial",
    summary: "Liquid carbon lotion application with 1064nm Q-switch Nd:YAG photo-thermal pore tightening.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/carbon-facial/image/carbon_cover.jpeg",
    status: "published",
    sort_order: 7,
    base_price: 14000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Carbon Photo-Thermal Science",
        description: "Mechanism of carbon lotion absorption, 1064nm laser vaporization, and sebum reduction.",
        checklist: ["Read Carbon Peel Manual"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Carbon Facial Observation",
        description: "Observing carbon application, drying time, and dual-pass laser protocol.",
        checklist: ["Observe 2 Live Carbon Laser Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Carbon Lotion Layering & Pass Speed",
        description: "Practicing thin carbon lotion application and rapid handpiece movements.",
        checklist: ["Practice Carbon Layering & Pass Speed"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Carbon Laser Facial",
        description: "Conducting live patient carbon laser peel treatment under supervision.",
        checklist: ["Execute Carbon Application & Dual Laser Pass"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Carbon Laser Peel Technique & Science",
        kind: "lecture",
        duration_seconds: 780,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/carbon-facial/videos/theory/carbon_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Carbon Laser Peel Protocol Booklet",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/carbon-facial/booklets/theory/carbon_booklet.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 2300000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Carbon Laser Peel Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Why is liquid carbon applied to the face prior to Q-switch laser treatment?",
          options: [
            "Carbon acts as an exogenous chromophore to absorb 1064nm laser energy ✅",
            "Carbon permanently stains the skin",
            "Carbon numbs the skin sensory nerves",
            "Carbon bleaches facial hair",
          ],
          correct_index: 0,
          explanation: "Carbon particles enter pores and absorb laser light, vaporizing dead cells and tightening pores.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "fat-x-lipolysis",
    name: "Fat-X Injection Lipolysis",
    summary: "Deoxycholic acid micro-injection protocol for submental fat reduction and body contouring.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/fat-x-lipolysis/image/lipolysis_cover.jpeg",
    status: "published",
    sort_order: 8,
    base_price: 22000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Adipocyte Lysis & Deoxycholic Acid Chemistry",
        description: "Subcutaneous fat cell destruction, inflammatory cascade, and patient selection criteria.",
        checklist: ["Read Lipolysis Dosing & Safety Booklet"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Submental Lipolysis Observation",
        description: "Observing 1cm grid marking, depth injection, and post-treatment swelling management.",
        checklist: ["Observe 2 Submental Lipolysis Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Subcutaneous Grid Marking Simulation",
        description: "Practicing 1cm injection grid mapping and 13mm needle depth control.",
        checklist: ["Demonstrate Subcutaneous Depth Control"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Lipolysis Injections",
        description: "Performing targeted fat reduction micro-injections under faculty supervision.",
        checklist: ["Execute Submental Lipolysis Grid Injections"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Deoxycholic Acid Injection Lipolysis Lecture",
        kind: "lecture",
        duration_seconds: 920,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/fat-x-lipolysis/videos/theory/lipolysis_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Submental Injection Lipolysis Clinical Manual",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/fat-x-lipolysis/booklets/theory/lipolysis_manual.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 3300000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Lipolysis Safety Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "What is the active mechanism of deoxycholic acid in fat reduction?",
          options: [
            "Destruction of adipocyte cell membranes ✅",
            "Muscular atrophy",
            "Laser thermal coagulation",
            "Epidermal freezing",
          ],
          correct_index: 0,
          explanation: "Deoxycholic acid disrupts subcutaneous fat cell membranes leading to cell breakdown.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "prp-gfc-therapy",
    name: "PRP & GFC Hair Restoration",
    summary: "Platelet-Rich Plasma and Growth Factor Concentrate preparation and scalp micro-injection.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/prp-gfc-therapy/image/prp_cover.jpeg",
    status: "published",
    sort_order: 9,
    base_price: 15000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Platelet Concentration & Growth Factor Science",
        description: "Centrifugation protocols (RPM/G-force), GFC activation, and follicle stimulation.",
        checklist: ["Read PRP & GFC Centrifugation Manual", "Pass PRP Science Quiz"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Venipuncture & Scalp PRP Observation",
        description: "Observing blood collection, plasma separation, and mesotherapy scalp injections.",
        checklist: ["Observe 3 Live Scalp PRP Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Centrifuge Operation & Numbing Technique",
        description: "Operating dual-spin centrifuges and ring-block local anesthesia techniques.",
        checklist: ["Demonstrate Centrifuge RPM Calibration"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Patient PRP Session",
        description: "Conducting full PRP/GFC blood draw, spin, and scalp micro-injections on live patient.",
        checklist: ["Execute Venipuncture, Spin, & Scalp Micro-Injections"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "PRP vs GFC Centrifugation & Growth Factor Lecture",
        kind: "lecture",
        duration_seconds: 1020,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/prp-gfc-therapy/videos/theory/prp_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "PRP & GFC Hair & Facial Rejuvenation Handbook",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/prp-gfc-therapy/booklets/theory/prp_handbook.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 3600000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "PRP / GFC Hair Restoration Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Which key growth factor in PRP stimulates hair follicle angiogenesis?",
          options: [
            "VEGF (Vascular Endothelial Growth Factor) ✅",
            "Insulin",
            "Melanin",
            "Keratin",
          ],
          correct_index: 0,
          explanation: "VEGF promotes blood vessel formation around hair follicles to improve nutrient supply.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "microneedling-dermapen",
    name: "Microneedling & Dermapen Therapy",
    summary: "Automated micro-needle skin puncturing for collagen induction therapy (CIT) and scar remodeling.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/microneedling-dermapen/image/dermapen_cover.jpeg",
    status: "published",
    sort_order: 10,
    base_price: 11000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Collagen Induction Therapy Mechanics",
        description: "Needle depth settings (0.5mm - 2.5mm), RPM speeds, and wound healing cascade.",
        checklist: ["Read Microneedling Protocol Handbook"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Acne Scar Microneedling Observation",
        description: "Observing topical numbing cream prep, cross-hatch passes, and pin-point bleeding indicators.",
        checklist: ["Observe 2 Live Dermapen Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Dermapen Speed & Depth Adjustment",
        description: "Practicing smooth glide techniques and adjusting needle length per facial zone.",
        checklist: ["Calibrate Needling Depth by Facial Zone"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Patient Microneedling",
        description: "Conducting automated microneedling treatment on live patient.",
        checklist: ["Execute Cross-Hatch Microneedling Passes"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Collagen Induction Therapy & Dermapen Speeds",
        kind: "lecture",
        duration_seconds: 810,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/microneedling-dermapen/videos/theory/dermapen_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Microneedling & Acne Scar Remodeling Guide",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/microneedling-dermapen/booklets/theory/dermapen_guide.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 2600000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Microneedling Therapy Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "What needle depth range is typical for collagen stimulation on forehead skin?",
          options: [
            "0.5 mm - 1.0 mm ✅",
            "3.0 mm - 4.0 mm",
            "5.0 mm",
            "0.1 mm",
          ],
          correct_index: 0,
          explanation: "Forehead skin is thin over bone; 0.5mm - 1.0mm prevents periosteum discomfort while stimulating collagen.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "anti-ageing-hifu",
    name: "Anti-Ageing HIFU (Focused Ultrasound)",
    summary: "High-Intensity Focused Ultrasound for SMAS layer tightening and non-surgical facelift.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/anti-ageing-hifu/image/hifu_cover.jpeg",
    status: "published",
    sort_order: 11,
    base_price: 30000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "SMAS Layer Anatomy & Focused Ultrasound Physics",
        description: "Thermal coagulation points (TCPs), 1.5mm / 3.0mm / 4.5mm transducers, and vector lift design.",
        checklist: ["Read HIFU Facial Vector Manual"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live HIFU Facelift Observation",
        description: "Observing facial line mapping, shot count delivery, and energy J/cm2 selection.",
        checklist: ["Observe 2 Live HIFU Facelift Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Transducer Cartridge Mapping",
        description: "Mapping facial treatment vectors while avoiding facial nerve pathways.",
        checklist: ["Practice SMAS Layer Cartridge Mapping"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised HIFU Facelift Session",
        description: "Performing multi-depth HIFU treatment shots under faculty guidance.",
        checklist: ["Deliver 400 Shot HIFU Treatment Passes"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "HIFU Focused Ultrasound & SMAS Layer Lecture",
        kind: "lecture",
        duration_seconds: 1150,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/anti-ageing-hifu/videos/theory/hifu_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "HIFU Non-Surgical Facelift Vector Manual",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/anti-ageing-hifu/booklets/theory/hifu_manual.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 4100000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "HIFU Facelift Safety Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Which transducer cartridge depth reaches the Superficial Muscular Aponeurotic System (SMAS)?",
          options: ["1.5 mm", "3.0 mm", "4.5 mm ✅", "13.0 mm"],
          correct_index: 2,
          explanation: "The 4.5 mm transducer targets thermal energy at the deep SMAS layer.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "botulinum-toxin",
    name: "Botulinum Toxin (Botox)",
    summary:
      "Master neuromodulator procedure for upper face lines, crow's feet, masseter hypertrophy, and hyperhidrosis.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/botulinum-toxin/image/botox_cover.jpeg",
    status: "published",
    sort_order: 12,
    base_price: 25000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Facial Anatomy & Neuromodulator Science",
        description:
          "Fundamental lectures on facial muscle anatomy, unit calculations, reconstituted storage, and patient safety.",
        checklist: [
          "Read Botox Clinical Manual & Booklet",
          "Watch Upper Face & Masseter Injection Videos",
          "Study Dilution Ratio & Unit Calculation Chart",
          "Complete & Pass Theory Quiz (66%+ score)",
        ],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Case Observation & Grid Marking",
        description:
          "Observing senior faculty during patient consultation, facial muscle assessment, and live injections.",
        checklist: [
          "Observe 3 Live Patient Cases (Upper Face / Crow's Feet)",
          "Note Injection Points & Unit Dosages",
          "Record Consultation & Consent Logbook Entries",
        ],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Dummy Grid Marking & Injection Simulation",
        description:
          "Hands-on simulation training for precise depth, angle, and aspiration techniques.",
        checklist: [
          "Practice Facial Grid Markings on Mannequin",
          "Demonstrate 30G Needle Angle & Depth Control",
          "Review Emergency Protocol for Ptosis & Vascular Risk",
        ],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Patient Procedure Execution",
        description:
          "Performing neuromodulator injections under 1-on-1 faculty guidance.",
        checklist: [
          "Verify Patient Medical History & Consent Form",
          "Perform Muscle Assessment & Mark Injection Points",
          "Execute Injection under Senior Doctor Supervision",
          "Provide Post-Procedure Care Instructions",
        ],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Upper Face Anatomy & Injection Points Lecture",
        kind: "lecture",
        duration_seconds: 1200,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/botulinum-toxin/videos/theory/botox_anatomy.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Botulinum Toxin Clinical Protocol & Dosing Manual",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/botulinum-toxin/booklets/theory/botox_manual.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 4520000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Botox Theory & Anatomy Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Which muscle is primarily responsible for vertical frown lines (glabella)?",
          options: [
            "Frontalis",
            "Corrugator supercilii ✅",
            "Orbicularis oculi",
            "Zygomaticus major",
          ],
          correct_index: 1,
          explanation:
            "Corrugator supercilii pulls the eyebrow medially and downward, creating vertical glabella frown lines.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "dermal-fillers",
    name: "Hyaluronic Acid Dermal Fillers",
    summary: "HA volumetric filler augmentation for nasolabial folds, cheek contouring, and lip enhancement.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/dermal-fillers/image/filler_cover.jpeg",
    status: "published",
    sort_order: 13,
    base_price: 35000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Rheology & Facial Volumization Science",
        description: "G-prime values, cross-linking technology (BDDE), and facial fat pad danger zones.",
        checklist: ["Read Filler Rheology & Danger Zone Manual", "Pass Hyaluronidase Safety Quiz"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Cannula & Needle Filler Observation",
        description: "Observing bolus vs linear thread technique and aspiration safety checks.",
        checklist: ["Observe 3 Live Dermal Filler Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Micro-Cannula vs Needle Simulation",
        description: "Practicing 25G/27G blunt cannula insertion and aspiration techniques.",
        checklist: ["Demonstrate Blunt Cannula Insertion Technique"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Patient Filler Augmentation",
        description: "Executing HA filler injection under senior faculty supervision.",
        checklist: ["Execute Nasolabial / Lip Filler Augmentation"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "Hyaluronic Acid Rheology & Facial Layer Anatomy",
        kind: "lecture",
        duration_seconds: 1250,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/dermal-fillers/videos/theory/filler_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "Dermal Filler Injection Protocols & Danger Zones",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/dermal-fillers/booklets/theory/filler_protocols.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 4800000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "Dermal Filler Safety & Rheology Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Which enzyme is injected as an emergency antidote to dissolve hyaluronic acid fillers?",
          options: ["Collagenase", "Hyaluronidase ✅", "Lipase", "Trypsin"],
          correct_index: 1,
          explanation: "Hyaluronidase hydrolyzes hyaluronic acid bonds to quickly resolve vascular compromise.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "pdo-thread-lift",
    name: "PDO Thread Lift & Suspension",
    summary: "Polydioxanone cog and mono thread insertion for midface lifting and jawline tightening.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/pdo-thread-lift/image/thread_cover.jpeg",
    status: "published",
    sort_order: 14,
    base_price: 40000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Polydioxanone Biocompatibility & Vectors",
        description: "Cog barbs, mono collagen stimulation, entry point anatomy, and anchoring fascial layers.",
        checklist: ["Read Thread Lift Vector Manual"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live Midface Thread Lift Observation",
        description: "Observing cannula vector marking, entry pilot needle, and thread traction.",
        checklist: ["Observe 2 Live Midface Thread Lift Cases"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Sub-SMAS Vector Thread Insertion",
        description: "Practicing pilot needle puncture and 19G cannula thread gliding on model.",
        checklist: ["Demonstrate 19G Cog Thread Insertion Path"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised Thread Lift Procedure",
        description: "Inserting PDO cog lifting threads under faculty guidance.",
        checklist: ["Execute 4-Vector Midface PDO Thread Lift"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "PDO Cog Thread Vectors & Anchoring Anatomy",
        kind: "lecture",
        duration_seconds: 1180,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/pdo-thread-lift/videos/theory/thread_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "PDO Thread Lift Clinical Vector Guide",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/pdo-thread-lift/booklets/theory/thread_guide.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 4200000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "PDO Thread Lift Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "What is the primary material composition of PDO suspension threads?",
          options: ["Poly-L-lactic acid", "Polydioxanone ✅", "Polycaprolactone", "Polypropylene"],
          correct_index: 1,
          explanation: "PDO (Polydioxanone) is a synthetic bio-absorbable polymer widely used in lifting threads.",
          sort_order: 0,
        },
      ],
    },
  },
  {
    slug: "bb-glow-meso",
    name: "BB Glow & Scalp Meso Therapy",
    summary: "Meso-ampoule infusion and semi-permanent pigment BB glow treatment for skin tone uniformity.",
    image_url:
      "https://storage.googleapis.com/academy-bucket-prod/treatments/bb-glow-meso/image/bbglow_cover.jpeg",
    status: "published",
    sort_order: 15,
    base_price: 13000,
    currency: "INR",
    stages: [
      {
        stage: "theory",
        title: "Meso-Ampoule Formulations & Nano-Needling",
        description: "Niacinamide, peptide complexes, organic mineral pigments, and epidermal delivery.",
        checklist: ["Read BB Glow & Mesotherapy Protocol"],
        sort_order: 0,
      },
      {
        stage: "observation",
        title: "Live BB Glow & Meso Observation",
        description: "Observing nano-chip needle passes, serum blending, and soothing mask application.",
        checklist: ["Observe 2 Live BB Glow Treatments"],
        sort_order: 1,
      },
      {
        stage: "training",
        title: "Nano-Needle Machine Setup",
        description: "Setting up nano-pin cartridges and practicing circular motion passes.",
        checklist: ["Demonstrate Nano-Pin Circular Passes"],
        sort_order: 2,
      },
      {
        stage: "hands-on",
        title: "Supervised BB Glow Session",
        description: "Conducting full BB glow mesotherapy treatment on live patient.",
        checklist: ["Execute 3-Pass BB Glow Serum Infusion"],
        sort_order: 3,
      },
    ],
    videos: [
      {
        stage: "theory",
        title: "BB Glow Serum Infusion & Nano-Needle Protocol",
        kind: "lecture",
        duration_seconds: 790,
        video_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/bb-glow-meso/videos/theory/bbglow_lecture.mp4",
        thumbnail_url: null,
        is_published: true,
        sort_order: 0,
      },
    ],
    booklets: [
      {
        stage: "theory",
        name: "BB Glow & Mesotherapy Clinical Manual",
        file_url:
          "https://storage.googleapis.com/academy-bucket-prod/treatments/bb-glow-meso/booklets/theory/bbglow_manual.pdf",
        drive_url:
          "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        size_bytes: 2400000,
        mime_type: "application/pdf",
        sort_order: 0,
      },
    ],
    quiz: {
      title: "BB Glow & Mesotherapy Quiz",
      pass_percent: 66,
      is_required: true,
      questions: [
        {
          prompt: "Which needle cartridge type is standard for infusing BB glow pigment into the epidermis?",
          options: ["36-pin needle", "Nano-chip needle cartridge ✅", "12-pin needle", "18G cannula"],
          correct_index: 1,
          explanation: "Nano-chip cartridges infuse BB glow serums into the superficial stratum corneum without deep puncturing.",
          sort_order: 0,
        },
      ],
    },
  },
];

export async function seedDummyTreatments(options?: {
  duplicateTimes?: number;
}): Promise<{ count: number; items: string[] }> {
  const times = Math.max(1, options?.duplicateTimes ?? 1);
  const createdSlugs: string[] = [];

  for (let copy = 0; copy < times; copy++) {
    for (const item of DUMMY_TREATMENTS_DATA) {
      const slug =
        copy === 0
          ? item.slug
          : `${item.slug}-copy-${copy + 1}-${Math.floor(Math.random() * 1000)}`;

      await withTransaction(async (conn) => {
        // 1. Insert or update Treatment
        const [tRows] = await conn.query<{ id: string }>(
          `INSERT INTO ${TREATMENTS_TABLE}
             (slug, name, summary, image_url, status, sort_order, base_price, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (slug) DO UPDATE SET
             name = EXCLUDED.name,
             summary = EXCLUDED.summary,
             image_url = EXCLUDED.image_url,
             status = EXCLUDED.status,
             base_price = EXCLUDED.base_price,
             deleted_at = NULL,
             updated_at = now()
           RETURNING id`,
          [
            slug,
            copy === 0 ? item.name : `${item.name} (Copy ${copy + 1})`,
            item.summary,
            item.image_url,
            item.status,
            item.sort_order + copy * 15,
            item.base_price,
            item.currency,
          ],
        );

        const treatmentId = Array.isArray(tRows) ? tRows[0]?.id : undefined;
        if (!treatmentId) return;

        createdSlugs.push(slug);

        // 2. Insert Stages
        for (const st of item.stages) {
          await conn.query(
            `INSERT INTO ${TREATMENT_STAGES_TABLE}
               (treatment_id, stage, title, description, checklist, sort_order)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)
             ON CONFLICT (treatment_id, stage) DO UPDATE SET
               title = EXCLUDED.title,
               description = EXCLUDED.description,
               checklist = EXCLUDED.checklist,
               sort_order = EXCLUDED.sort_order,
               updated_at = now()`,
            [
              treatmentId,
              st.stage,
              st.title,
              st.description,
              JSON.stringify(st.checklist),
              st.sort_order,
            ],
          );
        }

        // 3. Insert Videos
        for (const v of item.videos) {
          await conn.query(
            `INSERT INTO ${TREATMENT_VIDEOS_TABLE}
               (treatment_id, stage, title, kind, duration_seconds, video_url, thumbnail_url, sort_order, is_published)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              treatmentId,
              v.stage,
              v.title,
              v.kind,
              v.duration_seconds,
              v.video_url,
              v.thumbnail_url,
              v.sort_order,
              v.is_published,
            ],
          );
        }

        // 4. Insert Booklets
        for (const b of item.booklets) {
          await conn.query(
            `INSERT INTO ${TREATMENT_BOOKLETS_TABLE}
               (treatment_id, stage, name, file_url, drive_url, size_bytes, mime_type, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              treatmentId,
              b.stage,
              b.name,
              b.file_url,
              b.drive_url,
              b.size_bytes,
              b.mime_type,
              b.sort_order,
            ],
          );
        }

        // 5. Insert Quiz & Questions
        if (item.quiz) {
          const [qRows] = await conn.query<{ id: string }>(
            `INSERT INTO ${TREATMENT_QUIZZES_TABLE}
               (treatment_id, title, pass_percent, is_required)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (treatment_id) DO UPDATE SET
               title = EXCLUDED.title,
               pass_percent = EXCLUDED.pass_percent,
               is_required = EXCLUDED.is_required
             RETURNING id`,
            [
              treatmentId,
              item.quiz.title,
              item.quiz.pass_percent,
              item.quiz.is_required,
            ],
          );

          const quizId = Array.isArray(qRows) ? qRows[0]?.id : undefined;
          if (quizId && item.quiz.questions) {
            for (const q of item.quiz.questions) {
              const optionsClean = q.options.map((opt) =>
                opt.replace(/✅|\(correct\)|\[correct\]|\*/gi, "").trim(),
              );
              await conn.query(
                `INSERT INTO ${QUIZ_QUESTIONS_TABLE}
                   (quiz_id, prompt, options, correct_index, explanation, sort_order)
                 VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
                [
                  quizId,
                  q.prompt,
                  JSON.stringify(optionsClean),
                  q.correct_index,
                  q.explanation,
                  q.sort_order,
                ],
              );
            }
          }
        }
      });
    }
  }

  return {
    count: createdSlugs.length,
    items: createdSlugs,
  };
}
