import { z } from "zod";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const LocaleSchema = z.enum(LOCALES);

export const PLATFORMS = ["web", "mobile", "responsive_web", "multi_platform"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PlatformSchema = z.enum(PLATFORMS);

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export const ExperienceLevelSchema = z.enum(EXPERIENCE_LEVELS);

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DifficultySchema = z.enum(DIFFICULTIES);

export const INDUSTRIES = [
  "fintech",
  "ecommerce",
  "healthcare",
  "education",
  "saas_b2b",
  "travel_hospitality",
  "logistics",
  "real_estate",
  "government",
  "productivity",
  "social_community",
  "ai_products",
] as const;

export const FEATURE_SUGGESTIONS = [
  "onboarding",
  "search_filtering",
  "checkout_payments",
  "notifications",
  "dashboard_analytics",
  "booking_scheduling",
  "messaging",
  "profile_settings",
  "reviews_ratings",
  "document_upload",
  "approval_workflow",
  "maps_location",
  "subscription_management",
  "ai_assistant",
  "accessibility_settings",
  "content_creation",
] as const;

export const PROJECT_STATUSES = ["draft", "active", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STAGE_KEYS = [
  "discovery",
  "research",
  "architecture",
  "wireframes",
  "visual_design",
  "prototype",
  "usability_testing",
  "handoff",
] as const;
export type StageKey = (typeof STAGE_KEYS)[number];
export const StageKeySchema = z.enum(STAGE_KEYS);

export const STAGE_STATUSES = [
  "locked",
  "available",
  "in_progress",
  "in_review",
  "needs_revision",
  "ready_to_complete",
  "completed",
  "needs_revalidation",
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const SEVERITIES = ["critical", "major", "minor", "suggestion"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SeveritySchema = z.enum(SEVERITIES);

export const DECISIONS = ["pass", "revise", "needs_more_evidence"] as const;
export type Decision = (typeof DECISIONS)[number];

export const CRITERION_STATUSES = ["met", "partial", "not_met", "missing", "not_evaluable"] as const;
export type CriterionStatus = (typeof CRITERION_STATUSES)[number];
export const CriterionStatusSchema = z.enum(CRITERION_STATUSES);

export const DELIVERABLE_STATUSES = ["provided", "partial", "missing", "not_evaluable"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];
export const DeliverableStatusSchema = z.enum(DELIVERABLE_STATUSES);

export const FEEDBACK_THEMES = [
  "problem_definition",
  "user_evidence",
  "metrics",
  "assumptions",
  "scope",
  "research_rigor",
  "synthesis",
  "flows_edge_cases",
  "information_architecture",
  "interaction_states",
  "visual_hierarchy",
  "consistency",
  "accessibility",
  "localization",
  "prototype_fidelity",
  "usability_evidence",
  "prioritization",
  "documentation",
  "communication",
] as const;
export type FeedbackTheme = (typeof FEEDBACK_THEMES)[number];
export const FeedbackThemeSchema = z.enum(FEEDBACK_THEMES);

export const SKILLS = [
  "problem_framing",
  "research",
  "information_architecture",
  "interaction_design",
  "visual_design",
  "prototyping",
  "usability_evaluation",
  "communication",
] as const;
export type Skill = (typeof SKILLS)[number];

export const STRICTNESS_LEVELS = ["supportive", "standard", "demanding"] as const;
export type Strictness = (typeof STRICTNESS_LEVELS)[number];

export const REVISION_TASK_STATUSES = ["open", "completed", "dismissed"] as const;
export type RevisionTaskStatus = (typeof REVISION_TASK_STATUSES)[number];

export const ASSET_KINDS = ["image", "pdf", "figma"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const EXTRACTION_STATUSES = ["uploaded", "validating", "extracting", "ready", "failed"] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const JOB_TYPES = ["generate_brief", "customize_stages", "review", "follow_up", "case_study"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];
