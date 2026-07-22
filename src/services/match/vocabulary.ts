/**
 * Shared vocabulary for the centralized Match Score Engine.
 *
 * Single source of truth for what counts as a skill, what is noise, and
 * which spellings mean the same thing. Both sides of every comparison
 * (resume keywords and job-description keywords) are canonicalized through
 * this module, so "React.js" on a resume is never reported missing against
 * "ReactJS" in a posting.
 */

/**
 * Spelling variants → canonical term. Both resume and JD terms are passed
 * through this map before comparison, so variants never count as gaps.
 */
const ALIASES: Record<string, string> = {
  // JavaScript ecosystem
  "js": "javascript",
  "react.js": "react",
  "reactjs": "react",
  "nodejs": "node.js",
  "node": "node.js",
  "nextjs": "next.js",
  "vuejs": "vue",
  "vue.js": "vue",
  "angularjs": "angular",
  "angular.js": "angular",
  "expressjs": "express",
  "express.js": "express",
  "tailwindcss": "tailwind css",
  "tailwind": "tailwind css",
  // .NET / C-family
  "dotnet": ".net",
  "dot-net": ".net",
  ".net core": ".net",
  "csharp": "c#",
  "cpp": "c++",
  "asp.net core": "asp.net",
  "aspnet": "asp.net",
  // Data / cloud
  "postgres": "postgresql",
  "mongo": "mongodb",
  "k8s": "kubernetes",
  "amazon web services": "aws",
  "google cloud": "gcp",
  "google cloud platform": "gcp",
  "microsoft azure": "azure",
  "ms sql": "sql server",
  "mssql": "sql server",
  "sqlserver": "sql server",
  "powerbi": "power bi",
  "sklearn": "scikit-learn",
  "scikit": "scikit-learn",
  "scikit learn": "scikit-learn",
  "tensor flow": "tensorflow",
  // Practices / misc
  "cicd": "ci/cd",
  "ci-cd": "ci/cd",
  "ci cd": "ci/cd",
  "restful": "rest api",
  "rest": "rest api",
  "restful api": "rest api",
  "restful apis": "rest api",
  "rest apis": "rest api",
  "web api": "rest api",
  "ux/ui": "ui/ux",
  "ux ui": "ui/ux",
  "html5": "html",
  "css3": "css",
  "golang": "go",
  "micro services": "microservices",
  "micro-services": "microservices",
  "machine-learning": "machine learning",
  "objective-c": "objective c",
};

/** Nice display casing for canonical terms (fallback: source casing). */
export const DISPLAY_OVERRIDES: Record<string, string> = {
  "javascript": "JavaScript",
  "typescript": "TypeScript",
  "react": "React",
  "node.js": "Node.js",
  "next.js": "Next.js",
  "vue": "Vue",
  "angular": "Angular",
  "express": "Express",
  "tailwind css": "Tailwind CSS",
  ".net": ".NET",
  "c#": "C#",
  "c++": "C++",
  "asp.net": "ASP.NET",
  "postgresql": "PostgreSQL",
  "mongodb": "MongoDB",
  "kubernetes": "Kubernetes",
  "aws": "AWS",
  "gcp": "GCP",
  "azure": "Azure",
  "sql server": "SQL Server",
  "power bi": "Power BI",
  "scikit-learn": "scikit-learn",
  "tensorflow": "TensorFlow",
  "pytorch": "PyTorch",
  "ci/cd": "CI/CD",
  "rest api": "REST API",
  "ui/ux": "UI/UX",
  "html": "HTML",
  "css": "CSS",
  "sql": "SQL",
  "php": "PHP",
  "graphql": "GraphQL",
  "mysql": "MySQL",
  "python": "Python",
  "java": "Java",
  "go": "Go",
  "machine learning": "Machine Learning",
};

/**
 * Canonicalizes a term for comparison: lowercase, collapsed whitespace,
 * trailing punctuation stripped, spelling variants resolved.
 */
export function canonicalizeTerm(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "")
    .trim();
  return ALIASES[cleaned] ?? cleaned;
}

/** Display form for a canonical term (falls back to the source form). */
export function displayForTerm(canonical: string, source: string): string {
  return DISPLAY_OVERRIDES[canonical] ?? source;
}

/**
 * Multi-word skills and role titles matched as a unit — splitting them into
 * tokens would lose meaning. Also hosts terms the tokenizer can't produce
 * (".net" starts with punctuation). Scanned as substrings of the text.
 */
export const KNOWN_PHRASES: string[] = [
  // Technologies / practices
  "machine learning", "deep learning", "data science", "data engineering",
  "computer science", "rest api", "restful api", "web api", "unit testing",
  "integration testing", "end to end", "ci/cd", "next.js", "node.js",
  "react native", "spring boot", "asp.net", ".net", "entity framework",
  "objective c", "power bi", "google cloud", "microsoft azure",
  "amazon web services", "version control", "design patterns",
  "test driven development", "object oriented", "message queue",
  "micro services", "microservices", "distributed systems",
  "natural language processing", "continuous integration",
  "continuous deployment", "sql server", "shell scripting", "data structures",
  "data pipelines", "data warehouse", "big data", "computer vision",
  "reinforcement learning", "responsive design", "tailwind css",
  "scikit-learn", "problem solving",
  // Role / domain titles
  "software engineer", "software developer", "full stack", "front end",
  "back end", "frontend developer", "backend developer", "web developer",
  "data analyst", "data scientist", "product manager", "project manager",
  "machine learning engineer", "site reliability", "quality assurance",
  "business analyst", "ui/ux", "user experience", "user interface",
  "technical leadership",
];

/**
 * Concrete hard skills / technologies (single tokens). A term in this set is
 * weighted higher: skill coverage is the strongest signal of genuine fit and
 * the thing optimization can legitimately surface.
 */
export const TECH_VOCAB = new Set<string>([
  "javascript", "typescript", "react", "angular", "vue", "svelte", "node.js",
  "python", "java", "kotlin", "swift", "ruby", "php", "go", "rust", "scala",
  "perl", "matlab", "dart", "elixir", "clojure", "haskell", "c", "c#", "c++",
  "sql", "nosql", "postgresql", "mysql", "mongodb", "redis", "sqlite",
  "oracle", "mariadb", "cassandra", "dynamodb", "elasticsearch", "snowflake",
  "databricks", "bigquery", "redshift",
  "aws", "azure", "gcp", "heroku", "vercel", "netlify", "cloudflare",
  "docker", "kubernetes", "terraform", "ansible", "jenkins", "gitlab",
  "github", "git", "bitbucket", "circleci",
  "graphql", "grpc", "kafka", "rabbitmq", "spark", "hadoop", "airflow",
  "tableau", "looker", "excel", "numpy", "pandas", "tensorflow", "pytorch",
  "keras", "matplotlib", "seaborn", "opencv", "nltk", "spacy",
  "django", "flask", "fastapi", "spring", "express", "rails", "laravel",
  ".net", "html", "css", "sass", "scss", "bootstrap", "webpack", "vite",
  "babel", "redux", "next.js", "nuxt", "remix", "jquery", "storybook",
  "jest", "cypress", "playwright", "selenium", "junit", "pytest", "mocha",
  "linux", "unix", "bash", "powershell", "figma", "sketch", "jira",
  "confluence", "salesforce", "sap", "servicenow", "prisma", "supabase",
  "firebase", "stripe", "twilio", "etl", "elt", "api", "apis", "microservices",
  "saas", "agile", "scrum", "kanban", "flutter", "android", "ios", "xcode",
  "unity", "unreal", "blockchain", "solidity", "grafana", "prometheus",
  "datadog", "splunk", "nginx", "apache", "sql server", "power bi",
  "scikit-learn", "tailwind css", "ci/cd", "rest api", "ui/ux",
  // Multi-word technology phrases (canonical forms of KNOWN_PHRASES)
  "machine learning", "deep learning", "data science", "data engineering",
  "computer vision", "natural language processing", "spring boot",
  "react native", "asp.net", "entity framework", "unit testing",
  "integration testing", "distributed systems", "data structures",
  "data pipelines", "data warehouse", "big data", "version control",
  "design patterns", "shell scripting", "objective c", ".net",
]);

/** Role nouns — drive role/title alignment and get a modest weight. */
export const ROLE_NOUNS = new Set<string>([
  "developer", "engineer", "analyst", "designer", "manager", "scientist",
  "architect", "administrator", "consultant", "specialist", "programmer",
  "tester", "devops", "sre", "researcher", "technician", "intern",
]);

/**
 * Terms that carry no matching signal: grammar glue, HR/logistics
 * boilerplate ("individuals", "full-time", "office", salary/benefit talk),
 * and posting fluff. Filtered from both JD and resume keyword extraction.
 */
export const NOISE = new Set<string>([
  // Grammar glue
  "the", "and", "for", "are", "our", "you", "your", "with", "this", "that",
  "will", "have", "had", "has", "from", "not", "but", "all", "any", "can",
  "who", "was", "were", "they", "them", "their", "there", "here", "when",
  "what", "which", "while", "into", "out", "over", "under", "such", "than",
  "then", "his", "her", "its", "we", "us", "an", "or", "of", "to", "in",
  "on", "at", "as", "is", "be", "by", "it", "a", "also", "may", "must",
  "should", "would", "could", "well", "like", "so", "if", "do", "does",
  "did", "up", "off", "per", "via", "each", "both", "some", "many", "few",
  "own", "same", "other", "others", "one", "two", "three", "four", "five",
  // Posting fluff / HR / logistics
  "job", "jobs", "role", "roles", "work", "working", "works", "team",
  "teams", "company", "companies", "candidate", "candidates", "applicant",
  "applicants", "individual", "individuals", "person", "people", "type",
  "types", "kind", "kinds", "position", "positions", "responsibilities",
  "responsibility", "requirements", "requirement", "required", "require",
  "requires", "qualifications", "qualification", "qualified", "preferred",
  "preferably", "ability", "able", "strong", "good", "excellent", "years",
  "year", "experience", "experienced", "including", "include", "includes",
  "included", "etc", "using", "use", "used", "uses", "across", "within",
  "about", "environment", "environments", "opportunity", "opportunities",
  "skills", "skill", "knowledge", "understanding", "understand", "based",
  "new", "more", "most", "day", "days", "time", "times", "level", "levels",
  "senior", "junior", "lead", "part", "full", "self", "high", "low",
  "great", "best", "key", "core", "related", "various", "office", "onsite",
  "on-site", "remote", "hybrid", "full-time", "part-time", "fulltime",
  "parttime", "contract", "contractor", "internship", "salary", "salaries",
  "compensation", "benefits", "benefit", "insurance", "medical", "dental",
  "vision", "pto", "equity", "bonus", "hour", "hours", "hourly", "week",
  "weekly", "month", "monthly", "annual", "annually", "hiring", "hire",
  "hires", "apply", "employer", "employment", "employee", "employees",
  "eeo", "equal", "diversity", "inclusion", "disability", "veteran",
  "gender", "race", "religion", "status", "please", "join", "looking",
  "seeking", "seek", "plus", "help", "helping", "make", "making", "build",
  "building", "ensure", "ensuring", "provide", "providing", "support",
  "supporting", "deliver", "delivering", "drive", "driving", "develop",
  "developing", "development", "software", "applications", "application",
  "solutions", "solution", "business", "products", "product", "customers",
  "customer", "users", "user", "clients", "client", "stakeholders",
  "stakeholder", "internal", "external", "cross", "functional",
  "communication", "communicate", "collaborate", "collaboration",
  "passion", "passionate", "motivated", "detail", "oriented", "fast",
  "paced", "written", "verbal", "grade", "track", "record", "ideal",
  "possess", "proven", "successful", "execution", "complex", "guiding",
  "essential", "highly", "skilled",
]);
