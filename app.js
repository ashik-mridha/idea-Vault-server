const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const {
  CATEGORIES,
  validateIdea,
  validateComment,
  validateContact,
  escapeRegex,
} = require("./validate");

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "budget-asc": { budgetNum: 1, createdAt: -1 },
  "budget-desc": { budgetNum: -1, createdAt: -1 },
};

// Public responses never include other people's email addresses; clients get an isOwner flag instead.
const presentIdea = (idea, user) => {
  const { authorEmail, ...rest } = idea;
  return { ...rest, isOwner: Boolean(user) && authorEmail === user.email };
};
const presentComment = (comment, user) => {
  const { userEmail, ...rest } = comment;
  return { ...rest, isOwner: Boolean(user) && userEmail === user.email };
};

const toObjectId = (id) => (OBJECT_ID_RE.test(id) ? new ObjectId(id) : null);

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function parseBudget(value) {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Builds the Express app. `verifyIdToken(token)` must resolve to the decoded
 * Firebase token ({ email, name, picture, uid }) or reject.
 */
function createApp({ db, verifyIdToken, clientOrigins = [] }) {
  const ideas = db.collection("ideas");
  const comments = db.collection("comments");
  const contacts = db.collection("contacts");

  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (clientOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
    })
  );
  app.use(express.json({ limit: "100kb" }));

  async function userFromHeader(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return { error: "Unauthorized" };
    try {
      const decoded = await verifyIdToken(header.slice(7));
      if (!decoded?.email) return { error: "Token has no email" };
      return {
        user: {
          uid: decoded.uid,
          email: decoded.email,
          name: decoded.name || decoded.email.split("@")[0],
          image: decoded.picture || "",
        },
      };
    } catch {
      return { error: "Invalid or expired token" };
    }
  }

  async function authenticate(req, res, next) {
    const { user, error } = await userFromHeader(req);
    if (error) return res.status(401).json({ message: error });
    req.user = user;
    next();
  }

  // Identifies the caller when a valid token is sent, but lets anonymous requests through.
  async function optionalAuth(req, res, next) {
    req.user = (await userFromHeader(req)).user;
    next();
  }

  app.get("/", (req, res) => {
    res.send("IdeaVault API is running");
  });

  app.get("/ideas/trending", optionalAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 6, 20);
    const result = await ideas
      .aggregate([
        {
          $lookup: {
            from: "comments",
            let: { id: { $toString: "$_id" } },
            pipeline: [{ $match: { $expr: { $eq: ["$ideaId", "$$id"] } } }, { $project: { _id: 1 } }],
            as: "comments",
          },
        },
        {
          $addFields: {
            interactionScore: {
              $add: [{ $ifNull: ["$likes", 0] }, { $multiply: [{ $size: "$comments" }, 2] }],
            },
          },
        },
        { $sort: { interactionScore: -1, createdAt: -1 } },
        { $limit: limit },
        { $project: { comments: 0 } },
      ])
      .toArray();
    res.json(result.map((idea) => presentIdea(idea, req.user)));
  });

  app.get("/categories", async (req, res) => {
    const rows = await ideas
      .aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }])
      .toArray();
    const counts = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    res.json(CATEGORIES.map((category) => ({ category, count: counts[category] || 0 })));
  });

  app.get("/ideas", optionalAuth, async (req, res) => {
    const { search, category, sort = "newest" } = req.query;
    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate, true);
    const minBudget = parseBudget(req.query.minBudget);
    const maxBudget = parseBudget(req.query.maxBudget);

    if (startDate === undefined || endDate === undefined) {
      return res.status(400).json({ message: "Invalid date filter" });
    }
    if (minBudget === undefined || maxBudget === undefined) {
      return res.status(400).json({ message: "Budget filters must be numbers of 0 or more" });
    }
    if (!SORTS[sort]) {
      return res.status(400).json({ message: `sort must be one of: ${Object.keys(SORTS).join(", ")}` });
    }

    const match = {};
    if (search) {
      const pattern = { $regex: escapeRegex(String(search).slice(0, 100)), $options: "i" };
      match.$or = [{ title: pattern }, { sortDescription: pattern }, { tags: pattern }];
    }
    if (category && category !== "All") match.category = String(category);
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = startDate;
      if (endDate) match.createdAt.$lte = endDate;
    }

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          budgetNum: { $convert: { input: "$estimatedBudget", to: "double", onError: 0, onNull: 0 } },
        },
      },
    ];
    if (minBudget !== null || maxBudget !== null) {
      const range = {};
      if (minBudget !== null) range.$gte = minBudget;
      if (maxBudget !== null) range.$lte = maxBudget;
      pipeline.push({ $match: { budgetNum: range } });
    }
    pipeline.push({ $sort: SORTS[sort] });
    const limit = parseInt(req.query.limit, 10);
    if (limit > 0) pipeline.push({ $limit: Math.min(limit, 100) });
    pipeline.push({ $project: { budgetNum: 0 } });

    const result = await ideas.aggregate(pipeline).toArray();
    res.json(result.map((idea) => presentIdea(idea, req.user)));
  });

  app.get("/idea/:id", optionalAuth, async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid idea id" });
    const idea = await ideas.findOne({ _id });
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    res.json(presentIdea(idea, req.user));
  });

  app.get("/idea/:id/related", optionalAuth, async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid idea id" });
    const idea = await ideas.findOne({ _id }, { projection: { category: 1 } });
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    // Same-category ideas first; top up with the newest other ideas so the section is never empty.
    const sameCategory = await ideas
      .find({ category: idea.category, _id: { $ne: _id } })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();
    const others =
      sameCategory.length < 3
        ? await ideas
            .find({ category: { $ne: idea.category }, _id: { $ne: _id } })
            .sort({ createdAt: -1 })
            .limit(3 - sameCategory.length)
            .toArray()
        : [];
    res.json([...sameCategory, ...others].map((item) => presentIdea(item, req.user)));
  });

  app.post("/ideas", authenticate, async (req, res) => {
    const { data, errors, valid } = validateIdea(req.body);
    if (!valid) return res.status(400).json({ message: "Validation failed", errors });

    const now = new Date();
    const result = await ideas.insertOne({
      ...data,
      authorEmail: req.user.email,
      authorName: req.user.name,
      authorImage: req.user.image,
      likes: 0,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ insertedId: result.insertedId, acknowledged: result.acknowledged });
  });

  app.get("/my-ideas", authenticate, async (req, res) => {
    const result = await ideas.find({ authorEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json(result.map((idea) => presentIdea(idea, req.user)));
  });

  app.put("/idea/:id", authenticate, async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid idea id" });

    const idea = await ideas.findOne({ _id });
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    if (idea.authorEmail !== req.user.email) return res.status(403).json({ message: "Not allowed" });

    const { data, errors, valid } = validateIdea(req.body, { partial: true });
    if (!valid) return res.status(400).json({ message: "Validation failed", errors });

    const result = await ideas.updateOne({ _id }, { $set: { ...data, updatedAt: new Date() } });
    res.json({ acknowledged: result.acknowledged, modifiedCount: result.modifiedCount });
  });

  app.delete("/idea/:id", authenticate, async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid idea id" });

    const idea = await ideas.findOne({ _id });
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    if (idea.authorEmail !== req.user.email) return res.status(403).json({ message: "Not allowed" });

    await comments.deleteMany({ ideaId: req.params.id });
    const result = await ideas.deleteOne({ _id });
    res.json({ acknowledged: result.acknowledged, deletedCount: result.deletedCount });
  });

  app.post("/comment", authenticate, async (req, res) => {
    const _id = toObjectId(req.body?.ideaId);
    if (!_id) return res.status(400).json({ message: "Invalid idea id" });
    if (!(await ideas.findOne({ _id }, { projection: { _id: 1 } }))) {
      return res.status(404).json({ message: "Idea not found" });
    }
    const { text, error } = validateComment(req.body);
    if (error) return res.status(400).json({ message: error });

    const now = new Date();
    const result = await comments.insertOne({
      ideaId: req.body.ideaId,
      text,
      userEmail: req.user.email,
      userName: req.user.name,
      userImage: req.user.image,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ insertedId: result.insertedId, acknowledged: result.acknowledged });
  });

  app.get("/comments/:ideaId", optionalAuth, async (req, res) => {
    const result = await comments.find({ ideaId: req.params.ideaId }).sort({ createdAt: -1 }).toArray();
    res.json(result.map((comment) => presentComment(comment, req.user)));
  });

  app.put("/comment/:id", authenticate, async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid comment id" });

    const comment = await comments.findOne({ _id });
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.userEmail !== req.user.email) return res.status(403).json({ message: "Not allowed" });

    const { text, error } = validateComment(req.body);
    if (error) return res.status(400).json({ message: error });

    const result = await comments.updateOne({ _id }, { $set: { text, updatedAt: new Date() } });
    res.json({ acknowledged: result.acknowledged, modifiedCount: result.modifiedCount });
  });

  app.delete("/comment/:id", authenticate, async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid comment id" });

    const comment = await comments.findOne({ _id });
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.userEmail !== req.user.email) return res.status(403).json({ message: "Not allowed" });

    const result = await comments.deleteOne({ _id });
    res.json({ acknowledged: result.acknowledged, deletedCount: result.deletedCount });
  });

  app.get("/my-interactions", authenticate, async (req, res) => {
    const mine = await comments.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray();

    const objectIds = [...new Set(mine.map((c) => c.ideaId))].map(toObjectId).filter(Boolean);
    const found = objectIds.length ? await ideas.find({ _id: { $in: objectIds } }).toArray() : [];
    const ideaMap = Object.fromEntries(found.map((i) => [i._id.toString(), i]));

    res.json(
      mine.map((comment) => ({
        commentId: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        idea: ideaMap[comment.ideaId] ? presentIdea(ideaMap[comment.ideaId], req.user) : null,
        ideaId: comment.ideaId,
      }))
    );
  });

  app.post("/contact", async (req, res) => {
    const { data, errors, valid } = validateContact(req.body);
    if (!valid) return res.status(400).json({ message: "Validation failed", errors });
    await contacts.insertOne({ ...data, createdAt: new Date() });
    res.status(201).json({ message: "Message received" });
  });

  app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Invalid JSON body" });
    }
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
