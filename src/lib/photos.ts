// Launch-event photo gallery. Files live in /public/photos and are
// pre-optimized WebP (EXIF stripped) — see TEMP/optimize-photos.py for the
// generator. Dimensions are baked in so the grid reserves space and the
// page doesn't shift as tiles load.
//
// Alt text here was written against the full-size originals, not thumbnails.

export interface GalleryPhoto {
  slug: string;
  w: number;
  h: number;
  alt: string;
}

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    slug: "leader-slimed",
    w: 620,
    h: 827,
    alt: "A group leader standing in the field, shirt soaked purple and green, sprayer in hand",
  },
  {
    slug: "guys-slimed",
    w: 620,
    h: 827,
    alt: "Two guys arm in arm, shirts and shorts coated in green slime",
  },
  {
    slug: "laughing-pair",
    w: 620,
    h: 413,
    alt: "Two friends doubled over laughing, one aiming a green sprayer",
  },
  {
    slug: "victory-pose",
    w: 620,
    h: 465,
    alt: "Two friends posing together out on the field, sprayer in hand",
  },
  {
    slug: "group-shot",
    w: 620,
    h: 465,
    alt: "The whole group gathered on the field at sunset after the event",
  },
  {
    slug: "bucket-huddle",
    w: 620,
    h: 827,
    alt: "A huddle of kids reloading their sprayers from the slime pool",
  },
  {
    slug: "crew-sprayers",
    w: 620,
    h: 827,
    alt: "Two friends walking through the crowd with sprayers, covered in slime",
  },
  {
    slug: "mid-field",
    w: 620,
    h: 827,
    alt: "A kid standing in the middle of the field, arms up, thoroughly slimed",
  },
];

/**
 * Hero images for the guide pages. Dimensions are the real pixel sizes of the
 * files, carried so every render can reserve space — layout shift is a Core
 * Web Vitals input and therefore a ranking one. Alt text is written against
 * the full-size original, not the thumbnail.
 */
export interface HeroImage {
  src: string;
  srcSmall: string;
  width: number;
  height: number;
  alt: string;
}

export const HERO_IMAGES: Record<string, HeroImage> = {
  crowd: {
    src: "/photos/cta-crowd-1600.webp",
    srcSmall: "/photos/cta-crowd-900.webp",
    width: 1600,
    height: 1200,
    alt: "A packed crowd of students on a field, everyone drenched in bright green and purple slime",
  },
  joy: {
    src: "/photos/joy-1400.webp",
    srcSmall: "/photos/joy-800.webp",
    width: 1400,
    height: 935,
    alt: "A kid mid-laugh with slime running down their face and arms",
  },
  field: {
    src: "/photos/hero-field-1600.webp",
    srcSmall: "/photos/hero-field-900.webp",
    width: 1600,
    height: 1068,
    alt: "A wide open field covered in colorful slime during a large outdoor event",
  },
  youthGroup: {
    src: "/photos/youth-groups-1200.webp",
    srcSmall: "/photos/youth-groups-700.webp",
    width: 1200,
    height: 801,
    alt: "A youth group out on the field mid-event, everyone soaked in bright green and purple slime",
  },
  party: {
    src: "/photos/events-parties-1024.webp",
    srcSmall: "/photos/events-parties-700.webp",
    width: 1024,
    height: 768,
    alt: "A crowd at an outdoor party being covered in slime from pump sprayers",
  },
};
