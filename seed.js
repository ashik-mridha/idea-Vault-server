// Idempotent seed: `node seed.js` inserts or refreshes the starter ideas (matched by seedKey).
// It never touches ideas created by users.
require("./mongodb-dns");
require("dotenv").config();
const { MongoClient } = require("mongodb");

const unsplash = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
const SEED_AUTHOR = {
  authorEmail: "editorial@seed.ideavault.invalid",
  authorName: "IdeaVault Editorial",
  authorImage: "",
};

const ideas = [
  {
    seedKey: "bangla-tutor",
    title: "BanglaTutor: AI Homework Helper",
    category: "AI",
    sortDescription:
      "An AI tutor that explains school maths and science step by step in Bangla, so students are not stuck waiting for a private tutor.",
    description:
      "BanglaTutor lets students in classes 6 to 10 photograph a textbook problem and receive a worked, step-by-step explanation in Bangla. Each answer ends with a short practice question so the student has to apply the idea, not just copy it. Teachers get a weekly summary showing which topics the class struggled with most.",
    targetAudience: "Class 6-10 students and their parents",
    problemStatement:
      "Private tutoring is expensive and most good explanations online are in English, so many students cannot get help with a problem at the moment they are stuck.",
    proposedSolution:
      "Combine text recognition with a language model tuned on the national curriculum. Charge families a small monthly fee and offer a free tier of five questions a day.",
    tags: "AI, Education, Bangla, Mobile",
    estimatedBudget: 28000,
    priority: "High",
    imgUrl: unsplash("1518770660439-4636190af475"),
    daysAgo: 3,
  },
  {
    seedKey: "mindcheck",
    title: "MindCheck: Anonymous Wellbeing Check-ins",
    category: "Health",
    sortDescription:
      "A private weekly check-in that connects university students with Bangla-speaking counsellors before stress becomes a crisis.",
    description:
      "Students answer a five-question check-in each week. If their answers trend downward, the app suggests a short guided exercise and offers an anonymous chat with a trained counsellor. Universities receive only aggregate, anonymised trends so they can plan support services without seeing individual data.",
    targetAudience: "University students and campus counselling centres",
    problemStatement:
      "Many students do not seek help for stress or anxiety because of stigma and the cost of private therapy, and campus counselling centres cannot reach students who never walk in.",
    proposedSolution:
      "Offer anonymous check-ins and chat sessions with licensed counsellors, sold to universities as a per-student annual subscription.",
    tags: "Mental health, Students, Counselling",
    estimatedBudget: 35000,
    priority: "High",
    imgUrl: unsplash("1559757148-5c350d0d3c56"),
    daysAgo: 6,
  },
  {
    seedKey: "carecall",
    title: "CareCall: Medicine Reminders by Phone Call",
    category: "Health",
    sortDescription:
      "Automated voice calls in the patient's own language remind elderly people to take their medicine and alert family when a dose is missed.",
    description:
      "Many older people do not use smartphones, so app notifications never reach them. CareCall places a short voice call at the scheduled time. The patient presses 1 to confirm. If there is no confirmation after two attempts, a family member receives an SMS. A caregiver sets up the schedule once from a simple web page.",
    targetAudience: "Elderly patients and the family members who care for them",
    problemStatement:
      "Missed doses are a common cause of avoidable hospital visits for people with long-term conditions such as diabetes and high blood pressure, and families living abroad have no way to know if a parent has taken their medicine.",
    proposedSolution:
      "Use telephony APIs for voice calls and SMS, and charge families a small monthly subscription per patient.",
    tags: "Healthcare, Elderly, Voice, SMS",
    estimatedBudget: 12000,
    priority: "Medium",
    imgUrl: unsplash("1584515933487-779824d29309"),
    daysAgo: 9,
  },
  {
    seedKey: "rooftop-solar-share",
    title: "Rooftop Solar Share",
    category: "Environment",
    sortDescription:
      "Let residents of an apartment building co-fund one rooftop solar array and split the savings on their electricity bills.",
    description:
      "In most apartment buildings no single resident controls the roof, so rooftop solar never happens. Rooftop Solar Share handles the paperwork: it collects pledges from residents, sizes the system, hires a certified installer and tracks each household's share of the energy produced. Savings are credited to each resident's monthly bill.",
    targetAudience: "Apartment residents and building committees",
    problemStatement:
      "Solar panels cut electricity costs, but apartment dwellers cannot install them individually and building committees lack the time and expertise to organise a shared project.",
    proposedSolution:
      "Act as the project organiser between residents and installers, and earn a one-time coordination fee plus a small share of the long-term maintenance contract.",
    tags: "Solar, Energy, Community",
    estimatedBudget: 45000,
    priority: "Medium",
    imgUrl: unsplash("1509391366360-2e959784a276"),
    daysAgo: 12,
  },
  {
    seedKey: "bottle-back",
    title: "Bottle Back: Deposit Refunds for PET Bottles",
    category: "Environment",
    sortDescription:
      "Add a small refundable deposit to bottled drinks and pay it back instantly when a customer scans a QR code at a collection point.",
    description:
      "Plastic bottles are the easiest recyclable material to collect when people have a reason to return them. Bottle Back places collection bins at campuses and busy shops. Each bin has a QR code; scanning it credits the customer's mobile wallet with the deposit. Collected bottles are sold in bulk to recyclers.",
    targetAudience: "Beverage brands, campuses and neighbourhood shops",
    problemStatement:
      "Most PET bottles end up in drains and open dumps because nobody is paid to bring them back, and informal collectors only pick up bottles worth the effort of carrying.",
    proposedSolution:
      "Run a deposit-and-refund scheme funded by participating beverage brands, with revenue from the sale of sorted plastic to recycling mills.",
    tags: "Recycling, Plastic, Mobile wallet",
    estimatedBudget: 22000,
    priority: "Medium",
    imgUrl: unsplash("1532629345422-7515f3d16bb6"),
    daysAgo: 15,
  },
  {
    seedKey: "khata-mate",
    title: "Khata Mate: Digital Ledger for Neighbourhood Shops",
    category: "Finance",
    sortDescription:
      "A simple phone app that replaces the paper credit notebook of a small shop and reminds customers to settle their dues.",
    description:
      "Small shops sell on credit and record it in a paper khata that is easy to lose and hard to total. Khata Mate records each credit sale in two taps, shows who owes how much, and sends a polite payment reminder by SMS. Customers can settle through mobile wallets and the entry closes automatically.",
    targetAudience: "Owners of small grocery, pharmacy and tea shops",
    problemStatement:
      "Shop owners lose money to forgotten or disputed credit entries and spend evenings adding up the notebook by hand.",
    proposedSolution:
      "Offer the ledger free and earn a small fee on wallet payments that settle through the app, plus a paid plan with sales reports.",
    tags: "Fintech, Retail, SMS, Payments",
    estimatedBudget: 18000,
    priority: "High",
    imgUrl: unsplash("1556742049-0cfed4f6a45d"),
    daysAgo: 18,
  },
  {
    seedKey: "skill-swap-campus",
    title: "Skill Swap Campus",
    category: "Education",
    sortDescription:
      "A peer-to-peer marketplace where university students trade short tutoring sessions, from calculus to guitar to CV reviews.",
    description:
      "Students are good at different things and most of them cannot afford a tutor. Skill Swap Campus lets a student offer a one-hour session in a subject they know in exchange for credits, then spend the credits on a session they need. Ratings keep quality high and every session happens in a public campus space.",
    targetAudience: "Undergraduate students",
    problemStatement:
      "Paid tutoring is out of reach for many students, while capable classmates have spare time and no easy way to turn their knowledge into value.",
    proposedSolution:
      "Run a credit-based exchange per campus, with revenue from sponsored listings by coaching centres and a premium plan for exam-season bundles.",
    tags: "Students, Marketplace, Tutoring",
    estimatedBudget: 9000,
    priority: "Low",
    imgUrl: unsplash("1522202176988-66273c2fd55f"),
    daysAgo: 22,
  },
  {
    seedKey: "cold-chain-share",
    title: "Cold Chain Share",
    category: "Business",
    sortDescription:
      "Shared refrigerated transport that lets small fish and vegetable farmers get produce to the city market before it spoils.",
    description:
      "A refrigerated truck is too expensive for a single smallholder to run. Cold Chain Share pools orders from many farmers in the same area, fills one refrigerated vehicle on a fixed schedule and delivers to wholesale markets. Farmers pay per crate and track their consignment from a basic phone.",
    targetAudience: "Smallholder farmers, fish farmers and wholesale buyers",
    problemStatement:
      "A large share of fresh produce is lost between farm and market because of heat and slow transport, which cuts farmers' income.",
    proposedSolution:
      "Operate shared refrigerated routes on a pay-per-crate basis, and use the aggregated volume to negotiate better prices with fuel suppliers and market buyers.",
    tags: "Logistics, Agriculture, Cold storage",
    estimatedBudget: 42000,
    priority: "High",
    imgUrl: unsplash("1586528116311-ad8dd3c8310d"),
    daysAgo: 26,
  },
  {
    seedKey: "fixit-local",
    title: "FixIt Local: Verified Home Services",
    category: "Business",
    sortDescription:
      "Book background-checked cleaners, electricians and plumbers with a fixed price shown before the job starts.",
    description:
      "Finding a trustworthy tradesperson usually depends on a neighbour's recommendation, and prices are negotiated at the door. FixIt Local verifies each professional's identity and past work, shows a fixed price for common jobs up front and holds payment until the customer confirms the job is done.",
    targetAudience: "Urban households and the skilled tradespeople who serve them",
    problemStatement:
      "Households worry about safety and surprise charges, while skilled workers lose income because they have no reliable way to find steady customers.",
    proposedSolution:
      "Take a commission on each completed booking and offer professionals a low-cost tool kit and insurance plan as an optional upgrade.",
    tags: "Services, Marketplace, Trust",
    estimatedBudget: 30000,
    priority: "Medium",
    imgUrl: unsplash("1581578731548-c64695cc6952"),
    daysAgo: 30,
  },
  {
    seedKey: "soil-sense",
    title: "SoilSense: Low-Cost Soil Sensors with SMS Alerts",
    category: "Tech",
    sortDescription:
      "Inexpensive soil-moisture sensors that text farmers when it is time to irrigate, saving water and cutting guesswork.",
    description:
      "SoilSense is a solar-powered sensor pushed into the ground that measures moisture and temperature every hour and sends the reading over a low-power radio network. When the soil is too dry or too wet for the crop, the farmer receives a plain-language SMS. No smartphone or internet connection is needed on the farm.",
    targetAudience: "Small and medium vegetable and rice farmers",
    problemStatement:
      "Farmers irrigate by habit rather than by measurement, which wastes water and electricity or leaves crops under-watered at the wrong moment.",
    proposedSolution:
      "Sell the sensor at cost through agricultural cooperatives and charge a small seasonal fee for alerts and advice.",
    tags: "IoT, Agriculture, SMS, Hardware",
    estimatedBudget: 38000,
    priority: "Medium",
    imgUrl: unsplash("1530836369250-ef72a3f5cda8"),
    daysAgo: 34,
  },
  {
    seedKey: "sunrise-sessions",
    title: "Sunrise Sessions: Free Park Fitness Finder",
    category: "Lifestyle",
    sortDescription:
      "A map of free community yoga, walking and fitness sessions in local parks, run by volunteer instructors and open to everyone.",
    description:
      "Public parks are underused in the early morning, and many people would exercise more if they had company and a simple schedule. Sunrise Sessions lists nearby group sessions, lets instructors publish a weekly timetable and lets participants join with one tap. Local clinics and sports shops sponsor sessions in return for a mention.",
    targetAudience: "Adults who want a low-cost way to stay active, and volunteer instructors",
    problemStatement:
      "Gym memberships are expensive and exercising alone is hard to keep up, yet free group sessions are advertised only by word of mouth.",
    proposedSolution:
      "Build a free listing and booking map, funded by local sponsors and an optional paid tier for instructors who run larger groups.",
    tags: "Fitness, Community, Wellness",
    estimatedBudget: 7000,
    priority: "Low",
    imgUrl: unsplash("1544367567-0f2fcb009e0b"),
    daysAgo: 40,
  },
];

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI_STANDARD || process.env.MONGODB_URI);
  await client.connect();
  const collection = client.db("ideaVault").collection("ideas");
  const DAY = 24 * 60 * 60 * 1000;

  for (const { daysAgo, ...idea } of ideas) {
    await collection.updateOne(
      { seedKey: idea.seedKey },
      {
        $set: { ...idea, ...SEED_AUTHOR, updatedAt: new Date() },
        $setOnInsert: { likes: 0, createdAt: new Date(Date.now() - daysAgo * DAY) },
      },
      { upsert: true }
    );
  }

  console.log(`Seeded ${ideas.length} ideas (total in collection: ${await collection.countDocuments()})`);
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
