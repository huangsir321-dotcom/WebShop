import { z } from "zod";

/* The storefront home page is a single editable row (id 1) in the database.
   The defaults below are what the API answers with when the row has not
   been created yet, and what "Restore defaults" puts back. */
export const HOMEPAGE_DEFAULTS = {
  id: 1,
  heroImageUrl: "/images/hero.jpg",
  heroEyebrow: "THE EVERYDAY EDIT · WORLDWIDE",
  heroTitle1: "Find your",
  heroTitle2: "everyday form.",
  heroBody: "Considered clothing, shoes and accessories. Designed for real life, wherever it takes you.",
  heroLabel1: "NEW SEASON",
  heroLabel2: "COLLECTION 01 / 26",
  storyImageUrl: "/images/story.jpg",
  storyEyebrow: "OUR PHILOSOPHY",
  storyTitle1: "Fewer things.",
  storyTitle2: "Better chosen.",
  storyBody: "FORME is a modern everyday wardrobe built around thoughtful design, tactile materials and timeless forms. Wear it your way, season after season.",
};

/* An image is either a remote http(s) URL or a local path served out of
   public/. z.string().url() is deliberately not used: `new URL()` also
   accepts "javascript:" and "C:/Windows/win.ini". */
const imagePath = z.union([
  z.literal(""),
  z.string().max(2048).refine(
    v => /^https?:\/\//i.test(v) || (v.startsWith("/") && !v.split("/").includes("..")),
    { message: "must be an http(s) URL or a local path such as /images/photo.jpg" }
  ),
]);

export const homepageInput = z.object({
  heroImageUrl: imagePath,
  heroEyebrow: z.string().max(120),
  heroTitle1: z.string().max(120),
  heroTitle2: z.string().max(120),
  heroBody: z.string().max(1000),
  heroLabel1: z.string().max(120),
  heroLabel2: z.string().max(120),
  storyImageUrl: imagePath,
  storyEyebrow: z.string().max(120),
  storyTitle1: z.string().max(120),
  storyTitle2: z.string().max(120),
  storyBody: z.string().max(1000),
});

export const readHomepage = async db =>
  (await db.homepage.findUnique({ where: { id: 1 } })) || HOMEPAGE_DEFAULTS;

export const writeHomepage = async (db, data) =>
  db.homepage.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

export const resetHomepage = async db => {
  const { id: _id, ...defaults } = HOMEPAGE_DEFAULTS;
  return db.homepage.upsert({ where: { id: 1 }, update: defaults, create: { id: 1, ...defaults } });
};
