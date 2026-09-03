// Launch-event photo gallery. Files live in /public/photos and are
// pre-optimized WebP (EXIF stripped) — see TEMP/optimize-photos.py for the
// generator. Dimensions are baked in so the grid reserves space and the
// page doesn't shift as images load.

export interface GalleryPhoto {
  slug: string;
  w: number;
  h: number;
  alt: string;
}

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  { slug: "crew-sprayers", w: 620, h: 827, alt: "Two friends walking off the field covered in green slime, sprayers in hand" },
  { slug: "friends-green", w: 620, h: 827, alt: "A group mid-celebration, shirts soaked in green slime" },
  { slug: "guys-slimed", w: 620, h: 827, alt: "Two guys arm in arm, completely covered head to toe" },
  { slug: "duo-launcher", w: 620, h: 827, alt: "A pair holding a slime launcher between them" },
  { slug: "pool-refill", w: 620, h: 465, alt: "Refilling sprayers from the slime pool in the middle of the field" },
  { slug: "leader-slimed", w: 620, h: 827, alt: "A group leader taking the full bucket treatment" },
  { slug: "pair-sunset", w: 620, h: 827, alt: "Two friends posing at sunset after the slime war" },
  { slug: "two-friends", w: 620, h: 827, alt: "Two friends grinning through a coat of slime" },
  { slug: "mid-battle", w: 620, h: 827, alt: "The crowd mid-battle, slime flying everywhere" },
  { slug: "spray-arc", w: 620, h: 414, alt: "A sprayer arcing slime across the field" },
  { slug: "bucket-grin", w: 620, h: 414, alt: "Grinning through the mess with a fresh bucket" },
  { slug: "laughing-pair", w: 620, h: 414, alt: "Two friends doubled over laughing mid-fight" },
  { slug: "refill-run", w: 620, h: 414, alt: "Running back to the buckets for a refill" },
  { slug: "yellow-launcher", w: 620, h: 414, alt: "Taking aim with a yellow slime launcher" },
  { slug: "crowd-wide", w: 620, h: 414, alt: "The whole field going at once" },
  { slug: "group-shot", w: 620, h: 465, alt: "The entire group together at the end of the night" },
  { slug: "victory-pose", w: 620, h: 465, alt: "Victory pose after the last bucket" },
  { slug: "solo-walk", w: 620, h: 465, alt: "Walking off the field, thoroughly slimed" },
  { slug: "bucket-huddle", w: 620, h: 827, alt: "A huddle around the mixing bucket" },
  { slug: "smiles-crowd", w: 620, h: 827, alt: "All smiles in the middle of the crowd" },
  { slug: "mid-field", w: 620, h: 827, alt: "Standing in the middle of the field, covered" },
];
