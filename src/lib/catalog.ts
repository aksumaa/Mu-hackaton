export type Localized = { uz: string; ru: string; en: string };

export type CriterionSeed = {
  key: string;
  order: number;
  maxPoints: number;
  title: Localized;
  description: Localized;
};

export const STAGE1_CRITERIA: CriterionSeed[] = [
  {
    key: "problem_significance",
    order: 1,
    maxPoints: 25,
    title: {
      uz: "Muammo ahamiyati",
      ru: "Значимость проблемы",
      en: "Problem significance",
    },
    description: {
      uz: "Muammo qanchalik haqiqiy, muhim va tushunarli ekani.",
      ru: "Насколько проблема реальна, существенна и понятна.",
      en: "How real, important, and clear the problem is.",
    },
  },
  {
    key: "solution_quality",
    order: 2,
    maxPoints: 20,
    title: { uz: "Yechim sifati", ru: "Качество решения", en: "Solution quality" },
    description: {
      uz: "Yechim mantiqi, muammo bilan bog‘liqligi va kutilayotgan foyda.",
      ru: "Логика решения, связь с проблемой и ожидаемая польза.",
      en: "Logic of the solution, its link to the problem, and the expected benefit.",
    },
  },
  {
    key: "audience_validation",
    order: 3,
    maxPoints: 15,
    title: {
      uz: "Maqsadli auditoriya va tasdiqlash",
      ru: "Целевая аудитория и валидация",
      en: "Target audience and validation",
    },
    description: {
      uz: "Foydalanuvchini tushunish va ehtiyojning dastlabki dalillari.",
      ru: "Понимание пользователей и наличие первичных подтверждений потребности.",
      en: "User understanding and the first evidence of need.",
    },
  },
  {
    key: "originality",
    order: 4,
    maxPoints: 15,
    title: { uz: "O‘ziga xoslik", ru: "Оригинальность и отличие", en: "Originality and difference" },
    description: {
      uz: "Mavjud yechimlardan farqi va o‘ziga xoslikning asosi.",
      ru: "Отличие от существующих решений и обоснованность уникальности.",
      en: "Difference from existing solutions and why that difference holds.",
    },
  },
  {
    key: "feasibility",
    order: 5,
    maxPoints: 10,
    title: { uz: "Amalga oshirish imkoniyati", ru: "Реализуемость", en: "Feasibility" },
    description: {
      uz: "Mavjud resurslar bilan mahsulotni yaratishning realligi.",
      ru: "Реалистичность создания продукта имеющимися ресурсами.",
      en: "Whether the product can be built with the resources at hand.",
    },
  },
  {
    key: "growth_value",
    order: 6,
    maxPoints: 10,
    title: { uz: "O‘sish salohiyati va qiymat", ru: "Потенциал роста и ценность", en: "Growth potential and value" },
    description: {
      uz: "Kengayish imkoniyati va o‘lchanadigan qiymat.",
      ru: "Возможность расширения и измеримая ценность.",
      en: "Room to grow and value that can be measured.",
    },
  },
  {
    key: "completeness",
    order: 7,
    maxPoints: 5,
    title: { uz: "To‘liqlik va ravshanlik", ru: "Полнота и ясность заявки", en: "Completeness and clarity" },
    description: {
      uz: "Ariza tushunarli va majburiy ma’lumotlarga ega.",
      ru: "Понятность и наличие обязательной информации.",
      en: "The application is understandable and contains the required information.",
    },
  },
];

export const STAGE2_CRITERIA: CriterionSeed[] = [
  {
    key: "problem_fit",
    order: 1,
    maxPoints: 15,
    title: { uz: "Yechimning muammoga mosligi", ru: "Соответствие решения проблеме", en: "Solution–problem fit" },
    description: {
      uz: "Muammo, foydalanuvchi va asosiy funksiyalar o‘rtasidagi bog‘liqlik.",
      ru: "Связь между проблемой, пользователем и основными функциями.",
      en: "The link between the problem, the user, and the main functions.",
    },
  },
  {
    key: "mvp_functionality",
    order: 2,
    maxPoints: 25,
    title: { uz: "MVP funksionaligi", ru: "Функциональность MVP", en: "MVP functionality" },
    description: {
      uz: "Ishlaydi, asosiy ssenariy to‘liq va demo sifati yaxshi.",
      ru: "Работоспособность, полнота ключевого сценария и качество демо.",
      en: "It works, the key scenario is complete, and the demo is clear.",
    },
  },
  {
    key: "prd_product",
    order: 3,
    maxPoints: 15,
    title: { uz: "PRD va mahsulot yondashuvi", ru: "PRD и продуктовый подход", en: "PRD and product approach" },
    description: {
      uz: "Talablar, ustuvorliklar va qabul mezonlari ravshan.",
      ru: "Чёткость требований, приоритетов и критериев приёмки.",
      en: "Requirements, priorities, and acceptance criteria are clear.",
    },
  },
  {
    key: "user_validation",
    order: 4,
    maxPoints: 10,
    title: { uz: "Foydalanuvchi tekshiruvi", ru: "Пользовательская проверка", en: "User validation" },
    description: {
      uz: "Fikr-mulohaza bor va jamoa undan xulosa chiqargan.",
      ru: "Наличие обратной связи и способность сделать выводы.",
      en: "There is feedback, and the team drew conclusions from it.",
    },
  },
  {
    key: "differentiation",
    order: 5,
    maxPoints: 10,
    title: { uz: "Muqobillardan farqi", ru: "Отличие от альтернатив", en: "Differentiation" },
    description: {
      uz: "Mahsulot farqi asoslangan.",
      ru: "Обоснованная дифференциация продукта.",
      en: "The product’s difference is justified.",
    },
  },
  {
    key: "business_model",
    order: 6,
    maxPoints: 10,
    title: { uz: "Biznes modeli / barqarorlik", ru: "Бизнес-модель / устойчивость", en: "Business model / sustainability" },
    description: {
      uz: "Qiymat, xarajat, foydalanuvchi va rivojlanish modeli tushunarli.",
      ru: "Понимание ценности, затрат, пользователей и модели развития.",
      en: "Value, cost, users, and a plausible path to continue are understood.",
    },
  },
  {
    key: "roadmap_12w",
    order: 7,
    maxPoints: 10,
    title: { uz: "12 haftalik reja", ru: "План на 12 недель", en: "12-week plan" },
    description: {
      uz: "Keyingi qadamlar, ustuvorliklar va resurslar rejalashtirilgan.",
      ru: "Реалистичность следующих шагов, приоритетов и ресурсов.",
      en: "The next steps, priorities, and resources are realistic.",
    },
  },
  {
    key: "materials_quality",
    order: 8,
    maxPoints: 5,
    title: { uz: "Materiallar sifati", ru: "Качество материалов", en: "Quality of materials" },
    description: {
      uz: "Video, mahsulot, PRD, taqdimot va repozitoriy bir-biriga mos.",
      ru: "Согласованность видео, продукта, PRD, deck и репозитория.",
      en: "Video, product, PRD, deck, and repository agree with each other.",
    },
  },
];

export const FINAL_CRITERIA: CriterionSeed[] = [
  {
    key: "user_value",
    order: 1,
    maxPoints: 20,
    title: { uz: "Foydalanuvchi qiymati", ru: "Пользовательская ценность", en: "User value" },
    description: {
      uz: "Mahsulot muhim muammoni hal qiladi va maqsadli foydalanuvchiga foydali.",
      ru: "Насколько продукт решает важную проблему и полезен целевому пользователю.",
      en: "How well the product solves an important problem for its user.",
    },
  },
  {
    key: "product_demo",
    order: 2,
    maxPoints: 20,
    title: { uz: "Mahsulot namoyishi", ru: "Демонстрация продукта", en: "Product demonstration" },
    description: {
      uz: "Namoyish ishlaydi, ravshan va ishonarli.",
      ru: "Работоспособность, ясность и убедительность демонстрации.",
      en: "The demonstration works and is clear.",
    },
  },
  {
    key: "validation_evidence",
    order: 3,
    maxPoints: 15,
    title: { uz: "Tasdiq va dalillar", ru: "Валидация / доказательства", en: "Validation evidence" },
    description: {
      uz: "Suhbat, test, fikr yoki kuzatilgan natija bor.",
      ru: "Интервью, тестирование, отзывы, наблюдаемые результаты.",
      en: "Interviews, tests, feedback, or observed results.",
    },
  },
  {
    key: "market_sustainability",
    order: 4,
    maxPoints: 15,
    title: { uz: "Bozor va barqarorlik", ru: "Рынок и устойчивость", en: "Market and sustainability" },
    description: {
      uz: "Muqobillar, auditoriya va barqaror model tushunarli.",
      ru: "Понимание альтернатив, аудитории и модели устойчивого развития.",
      en: "Alternatives, audience, and a sustainable model are understood.",
    },
  },
  {
    key: "roadmap_realism",
    order: 5,
    maxPoints: 10,
    title: { uz: "12 haftalik reja realligi", ru: "Реалистичность плана на 12 недель", en: "12-week plan realism" },
    description: {
      uz: "Keyingi ustuvorliklar aniq va bajarilishi mumkin.",
      ru: "Конкретные приоритеты и выполнимость дальнейшего плана.",
      en: "The next priorities are concrete and feasible.",
    },
  },
  {
    key: "team_execution",
    order: 6,
    maxPoints: 10,
    title: { uz: "Jamoa va ijro", ru: "Команда и исполнение", en: "Team and execution" },
    description: {
      uz: "Rollar taqsimlangan va jamoa qarorlarini tushuntira oladi.",
      ru: "Распределение ролей, владение продуктом и способность отвечать за решения.",
      en: "Roles are clear and the team can account for its decisions.",
    },
  },
  {
    key: "pitch_qa",
    order: 7,
    maxPoints: 10,
    title: { uz: "Taqdimot va savollar", ru: "Питч и ответы на вопросы", en: "Pitch and answers" },
    description: {
      uz: "Taqdimot tuzilgan, ravshan va javoblar sifati yaxshi.",
      ru: "Структурированность, ясность и качество ответов.",
      en: "The pitch is structured and the answers are clear.",
    },
  },
];

export const TRACKS = [
  {
    slug: "ai-automation",
    order: 1,
    name: { uz: "AI va avtomatlashtirish", ru: "AI и автоматизация", en: "AI & Automation" },
    description: {
      uz: "Sun’iy intellekt vositalari, avtomatlashtirish, AI-agentlar va ma’lumot tahlili.",
      ru: "ИИ-инструменты, автоматизация, AI-агенты и анализ данных.",
      en: "AI tools, automation, agents, and data analysis.",
    },
  },
  {
    slug: "edtech",
    order: 2,
    name: { uz: "EdTech", ru: "EdTech", en: "EdTech" },
    description: {
      uz: "O‘qitish, talaba va o‘qituvchilar uchun vositalar, ta’lim platformalari.",
      ru: "Обучение, инструменты для студентов и преподавателей, образовательные платформы.",
      en: "Learning tools for students and teachers, and education platforms.",
    },
  },
  {
    slug: "healthtech",
    order: 3,
    name: { uz: "HealthTech", ru: "HealthTech", en: "HealthTech" },
    description: {
      uz: "Tibbiy xizmatlardan foydalanish, raqamli salomatlik va tibbiy servislar.",
      ru: "Доступ к медицинским услугам, цифровое здоровье и медицинские сервисы.",
      en: "Access to care, digital health, and medical services.",
    },
  },
  {
    slug: "fintech",
    order: 4,
    name: { uz: "FinTech", ru: "FinTech", en: "FinTech" },
    description: {
      uz: "Moliyaviy savodxonlik, to‘lovlar, shaxsiy va biznes moliyasini boshqarish.",
      ru: "Финансовая грамотность, платежи, личные и бизнес-финансы.",
      en: "Financial literacy, payments, and personal or business finance.",
    },
  },
  {
    slug: "businesstech",
    order: 5,
    name: { uz: "BusinessTech va elektron tijorat", ru: "BusinessTech и электронная коммерция", en: "BusinessTech & E-commerce" },
    description: {
      uz: "Savdo, marketing, logistika va biznes jarayonlarini avtomatlashtirish.",
      ru: "Торговля, маркетинг, логистика и автоматизация бизнеса.",
      en: "Commerce, marketing, logistics, and business automation.",
    },
  },
  {
    slug: "smart-city",
    order: 6,
    name: { uz: "Aqlli shahar va GovTech", ru: "Умный город и GovTech", en: "Smart City & GovTech" },
    description: {
      uz: "Shahar servislari, transport, universitet va jamoat xizmatlarini raqamlashtirish.",
      ru: "Городские сервисы, транспорт, цифровизация университетских и общественных услуг.",
      en: "City services, transport, and digital public or university services.",
    },
  },
] as const;

export const CHECKLIST_KEYS = [
  "mvp_opens",
  "video_ready",
  "product_access",
  "prd_pdf",
  "pitch_deck",
  "github_or_equivalent",
  "readme_disclosed",
  "prior_work_disclosed",
  "materials_reviewed",
] as const;

export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];
