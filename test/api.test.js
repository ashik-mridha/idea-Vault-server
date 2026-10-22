// Run with `npm test`. Talks to the database in MONGODB_URI and removes everything it creates.
// Firebase is replaced by a fake verifier that accepts tokens of the form "test:<email>".
require("../mongodb-dns");
require("dotenv").config();
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { MongoClient, ObjectId } = require("mongodb");
const { createApp } = require("../app");

const ALICE = "alice.test@ideavault.invalid";
const BOB = "bob.test@ideavault.invalid";

const validIdea = {
  title: "Test idea: neighbourhood tool library",
  sortDescription: "Borrow drills and ladders by the day instead of buying them.",
  description: "A neighbourhood tool library lets residents borrow rarely used tools for a small daily fee instead of buying them.",
  category: "Lifestyle",
  targetAudience: "Apartment residents",
  problemStatement: "People buy tools they use once a year and then store them for decades.",
  proposedSolution: "Run a shared inventory with a simple booking page and a refundable deposit.",
  estimatedBudget: "1500",
  priority: "Low",
};

let client;
let server;
let base;
let db;
const createdIdeaIds = [];

const api = (path, { token, body, method = body ? "POST" : "GET" } = {}) =>
  fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

before(async () => {
  client = new MongoClient(process.env.MONGODB_URI_STANDARD || process.env.MONGODB_URI);
  await client.connect();
  db = client.db("ideaVault");
  const verifyIdToken = async (token) => {
    if (!token.startsWith("test:")) throw new Error("bad token");
    const email = token.slice(5);
    return { uid: email, email, name: email.split("@")[0] };
  };
  const app = createApp({ db, verifyIdToken, clientOrigins: ["http://localhost:3000"] });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const id of createdIdeaIds) {
    await db.collection("ideas").deleteOne({ _id: new ObjectId(id) });
    await db.collection("comments").deleteMany({ ideaId: id });
  }
  await db.collection("contacts").deleteMany({ email: ALICE });
  await new Promise((resolve) => server.close(resolve));
  await client.close();
});

test("GET /ideas returns at least 6 items", async () => {
  const res = await api("/ideas");
  assert.equal(res.status, 200);
  assert.ok((await res.json()).length >= 6);
});

test("search, category, date and budget filters work", async () => {
  const bySearch = await (await api("/ideas?search=solar")).json();
  assert.ok(bySearch.length >= 1);
  assert.ok(bySearch.every((i) => /solar/i.test(i.title + i.sortDescription + (i.tags || ""))));

  const byCategory = await (await api("/ideas?category=Finance")).json();
  assert.ok(byCategory.length >= 1 && byCategory.every((i) => i.category === "Finance"));

  const future = await (await api("/ideas?startDate=2999-01-01")).json();
  assert.equal(future.length, 0);
  const past = await (await api("/ideas?endDate=2000-01-01")).json();
  assert.equal(past.length, 0);
  const all = await (await api("/ideas?startDate=2000-01-01&endDate=2999-12-31")).json();
  assert.ok(all.length >= 6);

  const cheap = await (await api("/ideas?maxBudget=10000")).json();
  assert.ok(cheap.length >= 1 && cheap.every((i) => Number(i.estimatedBudget || 0) <= 10000));

  const sorted = await (await api("/ideas?sort=budget-desc&limit=5")).json();
  const budgets = sorted.map((i) => Number(i.estimatedBudget) || 0);
  assert.deepEqual(budgets, [...budgets].sort((a, b) => b - a));
});

test("search treats regex characters literally", async () => {
  const res = await api("/ideas?search=" + encodeURIComponent("(.*"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("bad filters answer 400", async () => {
  assert.equal((await api("/ideas?startDate=not-a-date")).status, 400);
  assert.equal((await api("/ideas?minBudget=-5")).status, 400);
  assert.equal((await api("/ideas?sort=random")).status, 400);
});

test("GET /idea/:id is public; bad id 400; missing 404; related excludes itself", async () => {
  const list = await (await api("/ideas?category=Health")).json();
  const first = list[0];
  const ok = await api(`/idea/${first._id}`);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json())._id, first._id);
  assert.equal((await api("/idea/not-an-id")).status, 400);
  assert.equal((await api("/idea/000000000000000000000000")).status, 404);

  const related = await (await api(`/idea/${first._id}/related`)).json();
  assert.equal(related.length, 3);
  assert.ok(related.every((i) => i._id !== first._id));
  const sameFirst = related.map((i) => i.category === first.category);
  assert.ok(sameFirst[0], "same-category ideas come first");
  assert.deepEqual(sameFirst, [...sameFirst].sort((a, b) => b - a), "same-category ideas are listed before others");
});

test("GET /categories and /ideas/trending", async () => {
  const categories = await (await api("/categories")).json();
  assert.equal(categories.length, 8);
  assert.ok(categories.every((c) => typeof c.count === "number"));
  const trending = await (await api("/ideas/trending?limit=6")).json();
  assert.ok(trending.length >= 1 && trending.length <= 6);
});

test("POST /ideas: 401 without token, 401 with forged token, 400 invalid, 201 valid", async () => {
  assert.equal((await api("/ideas", { body: validIdea })).status, 401);

  const forged = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFsaWNlQHguY29tIn0.forged";
  assert.equal((await api("/ideas", { body: validIdea, token: forged })).status, 401);

  const invalid = await api("/ideas", { body: { ...validIdea, title: "ab", category: "Nope", imgUrl: "Hhhh" }, token: `test:${ALICE}` });
  assert.equal(invalid.status, 400);
  const { errors } = await invalid.json();
  assert.ok(errors.title && errors.category && errors.imgUrl);

  const res = await api("/ideas", {
    body: { ...validIdea, authorEmail: BOB, likes: 999 },
    token: `test:${ALICE}`,
  });
  assert.equal(res.status, 201);
  const { insertedId } = await res.json();
  createdIdeaIds.push(insertedId);

  const raw = await db.collection("ideas").findOne({ _id: new ObjectId(insertedId) });
  assert.equal(raw.authorEmail, ALICE, "client cannot choose the author");
  assert.equal(raw.likes, 0, "client cannot set likes");
  assert.equal(raw.estimatedBudget, 1500, "budget is stored as a number");

  const asAnonymous = await (await api(`/idea/${insertedId}`)).json();
  assert.equal(asAnonymous.authorEmail, undefined, "public responses hide author emails");
  assert.equal(asAnonymous.isOwner, false);
  const asOwner = await (await api(`/idea/${insertedId}`, { token: `test:${ALICE}` })).json();
  assert.equal(asOwner.isOwner, true);
  const asOther = await (await api(`/idea/${insertedId}`, { token: `test:${BOB}` })).json();
  assert.equal(asOther.isOwner, false);
});

test("DELETE: other user's item 403, own item 200, then 404", async () => {
  const created = await api("/ideas", { body: validIdea, token: `test:${ALICE}` });
  const { insertedId } = await created.json();
  createdIdeaIds.push(insertedId);

  assert.equal((await api(`/idea/${insertedId}`, { method: "DELETE", token: `test:${BOB}` })).status, 403);
  assert.equal((await api(`/idea/${insertedId}`, { method: "DELETE" })).status, 401);
  assert.equal((await api(`/idea/${insertedId}`, { method: "DELETE", token: `test:${ALICE}` })).status, 200);
  assert.equal((await api(`/idea/${insertedId}`)).status, 404);
});

test("PUT: only the owner can update, and updates are validated", async () => {
  const { insertedId } = await (await api("/ideas", { body: validIdea, token: `test:${ALICE}` })).json();
  createdIdeaIds.push(insertedId);

  assert.equal((await api(`/idea/${insertedId}`, { method: "PUT", body: { title: "Changed title" }, token: `test:${BOB}` })).status, 403);
  assert.equal((await api(`/idea/${insertedId}`, { method: "PUT", body: { title: "x" }, token: `test:${ALICE}` })).status, 400);
  assert.equal((await api(`/idea/${insertedId}`, { method: "PUT", body: { title: "Changed title", authorEmail: BOB }, token: `test:${ALICE}` })).status, 200);
  const stored = await db.collection("ideas").findOne({ _id: new ObjectId(insertedId) });
  assert.equal(stored.title, "Changed title");
  assert.equal(stored.authorEmail, ALICE);
});

test("comments: create, list, owner-only edit/delete, validation", async () => {
  const { insertedId: ideaId } = await (await api("/ideas", { body: validIdea, token: `test:${ALICE}` })).json();
  createdIdeaIds.push(ideaId);

  assert.equal((await api("/comment", { body: { ideaId, text: "Nice" } })).status, 401);
  assert.equal((await api("/comment", { body: { ideaId, text: "" }, token: `test:${BOB}` })).status, 400);
  assert.equal((await api("/comment", { body: { ideaId: "000000000000000000000000", text: "Hi" }, token: `test:${BOB}` })).status, 404);

  const created = await api("/comment", { body: { ideaId, text: "Useful idea" }, token: `test:${BOB}` });
  assert.equal(created.status, 201);
  const { insertedId: commentId } = await created.json();

  const listed = await (await api(`/comments/${ideaId}`, { token: `test:${BOB}` })).json();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].userEmail, undefined, "public responses hide commenter emails");
  assert.equal(listed[0].isOwner, true);
  assert.equal((await (await api(`/comments/${ideaId}`)).json())[0].isOwner, false);

  assert.equal((await api(`/comment/${commentId}`, { method: "PUT", body: { text: "Edited" }, token: `test:${ALICE}` })).status, 403);
  assert.equal((await api(`/comment/${commentId}`, { method: "PUT", body: { text: "Edited" }, token: `test:${BOB}` })).status, 200);
  assert.equal((await api(`/comment/${commentId}`, { method: "DELETE", token: `test:${ALICE}` })).status, 403);
  assert.equal((await api(`/comment/${commentId}`, { method: "DELETE", token: `test:${BOB}` })).status, 200);
});

test("old /auth/token endpoint no longer exists", async () => {
  const res = await api("/auth/token", { body: { email: ALICE } });
  assert.equal(res.status, 404);
});

test("POST /contact validates and stores", async () => {
  assert.equal((await api("/contact", { body: { name: "A", email: "bad", message: "short" } })).status, 400);
  const res = await api("/contact", { body: { name: "Alice Tester", email: ALICE, message: "Is there a mobile app planned?" } });
  assert.equal(res.status, 201);
});

test("CORS only allows listed origins", async () => {
  const allowed = await fetch(base + "/", { headers: { Origin: "http://localhost:3000" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:3000");
  const denied = await fetch(base + "/", { headers: { Origin: "https://evil.example" } });
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});
