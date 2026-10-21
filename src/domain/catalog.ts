import type { LocalizedText } from "./localized";
import type { FEATURE_SUGGESTIONS, INDUSTRIES } from "./enums";

export const INDUSTRY_LABELS: Record<(typeof INDUSTRIES)[number], LocalizedText> = {
  fintech: { en: "Fintech", ar: "التقنية المالية" },
  ecommerce: { en: "E-commerce", ar: "التجارة الإلكترونية" },
  healthcare: { en: "Healthcare", ar: "الرعاية الصحية" },
  education: { en: "Education", ar: "التعليم" },
  saas_b2b: { en: "SaaS & B2B", ar: "البرمجيات كخدمة والأعمال" },
  travel_hospitality: { en: "Travel & hospitality", ar: "السفر والضيافة" },
  logistics: { en: "Logistics", ar: "الخدمات اللوجستية" },
  real_estate: { en: "Real estate", ar: "العقارات" },
  government: { en: "Government services", ar: "الخدمات الحكومية" },
  productivity: { en: "Productivity", ar: "الإنتاجية" },
  social_community: { en: "Social & community", ar: "المجتمع والتواصل" },
  ai_products: { en: "AI-powered products", ar: "منتجات الذكاء الاصطناعي" },
};

export const FEATURE_LABELS: Record<(typeof FEATURE_SUGGESTIONS)[number], LocalizedText> = {
  onboarding: { en: "Onboarding", ar: "التهيئة والانضمام" },
  search_filtering: { en: "Search & filtering", ar: "البحث والتصفية" },
  checkout_payments: { en: "Checkout & payments", ar: "الدفع وإتمام الشراء" },
  notifications: { en: "Notifications", ar: "الإشعارات" },
  dashboard_analytics: { en: "Dashboard & analytics", ar: "لوحة المعلومات والتحليلات" },
  booking_scheduling: { en: "Booking & scheduling", ar: "الحجز والجدولة" },
  messaging: { en: "Messaging", ar: "المراسلة" },
  profile_settings: { en: "Profile & settings", ar: "الملف الشخصي والإعدادات" },
  reviews_ratings: { en: "Reviews & ratings", ar: "التقييمات والمراجعات" },
  document_upload: { en: "Document upload", ar: "رفع المستندات" },
  approval_workflow: { en: "Approval workflow", ar: "سير عمل الموافقات" },
  maps_location: { en: "Maps & location", ar: "الخرائط والموقع" },
  subscription_management: { en: "Subscription management", ar: "إدارة الاشتراكات" },
  ai_assistant: { en: "AI assistant", ar: "مساعد ذكي" },
  accessibility_settings: { en: "Accessibility settings", ar: "إعدادات إمكانية الوصول" },
  content_creation: { en: "Content creation", ar: "إنشاء المحتوى" },
};

export function featureLabel(keyOrText: string): LocalizedText {
  return (FEATURE_LABELS as Record<string, LocalizedText>)[keyOrText] ?? keyOrText;
}

export function industryLabel(keyOrText: string): LocalizedText {
  return (INDUSTRY_LABELS as Record<string, LocalizedText>)[keyOrText] ?? keyOrText;
}
