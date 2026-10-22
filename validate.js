const CATEGORIES = [
  "Tech",
  "Health",
  "AI",
  "Education",
  "Finance",
  "Business",
  "Environment",
  "Lifestyle",
];
const PRIORITIES = ["Low", "Medium", "High"];

const str = (v) => (typeof v === "string" ? v.trim() : v);

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const textRule = (label, min, max) => (value) => {
  if (typeof value !== "string" || value.length < min) {
    return `${label} must be at least ${min} characters`;
  }
  if (value.length > max) return `${label} must be at most ${max} characters`;
};

const ideaRules = {
  title: { required: true, check: textRule("Title", 3, 100) },
  sortDescription: { required: true, check: textRule("Short description", 10, 200) },
  description: { required: true, check: textRule("Full description", 30, 5000) },
  category: {
    required: true,
    check: (v) => (CATEGORIES.includes(v) ? undefined : `Category must be one of: ${CATEGORIES.join(", ")}`),
  },
  targetAudience: { required: true, check: textRule("Target audience", 2, 150) },
  problemStatement: { required: true, check: textRule("Problem statement", 20, 2000) },
  proposedSolution: { required: true, check: textRule("Proposed solution", 20, 2000) },
  tags: {
    required: false,
    check: (v) => (typeof v === "string" && v.length <= 200 ? undefined : "Tags must be at most 200 characters"),
  },
  imgUrl: {
    required: false,
    check: (v) => (typeof v === "string" && isHttpUrl(v) && v.length <= 2000 ? undefined : "Image must be a valid http(s) URL"),
  },
  priority: {
    required: false,
    check: (v) => (PRIORITIES.includes(v) ? undefined : `Priority must be one of: ${PRIORITIES.join(", ")}`),
  },
  estimatedBudget: {
    required: false,
    check: (v) => (Number.isFinite(v) && v >= 0 && v <= 1e12 ? undefined : "Budget must be a number of 0 or more"),
  },
};

/**
 * Validates an idea payload. Only whitelisted fields are returned, so clients
 * cannot inject fields such as authorEmail or likes.
 * `partial` skips the required check (used for updates).
 */
function validateIdea(body = {}, { partial = false } = {}) {
  const errors = {};
  const data = {};

  for (const [field, rule] of Object.entries(ideaRules)) {
    let value = str(body[field]);
    const empty = value === undefined || value === null || value === "";

    if (field === "estimatedBudget" && !empty) value = Number(value);

    if (empty) {
      if (rule.required && !partial) errors[field] = "This field is required";
      continue;
    }
    const message = rule.check(value);
    if (message) errors[field] = message;
    else data[field] = value;
  }

  return { data, errors, valid: Object.keys(errors).length === 0 };
}

function validateComment(body = {}) {
  const text = str(body.text);
  if (typeof text !== "string" || text.length < 1) return { error: "Comment cannot be empty" };
  if (text.length > 1000) return { error: "Comment must be at most 1000 characters" };
  return { text };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContact(body = {}) {
  const errors = {};
  const name = str(body.name);
  const email = str(body.email);
  const message = str(body.message);

  if (typeof name !== "string" || name.length < 2 || name.length > 80) {
    errors.name = "Name must be 2-80 characters";
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 120) {
    errors.email = "Enter a valid email address";
  }
  if (typeof message !== "string" || message.length < 10 || message.length > 2000) {
    errors.message = "Message must be 10-2000 characters";
  }
  return { data: { name, email, message }, errors, valid: Object.keys(errors).length === 0 };
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
  CATEGORIES,
  PRIORITIES,
  validateIdea,
  validateComment,
  validateContact,
  escapeRegex,
};
