import type { Platform } from "@/domain/enums";
import type { LocalizedText } from "@/domain/localized";

/**
 * Curated sample ideas used by the offline mock generator. They are fictional practice
 * briefs, not real companies or validated market opportunities.
 */
export interface SampleIdea {
  id: string;
  industry: string;
  platform: Platform;
  title: LocalizedText;
  concept: LocalizedText;
  problem: LocalizedText;
  opportunity: LocalizedText;
  users: { segment: LocalizedText; description: LocalizedText; needs: LocalizedText[] }[];
  features: { name: LocalizedText; description: LocalizedText; userValue: LocalizedText }[];
  constraints: LocalizedText[];
  metrics: { metric: LocalizedText; target: LocalizedText; rationale: LocalizedText }[];
  edgeCases: LocalizedText[];
}

export const SAMPLE_IDEAS: SampleIdea[] = [
  {
    id: "pharmacy-refill",
    industry: "healthcare",
    platform: "mobile",
    title: { en: "RefillRight — prescription refills for caregivers", ar: "ريفيل رايت — تجديد الوصفات لمقدمي الرعاية" },
    concept: {
      en: "A mobile app that helps adult children manage recurring prescription refills for an elderly parent across multiple pharmacies.",
      ar: "تطبيق جوال يساعد الأبناء البالغين على إدارة تجديد الوصفات الطبية المتكررة لأحد الوالدين المسنين عبر عدة صيدليات.",
    },
    problem: {
      en: "Caregivers juggling several medications for a parent miss refill windows because reminders, pharmacy portals and insurance approvals live in different places.",
      ar: "يفوّت مقدمو الرعاية مواعيد تجديد الأدوية لأن التذكيرات وبوابات الصيدليات وموافقات التأمين موزعة في أماكن مختلفة.",
    },
    opportunity: {
      en: "A trusted coordination layer could reduce missed doses and give pharmacies a more predictable refill pipeline.",
      ar: "طبقة تنسيق موثوقة قد تقلل الجرعات الفائتة وتمنح الصيدليات خط تجديد أكثر قابلية للتنبؤ.",
    },
    users: [
      {
        segment: { en: "Remote adult caregivers", ar: "مقدمو رعاية بالغون عن بُعد" },
        description: { en: "Working professionals managing a parent's medication from another city.", ar: "موظفون يديرون أدوية أحد الوالدين من مدينة أخرى." },
        needs: [
          { en: "Know what is due before it runs out", ar: "معرفة ما يستحق قبل نفاده" },
          { en: "Share responsibility with siblings", ar: "مشاركة المسؤولية مع الإخوة" },
        ],
      },
      {
        segment: { en: "Older adults", ar: "كبار السن" },
        description: { en: "Patients who want to stay informed without managing apps themselves.", ar: "مرضى يريدون البقاء على اطلاع دون إدارة التطبيقات بأنفسهم." },
        needs: [{ en: "Simple confirmation that medication is on its way", ar: "تأكيد بسيط بأن الدواء في الطريق" }],
      },
    ],
    features: [
      {
        name: { en: "Refill timeline", ar: "الجدول الزمني للتجديد" },
        description: { en: "A unified view of upcoming refills across pharmacies.", ar: "عرض موحد للتجديدات القادمة عبر الصيدليات." },
        userValue: { en: "Nothing runs out unexpectedly.", ar: "لا ينفد أي دواء بشكل مفاجئ." },
      },
      {
        name: { en: "Shared care circle", ar: "دائرة الرعاية المشتركة" },
        description: { en: "Invite family members and assign who handles each refill.", ar: "دعوة أفراد العائلة وتحديد المسؤول عن كل تجديد." },
        userValue: { en: "Responsibility is clear and visible.", ar: "المسؤولية واضحة ومرئية." },
      },
      {
        name: { en: "Smart notifications", ar: "إشعارات ذكية" },
        description: { en: "Escalating reminders tied to supply and approval status.", ar: "تذكيرات متدرجة مرتبطة بالمخزون وحالة الموافقة." },
        userValue: { en: "Act at the right time, not too early or late.", ar: "التصرف في الوقت المناسب." },
      },
    ],
    constraints: [
      { en: "Health data must follow local privacy regulation; no diagnosis features.", ar: "يجب أن تتبع البيانات الصحية أنظمة الخصوصية المحلية؛ لا ميزات تشخيص." },
      { en: "Pharmacy integrations are not guaranteed; manual entry must work.", ar: "التكامل مع الصيدليات غير مضمون؛ يجب أن يعمل الإدخال اليدوي." },
    ],
    metrics: [
      { metric: { en: "Refills completed before supply runs out", ar: "التجديدات المكتملة قبل نفاد المخزون" }, target: { en: "≥ 90% of tracked refills", ar: "≥ 90% من التجديدات المتتبعة" }, rationale: { en: "Core promise of the product.", ar: "الوعد الأساسي للمنتج." } },
      { metric: { en: "Care circles with 2+ active members", ar: "دوائر الرعاية ذات عضوين نشطين أو أكثر" }, target: { en: "40% after 30 days", ar: "40% بعد 30 يوماً" }, rationale: { en: "Indicates shared responsibility.", ar: "يشير إلى مشاركة المسؤولية." } },
    ],
    edgeCases: [
      { en: "Insurance rejects a refill", ar: "رفض التأمين لتجديد" },
      { en: "Two caregivers act on the same refill", ar: "قيام مقدمَي رعاية بالإجراء نفسه على التجديد ذاته" },
    ],
  },
  {
    id: "freight-dock",
    industry: "logistics",
    platform: "web",
    title: { en: "DockSlot — loading-dock scheduling for mid-size warehouses", ar: "دوك سلوت — جدولة أرصفة التحميل للمستودعات المتوسطة" },
    concept: {
      en: "A web tool where carriers book loading-dock time slots and warehouse coordinators manage arrivals in real time.",
      ar: "أداة ويب يحجز فيها الناقلون مواعيد أرصفة التحميل ويدير منسقو المستودع الوصول في الوقت الفعلي.",
    },
    problem: {
      en: "Trucks arrive unannounced, queue for hours and incur detention fees because slot booking happens over phone and email.",
      ar: "تصل الشاحنات دون إشعار وتنتظر لساعات وتتحمل رسوم انتظار لأن حجز المواعيد يتم عبر الهاتف والبريد.",
    },
    opportunity: {
      en: "Predictable arrivals reduce detention costs and let warehouses staff docks accurately.",
      ar: "الوصول المتوقع يقلل تكاليف الانتظار ويتيح للمستودعات توزيع الموظفين بدقة.",
    },
    users: [
      {
        segment: { en: "Dock coordinators", ar: "منسقو الأرصفة" },
        description: { en: "Warehouse staff assigning doors and crews during busy shifts.", ar: "موظفو مستودع يوزعون الأبواب والطواقم خلال المناوبات المزدحمة." },
        needs: [{ en: "See today's arrivals and conflicts at a glance", ar: "رؤية وصول اليوم والتعارضات بنظرة واحدة" }],
      },
      {
        segment: { en: "Carrier dispatchers", ar: "مرسلو شركات النقل" },
        description: { en: "Book slots for many drivers across many warehouses.", ar: "يحجزون مواعيد لسائقين كثر عبر مستودعات عديدة." },
        needs: [{ en: "Book and change slots without phone calls", ar: "الحجز وتغيير المواعيد دون مكالمات" }],
      },
    ],
    features: [
      {
        name: { en: "Slot booking", ar: "حجز المواعيد" },
        description: { en: "Carriers pick available dock windows with load details.", ar: "يختار الناقلون نوافذ الأرصفة المتاحة مع تفاصيل الحمولة." },
        userValue: { en: "No more phone tag.", ar: "لا مزيد من المكالمات المتبادلة." },
      },
      {
        name: { en: "Live dock board", ar: "لوحة الأرصفة المباشرة" },
        description: { en: "Real-time view of doors, arrivals and delays.", ar: "عرض لحظي للأبواب والوصول والتأخيرات." },
        userValue: { en: "Coordinators react before queues build.", ar: "يتصرف المنسقون قبل تكوّن الطوابير." },
      },
      {
        name: { en: "Delay notifications", ar: "إشعارات التأخير" },
        description: { en: "Drivers and coordinators are alerted to changes.", ar: "تنبيه السائقين والمنسقين بالتغييرات." },
        userValue: { en: "Everyone works from the same information.", ar: "الجميع يعمل بالمعلومات نفسها." },
      },
    ],
    constraints: [
      { en: "Must work on shared warehouse desktops and tablets.", ar: "يجب أن يعمل على أجهزة المستودع المشتركة والأجهزة اللوحية." },
      { en: "Carriers will not install another app; booking must work from a link.", ar: "لن يثبّت الناقلون تطبيقاً آخر؛ يجب أن يعمل الحجز من رابط." },
    ],
    metrics: [
      { metric: { en: "Average truck wait time", ar: "متوسط وقت انتظار الشاحنة" }, target: { en: "Reduce from baseline (to be measured)", ar: "خفضه عن خط الأساس (يُقاس لاحقاً)" }, rationale: { en: "Detention fees drive cost.", ar: "رسوم الانتظار تحرك التكلفة." } },
      { metric: { en: "Share of arrivals with a booked slot", ar: "نسبة الوصول بموعد محجوز" }, target: { en: "≥ 75%", ar: "≥ 75%" }, rationale: { en: "Adoption by carriers.", ar: "تبني الناقلين." } },
    ],
    edgeCases: [
      { en: "Truck arrives early or late outside its window", ar: "وصول الشاحنة مبكراً أو متأخراً خارج نافذتها" },
      { en: "Door becomes unavailable mid-shift", ar: "تعطل باب أثناء المناوبة" },
    ],
  },
  {
    id: "civic-permits",
    industry: "government",
    platform: "responsive_web",
    title: { en: "PermitPath — small business permit guidance", ar: "مسار التصاريح — إرشاد تصاريح المنشآت الصغيرة" },
    concept: {
      en: "A responsive service that tells first-time business owners exactly which municipal permits they need and tracks applications.",
      ar: "خدمة متجاوبة تخبر أصحاب المنشآت الجدد بالتصاريح البلدية المطلوبة بالضبط وتتابع طلباتهم.",
    },
    problem: {
      en: "New owners abandon or delay openings because permit requirements are spread across agencies and written in legal language.",
      ar: "يتخلى أصحاب المنشآت الجدد عن الافتتاح أو يؤخرونه لأن متطلبات التصاريح موزعة بين الجهات ومكتوبة بلغة قانونية.",
    },
    opportunity: {
      en: "Clear guidance could shorten time-to-open and reduce incomplete applications that cost staff time.",
      ar: "الإرشاد الواضح قد يختصر وقت الافتتاح ويقلل الطلبات الناقصة التي تستهلك وقت الموظفين.",
    },
    users: [
      {
        segment: { en: "First-time business owners", ar: "أصحاب المنشآت لأول مرة" },
        description: { en: "Opening a café, salon or shop with no prior permit experience.", ar: "يفتتحون مقهى أو صالوناً أو متجراً دون خبرة سابقة." },
        needs: [{ en: "Know what to apply for and in what order", ar: "معرفة ما يجب التقدم له وبأي ترتيب" }],
      },
      {
        segment: { en: "Permit officers", ar: "موظفو التصاريح" },
        description: { en: "Review applications and answer repeated questions.", ar: "يراجعون الطلبات ويجيبون عن أسئلة متكررة." },
        needs: [{ en: "Receive complete applications", ar: "استلام طلبات مكتملة" }],
      },
    ],
    features: [
      {
        name: { en: "Guided eligibility questionnaire", ar: "استبيان أهلية موجّه" },
        description: { en: "Plain-language questions that produce a personalised permit checklist.", ar: "أسئلة بلغة بسيطة تنتج قائمة تصاريح مخصصة." },
        userValue: { en: "No guessing which permits apply.", ar: "لا تخمين بشأن التصاريح المطلوبة." },
      },
      {
        name: { en: "Document upload", ar: "رفع المستندات" },
        description: { en: "Upload and validate required documents before submission.", ar: "رفع المستندات المطلوبة والتحقق منها قبل التقديم." },
        userValue: { en: "Fewer rejected applications.", ar: "طلبات مرفوضة أقل." },
      },
      {
        name: { en: "Application tracker", ar: "متتبع الطلبات" },
        description: { en: "Status across agencies with next actions.", ar: "الحالة عبر الجهات مع الإجراءات التالية." },
        userValue: { en: "Know what is blocking the opening.", ar: "معرفة ما يعيق الافتتاح." },
      },
    ],
    constraints: [
      { en: "Must meet WCAG 2.2 AA and support Arabic and English.", ar: "يجب أن يحقق WCAG 2.2 AA ويدعم العربية والإنجليزية." },
      { en: "Legal content is owned by agencies and cannot be rewritten freely.", ar: "المحتوى القانوني مملوك للجهات ولا يمكن إعادة كتابته بحرية." },
    ],
    metrics: [
      { metric: { en: "Applications submitted complete on first try", ar: "الطلبات المقدمة مكتملة من أول مرة" }, target: { en: "≥ 70%", ar: "≥ 70%" }, rationale: { en: "Reduces rework for both sides.", ar: "يقلل إعادة العمل للطرفين." } },
      { metric: { en: "Checklist completion rate", ar: "معدل إكمال قائمة التحقق" }, target: { en: "≥ 60% of starters", ar: "≥ 60% ممن يبدؤون" }, rationale: { en: "Shows guidance is usable.", ar: "يُظهر أن الإرشاد قابل للاستخدام." } },
    ],
    edgeCases: [
      { en: "Business type spans two categories", ar: "نشاط تجاري يجمع فئتين" },
      { en: "Uploaded document is expired", ar: "مستند مرفوع منتهي الصلاحية" },
    ],
  },
  {
    id: "tutor-match",
    industry: "education",
    platform: "mobile",
    title: { en: "StudyLoop — peer tutoring for first-year university students", ar: "ستدي لوب — تدريس الأقران لطلاب السنة الأولى" },
    concept: {
      en: "A campus app that matches struggling first-year students with trained senior peer tutors for short sessions.",
      ar: "تطبيق جامعي يربط طلاب السنة الأولى المتعثرين بمدرسين من الطلاب المتقدمين المدربين لجلسات قصيرة.",
    },
    problem: {
      en: "First-year students who fall behind in core courses wait too long to seek help because office hours feel intimidating and tutoring centres are booked out.",
      ar: "ينتظر طلاب السنة الأولى المتأخرون طويلاً قبل طلب المساعدة لأن الساعات المكتبية مرهبة ومراكز التدريس محجوزة.",
    },
    opportunity: {
      en: "Earlier, lower-stakes help could improve course completion and retention.",
      ar: "المساعدة المبكرة الأقل رهبة قد تحسن إكمال المقررات والاستبقاء.",
    },
    users: [
      {
        segment: { en: "First-year students", ar: "طلاب السنة الأولى" },
        description: { en: "Taking large introductory courses, often away from home for the first time.", ar: "يدرسون مقررات تمهيدية كبيرة، وغالباً بعيداً عن المنزل لأول مرة." },
        needs: [{ en: "Get help quickly without embarrassment", ar: "الحصول على المساعدة بسرعة دون إحراج" }],
      },
      {
        segment: { en: "Peer tutors", ar: "المدرسون الأقران" },
        description: { en: "Senior students tutoring part-time around their own studies.", ar: "طلاب متقدمون يدرّسون بدوام جزئي حول دراستهم." },
        needs: [{ en: "Flexible scheduling", ar: "جدولة مرنة" }],
      },
    ],
    features: [
      {
        name: { en: "Booking & scheduling", ar: "الحجز والجدولة" },
        description: { en: "Book 20-minute sessions by course topic.", ar: "حجز جلسات 20 دقيقة حسب موضوع المقرر." },
        userValue: { en: "Help is available this week, not next month.", ar: "المساعدة متاحة هذا الأسبوع لا الشهر القادم." },
      },
      {
        name: { en: "Tutor matching", ar: "مطابقة المدرس" },
        description: { en: "Match on course, availability and language.", ar: "المطابقة حسب المقرر والتوفر واللغة." },
        userValue: { en: "The right tutor the first time.", ar: "المدرس المناسب من أول مرة." },
      },
      {
        name: { en: "Session feedback", ar: "تقييم الجلسة" },
        description: { en: "Quick, private feedback after each session.", ar: "تقييم سريع وخاص بعد كل جلسة." },
        userValue: { en: "Quality improves over time.", ar: "تتحسن الجودة بمرور الوقت." },
      },
    ],
    constraints: [
      { en: "Student data is protected; tutors see only what is needed.", ar: "بيانات الطلاب محمية؛ يرى المدرسون ما يلزم فقط." },
      { en: "Must work with the university's existing sign-in.", ar: "يجب أن يعمل مع نظام الدخول الحالي للجامعة." },
    ],
    metrics: [
      { metric: { en: "Students booking a first session within 7 days of sign-up", ar: "الطلاب الذين يحجزون أول جلسة خلال 7 أيام" }, target: { en: "≥ 50%", ar: "≥ 50%" }, rationale: { en: "Early help is the goal.", ar: "المساعدة المبكرة هي الهدف." } },
      { metric: { en: "No-show rate", ar: "معدل عدم الحضور" }, target: { en: "< 10%", ar: "< 10%" }, rationale: { en: "Protects tutor time.", ar: "يحمي وقت المدرسين." } },
    ],
    edgeCases: [
      { en: "Tutor cancels last minute", ar: "إلغاء المدرس في اللحظة الأخيرة" },
      { en: "No tutor available for a niche course", ar: "عدم توفر مدرس لمقرر نادر" },
    ],
  },
  {
    id: "sme-invoicing",
    industry: "fintech",
    platform: "responsive_web",
    title: { en: "Paydue — late-invoice recovery for freelancers", ar: "باي ديو — تحصيل الفواتير المتأخرة للمستقلين" },
    concept: {
      en: "A responsive tool that helps freelancers track unpaid invoices, send respectful reminders and offer instant payment links.",
      ar: "أداة متجاوبة تساعد المستقلين على تتبع الفواتير غير المدفوعة وإرسال تذكيرات لبقة وتقديم روابط دفع فورية.",
    },
    problem: {
      en: "Freelancers lose cash flow because chasing late payments is awkward, manual and easy to postpone.",
      ar: "يفقد المستقلون السيولة لأن ملاحقة المدفوعات المتأخرة محرجة ويدوية وسهلة التأجيل.",
    },
    opportunity: {
      en: "Automating polite follow-up and making payment frictionless could shorten days-to-paid.",
      ar: "أتمتة المتابعة اللبقة وتسهيل الدفع قد يقصّر مدة التحصيل.",
    },
    users: [
      {
        segment: { en: "Independent designers and developers", ar: "المصممون والمطورون المستقلون" },
        description: { en: "Invoice 3–15 clients per month.", ar: "يصدرون فواتير لـ 3–15 عميلاً شهرياً." },
        needs: [{ en: "Get paid on time without damaging relationships", ar: "الحصول على المستحقات في الوقت دون الإضرار بالعلاقات" }],
      },
    ],
    features: [
      {
        name: { en: "Invoice dashboard", ar: "لوحة الفواتير" },
        description: { en: "Status of every invoice by age and client.", ar: "حالة كل فاتورة حسب العمر والعميل." },
        userValue: { en: "Know who owes what.", ar: "معرفة من يدين بماذا." },
      },
      {
        name: { en: "Reminder sequences", ar: "تسلسل التذكيرات" },
        description: { en: "Configurable, tone-appropriate reminders.", ar: "تذكيرات قابلة للتخصيص بنبرة مناسبة." },
        userValue: { en: "Follow-up happens without awkwardness.", ar: "تتم المتابعة دون إحراج." },
      },
      {
        name: { en: "Payment links", ar: "روابط الدفع" },
        description: { en: "One-tap payment for clients.", ar: "دفع بنقرة واحدة للعملاء." },
        userValue: { en: "Fewer excuses to delay payment.", ar: "أعذار أقل لتأخير الدفع." },
      },
    ],
    constraints: [
      { en: "Payments handled by a licensed provider; the app never stores card data.", ar: "تُعالج المدفوعات عبر مزود مرخص؛ لا يخزن التطبيق بيانات البطاقات." },
      { en: "Must support multiple currencies.", ar: "يجب أن يدعم عدة عملات." },
    ],
    metrics: [
      { metric: { en: "Median days from invoice to paid", ar: "الوسيط لعدد الأيام من الفاتورة إلى الدفع" }, target: { en: "Reduce vs. user's own baseline", ar: "خفضه مقارنة بخط أساس المستخدم" }, rationale: { en: "Direct cash-flow benefit.", ar: "فائدة مباشرة للسيولة." } },
    ],
    edgeCases: [
      { en: "Client disputes an invoice", ar: "اعتراض العميل على فاتورة" },
      { en: "Partial payment received", ar: "استلام دفعة جزئية" },
    ],
  },
  {
    id: "rental-maintenance",
    industry: "real_estate",
    platform: "multi_platform",
    title: { en: "FixFlow — maintenance requests for rental buildings", ar: "فيكس فلو — طلبات الصيانة للمباني المؤجرة" },
    concept: {
      en: "Tenants report maintenance issues with photos; building managers triage, assign technicians and keep tenants informed.",
      ar: "يبلغ المستأجرون عن أعطال الصيانة بالصور؛ ويفرز مديرو المباني الطلبات ويكلفون الفنيين ويبقون المستأجرين على اطلاع.",
    },
    problem: {
      en: "Maintenance requests get lost in calls and chat groups, so tenants repeat themselves and managers cannot prioritise urgent issues.",
      ar: "تضيع طلبات الصيانة في المكالمات ومجموعات الدردشة، فيكرر المستأجرون أنفسهم ولا يستطيع المديرون ترتيب الأولويات.",
    },
    opportunity: {
      en: "Structured requests could cut resolution time and improve tenant retention.",
      ar: "الطلبات المنظمة قد تختصر وقت الحل وتحسن استبقاء المستأجرين.",
    },
    users: [
      {
        segment: { en: "Tenants", ar: "المستأجرون" },
        description: { en: "Residents of mid-size rental buildings.", ar: "سكان مبانٍ مؤجرة متوسطة الحجم." },
        needs: [{ en: "Report once and know when it will be fixed", ar: "الإبلاغ مرة واحدة ومعرفة موعد الإصلاح" }],
      },
      {
        segment: { en: "Building managers", ar: "مديرو المباني" },
        description: { en: "Manage several buildings and a small technician team.", ar: "يديرون عدة مبانٍ وفريق فنيين صغير." },
        needs: [{ en: "Triage by urgency", ar: "الفرز حسب الإلحاح" }],
      },
    ],
    features: [
      {
        name: { en: "Photo-based request form", ar: "نموذج طلب بالصور" },
        description: { en: "Guided reporting with photos and location in the unit.", ar: "إبلاغ موجّه بالصور والموقع داخل الوحدة." },
        userValue: { en: "Technicians arrive prepared.", ar: "يصل الفنيون مستعدين." },
      },
      {
        name: { en: "Approval workflow", ar: "سير عمل الموافقات" },
        description: { en: "Managers approve costs above a threshold.", ar: "يوافق المديرون على التكاليف فوق حد معين." },
        userValue: { en: "Spending stays controlled.", ar: "يبقى الإنفاق منضبطاً." },
      },
      {
        name: { en: "Status notifications", ar: "إشعارات الحالة" },
        description: { en: "Tenants see scheduled, in progress and done.", ar: "يرى المستأجرون: مجدول، قيد التنفيذ، مكتمل." },
        userValue: { en: "Fewer follow-up calls.", ar: "مكالمات متابعة أقل." },
      },
    ],
    constraints: [
      { en: "Technicians use low-end Android phones with patchy connectivity.", ar: "يستخدم الفنيون هواتف أندرويد بسيطة باتصال متقطع." },
    ],
    metrics: [
      { metric: { en: "Median time to resolve urgent requests", ar: "الوسيط لوقت حل الطلبات العاجلة" }, target: { en: "< 24 hours", ar: "< 24 ساعة" }, rationale: { en: "Safety and satisfaction.", ar: "السلامة والرضا." } },
    ],
    edgeCases: [
      { en: "Tenant not home when technician arrives", ar: "غياب المستأجر عند وصول الفني" },
      { en: "Duplicate report of the same issue", ar: "بلاغ مكرر عن العطل نفسه" },
    ],
  },
  {
    id: "ai-meeting-notes",
    industry: "ai_products",
    platform: "web",
    title: { en: "Recapper — trustworthy AI meeting summaries for project teams", ar: "ريكابر — ملخصات اجتماعات موثوقة بالذكاء الاصطناعي" },
    concept: {
      en: "A web app that drafts meeting summaries and action items from transcripts, with clear provenance and easy human correction.",
      ar: "تطبيق ويب يصيغ ملخصات الاجتماعات وبنود العمل من النصوص المفرغة، مع مصدر واضح وتصحيح بشري سهل.",
    },
    problem: {
      en: "Teams distrust AI summaries because they cannot see where a claim came from and errors propagate into task trackers.",
      ar: "لا تثق الفرق بملخصات الذكاء الاصطناعي لأنها لا ترى مصدر كل ادعاء وتنتقل الأخطاء إلى أدوات تتبع المهام.",
    },
    opportunity: {
      en: "Transparent, editable summaries could save time while keeping humans accountable.",
      ar: "الملخصات الشفافة القابلة للتعديل قد توفر الوقت مع إبقاء المسؤولية بشرية.",
    },
    users: [
      {
        segment: { en: "Project leads", ar: "قادة المشاريع" },
        description: { en: "Run 10+ meetings a week and own follow-ups.", ar: "يديرون أكثر من 10 اجتماعات أسبوعياً ويتولون المتابعة." },
        needs: [{ en: "Accurate action items with owners", ar: "بنود عمل دقيقة مع مسؤوليها" }],
      },
    ],
    features: [
      {
        name: { en: "Source-linked summary", ar: "ملخص مرتبط بالمصدر" },
        description: { en: "Every sentence links to the transcript moment.", ar: "كل جملة مرتبطة بلحظتها في النص المفرغ." },
        userValue: { en: "Verify before sharing.", ar: "التحقق قبل المشاركة." },
      },
      {
        name: { en: "Action item review", ar: "مراجعة بنود العمل" },
        description: { en: "Confirm, edit or reject suggested tasks.", ar: "تأكيد أو تعديل أو رفض المهام المقترحة." },
        userValue: { en: "Humans stay in control.", ar: "يبقى البشر في موقع التحكم." },
      },
    ],
    constraints: [
      { en: "Recordings may contain confidential data; retention must be configurable.", ar: "قد تحتوي التسجيلات على بيانات سرية؛ يجب أن تكون مدة الاحتفاظ قابلة للتخصيص." },
    ],
    metrics: [
      { metric: { en: "Share of AI action items accepted without edits", ar: "نسبة بنود العمل المقبولة دون تعديل" }, target: { en: "Track; no target until baseline exists", ar: "يُتتبع؛ لا مستهدف قبل وجود خط أساس" }, rationale: { en: "Proxy for accuracy.", ar: "مؤشر غير مباشر للدقة." } },
    ],
    edgeCases: [
      { en: "Speaker attribution is wrong", ar: "نسبة الكلام لمتحدث خاطئ" },
      { en: "Meeting held in two languages", ar: "اجتماع بلغتين" },
    ],
  },
  {
    id: "travel-accessibility",
    industry: "travel_hospitality",
    platform: "mobile",
    title: { en: "OpenStay — accessible hotel booking", ar: "أوبن ستاي — حجز فنادق ميسّر الوصول" },
    concept: {
      en: "A booking app that shows verified accessibility details for hotel rooms so travellers with disabilities can book confidently.",
      ar: "تطبيق حجز يعرض تفاصيل إمكانية الوصول الموثقة لغرف الفنادق ليحجز المسافرون ذوو الإعاقة بثقة.",
    },
    problem: {
      en: "'Accessible room' labels are vague, so travellers phone hotels repeatedly and still arrive to rooms that do not meet their needs.",
      ar: "تسمية «غرفة ميسّرة» غامضة، فيتصل المسافرون بالفنادق مراراً ويصلون رغم ذلك إلى غرف لا تلبي احتياجاتهم.",
    },
    opportunity: {
      en: "Trustworthy, specific accessibility data is an underserved niche with loyal customers.",
      ar: "بيانات إمكانية الوصول المحددة والموثوقة شريحة غير مخدومة بعملاء أوفياء.",
    },
    users: [
      {
        segment: { en: "Wheelchair users", ar: "مستخدمو الكراسي المتحركة" },
        description: { en: "Need exact measurements: door widths, bed height, roll-in shower.", ar: "يحتاجون قياسات دقيقة: عرض الأبواب وارتفاع السرير والدش المفتوح." },
        needs: [{ en: "Trust that the room matches the listing", ar: "الثقة بأن الغرفة تطابق الوصف" }],
      },
    ],
    features: [
      {
        name: { en: "Accessibility filters", ar: "مرشحات إمكانية الوصول" },
        description: { en: "Filter by specific, measurable features.", ar: "التصفية حسب ميزات محددة وقابلة للقياس." },
        userValue: { en: "Find suitable rooms quickly.", ar: "إيجاد الغرف المناسبة بسرعة." },
      },
      {
        name: { en: "Verified room profiles", ar: "ملفات غرف موثقة" },
        description: { en: "Photos and measurements with verification date.", ar: "صور وقياسات مع تاريخ التحقق." },
        userValue: { en: "Book without phoning.", ar: "الحجز دون اتصال." },
      },
      {
        name: { en: "Booking & confirmation", ar: "الحجز والتأكيد" },
        description: { en: "Booking that guarantees the specific room type.", ar: "حجز يضمن نوع الغرفة المحدد." },
        userValue: { en: "No surprises on arrival.", ar: "لا مفاجآت عند الوصول." },
      },
    ],
    constraints: [
      { en: "The app itself must meet WCAG 2.2 AA and work with screen readers.", ar: "يجب أن يحقق التطبيق نفسه WCAG 2.2 AA ويعمل مع قارئات الشاشة." },
    ],
    metrics: [
      { metric: { en: "Bookings where the traveller reports the room met needs", ar: "الحجوزات التي أفاد فيها المسافر بأن الغرفة لبّت احتياجاته" }, target: { en: "≥ 95%", ar: "≥ 95%" }, rationale: { en: "Trust is the product.", ar: "الثقة هي المنتج." } },
    ],
    edgeCases: [
      { en: "Hotel data is outdated", ar: "بيانات الفندق قديمة" },
      { en: "Accessible room sold out after search", ar: "نفاد الغرفة الميسّرة بعد البحث" },
    ],
  },
];
