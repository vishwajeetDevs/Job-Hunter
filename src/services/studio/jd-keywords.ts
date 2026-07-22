/**
 * Shared job-description keyword model.
 *
 * A single source of truth for "what this posting is really asking for",
 * used by BOTH the deterministic match scorer and the resume optimizer.
 * Because the scorer rewards coverage of exactly these terms and the
 * optimizer is told to surface exactly these terms (only where truthful),
 * genuine optimization is always reflected as a measurable score increase.
 */

export type JdKeyword = {
  /** Canonical lowercase form used for matching. */
  term: string;
  /** Representative original-case form for display. */
  display: string;
  /** Relative importance (frequency + skill/role boosts). */
  weight: number;
  /** True when the term is a concrete hard skill / technology. */
  isSkill: boolean;
};

/**
 * Multi-word skills and role titles matched as a unit — splitting them into
 * tokens would lose meaning (e.g. "machine learning", "data analyst").
 */
const KNOWN_PHRASES: string[] = [
  // Technologies / practices
  "machine learning", "deep learning", "data science", "data engineering",
  "computer science", "rest api", "restful api", "web api", "unit testing",
  "integration testing", "end to end", "ci/cd", "next.js", "node.js",
  "react native", "spring boot", "asp.net", "entity framework", "objective c",
  "objective-c", "power bi", "google cloud", "microsoft azure",
  "amazon web services", "version control", "design patterns",
  "test driven development", "object oriented", "message queue",
  "micro services", "microservices", "distributed systems",
  "natural language processing", "continuous integration",
  "continuous deployment", "sql server", "shell scripting", "data structures",
  "data pipelines", "data warehouse", "big data", "computer vision",
  "reinforcement learning", "responsive design", "cross browser",
  // Role / domain titles
  "software engineer", "software developer", "full stack", "front end",
  "back end", "frontend developer", "backend developer", "data analyst",
  "data scientist", "product manager", "project manager", "machine learning engineer",
  "site reliability", "quality assurance", "business analyst",
  "ui/ux", "user experience", "user interface",
];

/**
 * Concrete hard skills / technologies. A JD token in this set is treated as a
 * skill and weighted higher, since skill coverage is the strongest signal of
 * genuine fit (and the thing optimization can legitimately surface).
 */
const TECH_VOCAB = new Set<string>([
  "javascript", "typescript", "react", "angular", "vue", "svelte", "node",
  "nodejs", "python", "java", "kotlin", "swift", "ruby", "php", "golang",
  "rust", "scala", "perl", "matlab", "dart", "elixir", "clojure", "haskell",
  "sql", "nosql", "postgresql", "postgres", "mysql", "mongodb", "redis",
  "sqlite", "oracle", "mariadb", "cassandra", "dynamodb", "elasticsearch",
  "snowflake", "databricks", "bigquery", "redshift",
  "aws", "azure", "gcp", "heroku", "vercel", "netlify", "cloudflare",
  "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins", "gitlab",
  "github", "git", "bitbucket", "circleci",
  "graphql", "rest", "grpc", "kafka", "rabbitmq", "spark", "hadoop", "airflow",
  "tableau", "powerbi", "looker", "excel", "numpy", "pandas", "tensorflow",
  "pytorch", "keras", "scikit", "sklearn", "matplotlib", "seaborn",
  "django", "flask", "fastapi", "spring", "express", "rails", "laravel",
  "dotnet", "csharp", "cpp", "html", "css", "sass", "scss", "tailwind",
  "bootstrap", "webpack", "vite", "babel", "redux", "nextjs", "nuxt", "remix",
  "jest", "cypress", "playwright", "selenium", "junit", "pytest", "mocha",
  "linux", "unix", "bash", "powershell", "figma", "sketch", "jira",
  "confluence", "salesforce", "sap", "servicenow", "prisma", "graphite",
  "etl", "elt", "api", "apis", "microservices", "saas", "paas",
  "agile", "scrum", "kanban", "jquery", "webpack", "storybook",
  "kotlin", "flutter", "android", "ios", "xcode", "unity", "unreal",
]);

/** Role nouns worth a small boost — role relevance, not a hard skill. */
const ROLE_NOUNS = new Set<string>([
  "developer", "engineer", "analyst", "designer", "manager", "scientist",
  "architect", "administrator", "consultant", "specialist", "programmer",
  "tester", "devops", "researcher", "technician",
]);

/**
 * Terms that carry no signal for skill/requirement matching: grammar glue,
 * HR/logistics boilerplate, and posting fluff. Filtering these keeps the
 * keyword set focused on real requirements instead of noise like
 * "individuals", "full-time", "office", or salary figures.
 */
const NOISE = new Set<string>([
  // Grammar glue
  "the", "and", "for", "are", "our", "you", "your", "with", "this", "that",
  "will", "have", "had", "has", "from", "not", "but", "all", "any", "can",
  "who", "was", "were", "they", "them", "their", "there", "here", "when",
  "what", "which", "while", "into", "out", "over", "under", "such", "than",
  "then", "his", "her", "its", "we", "us", "an", "or", "of", "to", "in", "on",
  "at", "as", "is", "be", "by", "it", "a", "also", "may", "must", "should",
  "would", "could", "well", "like", "so", "if", "do", "does", "did", "up",
  "off", "per", "via", "each", "both", "some", "many", "few", "own", "same",
  // Posting fluff / HR / logistics
  "job", "jobs", "role", "roles", "work", "working", "team", "teams",
  "company", "companies", "candidate", "candidates", "applicant", "applicants",
  "position", "positions", "responsibilities", "responsibility", "requirements",
  "requirement", "required", "require", "requires", "qualifications",
  "qualification", "qualified", "preferred", "preferably", "ability", "able",
  "strong", "good", "excellent", "years", "year", "experience", "experienced",
  "including", "include", "includes", "included", "etc", "using", "use",
  "used", "uses", "across", "within", "about", "environment", "environments",
  "opportunity", "opportunities", "skills", "skill", "knowledge",
  "understanding", "understand", "based", "new", "more", "most", "other",
  "others", "one", "two", "three", "four", "five", "day", "days", "time",
  "times", "level", "levels", "senior", "junior", "lead", "part", "full",
  "self", "high", "low", "great", "best", "key", "core", "related", "various",
  "individual", "individuals", "person", "people", "type", "types", "kind",
  "kinds", "office", "onsite", "on-site", "remote", "hybrid", "full-time",
  "part-time", "fulltime", "parttime", "contract", "contractor", "internship",
  "intern", "salary", "salaries", "compensation", "benefits", "benefit",
  "insurance", "medical", "dental", "vision", "pto", "equity", "bonus",
  "hour", "hours", "hourly", "week", "weekly", "month", "monthly", "annual",
  "annually", "hiring", "hire", "hires", "apply", "employer", "employment",
  "employee", "employees", "eeo", "equal", "diversity", "inclusion",
  "disability", "veteran", "gender", "race", "religion", "status", "please",
  "join", "looking", "seeking", "seek", "plus", "help", "helping", "make",
  "making", "build", "building", "ensure", "ensuring", "provide", "providing",
  "support", "supporting", "deliver", "delivering", "drive", "driving",
  "develop", "developing", "development", "developer", "engineer",
  "engineering", "software", "applications", "application", "solutions",
  "solution", "business", "products", "product", "customers", "customer",
  "users", "user", "clients", "client", "stakeholders", "stakeholder",
  "internal", "external", "cross", "functional", "including", "etc",
  "communication", "communicate", "collaborate", "collaboration", "passion",
  "passionate", "motivated", "detail", "oriented", "fast", "paced",
  "excellent", "written", "verbal", "problem", "solving", "solve",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when a keyword genuinely appears in the resume text. Alphanumeric
 * terms match on word boundaries (so "sql" does not match "mysql" and "java"
 * does not match "javascript"); terms with punctuation/spaces (phrases,
 * "node.js", "ci/cd", "c++") match as substrings.
 */
export function resumeIncludesTerm(resumeLower: string, term: string): boolean {
  if (/[^a-z0-9]/.test(term)) {
    return resumeLower.includes(term);
  }
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`).test(
    resumeLower
  );
}

/**
 * Extracts the most important, de-noised keywords from a job description,
 * each with an importance weight and a skill flag.
 */
export function extractJdKeywords(
  jobDescription: string,
  max = 30
): JdKeyword[] {
  const lower = jobDescription.toLowerCase();
  const weight = new Map<string, number>();
  const display = new Map<string, string>();
  const skillFlag = new Set<string>();

  // Multi-word phrases first so their component tokens don't dominate.
  for (const phrase of KNOWN_PHRASES) {
    if (lower.includes(phrase)) {
      weight.set(phrase, (weight.get(phrase) ?? 0) + 4);
      display.set(phrase, phrase);
      skillFlag.add(phrase);
    }
  }

  // Unigrams: letter-initial tokens only, so salary figures like "000.00"
  // and codes like "401k" are ignored as noise.
  const tokens = jobDescription.match(/[A-Za-z][A-Za-z0-9+.#/-]*/g) ?? [];
  const freq = new Map<string, number>();
  const firstDisplay = new Map<string, string>();

  for (const original of tokens) {
    const token = original.toLowerCase().replace(/[.\-/]+$/, "");
    if (token.length < 2 || token.length > 30) continue;
    if (NOISE.has(token)) continue;
    freq.set(token, (freq.get(token) ?? 0) + 1);
    if (!firstDisplay.has(token)) firstDisplay.set(token, original);
  }

  for (const [token, count] of freq) {
    // Frequency signals importance, capped so a repeated buzzword can't
    // dominate genuine but singly-mentioned skills.
    let w = Math.min(count, 3);
    const isTech = TECH_VOCAB.has(token);

    if (isTech) {
      w += 3;
      skillFlag.add(token);
    }
    if (ROLE_NOUNS.has(token)) {
      w += 2;
    }

    weight.set(token, (weight.get(token) ?? 0) + w);
    if (!display.has(token)) {
      display.set(token, firstDisplay.get(token) ?? token);
    }
  }

  return [...weight.entries()]
    .map(([term, w]) => ({
      term,
      display: display.get(term) ?? term,
      weight: w,
      isSkill: skillFlag.has(term),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max);
}

/**
 * Ordered list of the posting's most important keyword strings (skills
 * first), for steering the optimizer. These are hints to surface only where
 * the candidate's real background supports them — never fabrication targets.
 */
export function topJdKeywordStrings(
  jobDescription: string,
  max = 18
): string[] {
  const keywords = extractJdKeywords(jobDescription, max + 10);
  return [...keywords]
    .sort((a, b) => {
      // Skills before generic keywords, then by weight.
      if (a.isSkill !== b.isSkill) return a.isSkill ? -1 : 1;
      return b.weight - a.weight;
    })
    .slice(0, max)
    .map((keyword) => keyword.display);
}
