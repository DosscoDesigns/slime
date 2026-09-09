import GuideShell from "@/components/GuideShell";
import { HERO_IMAGES } from "@/lib/photos";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Slime for Color Runs — A Better Alternative to Color Powder",
  description:
    "Using slime instead of color powder for a color run: how many stations you need, how much slime per runner, why it beats cornstarch powder, and how to set up a slime zone.",
  path: "/color-run-slime",
  image: HERO_IMAGES.field.src,
});

export default function ColorRunPage() {
  return (
    <GuideShell
      title="Slime for Color Runs — A Better Alternative to Color Powder"
      intro="Color powder blows away, gets in lungs, and photographs as a haze. Slime stays where it lands, shows up vividly on camera, and rinses off with water. If you are planning a color run, it is worth knowing the difference before you buy."
      hero={HERO_IMAGES.field}
      recommend={{
        gallons: 80,
        why: "Color runs are a volume event: multiple stations, a continuous stream of runners, and no chance to pause and mix more. Eighty gallons supports two to three stations for a field of about a hundred runners. Larger races usually order several kits and stage one per station.",
      }}
      related={[
        { name: "Running a youth group slime event", href: "/youth-group-slime-event" },
        { name: "How to make slime from powder", href: "/how-to-make-slime-from-powder" },
        { name: "Church slime fundraiser ideas", href: "/church-slime-fundraiser" },
      ]}
    >
      <h2>Slime versus color powder</h2>
      <p>
        Color powder is the default because it is what color runs started with,
        not because it is better. The practical differences:
      </p>
      <ul>
        <li>
          <strong>It stays put.</strong> Powder drifts on any breeze, which
          means you throw a lot of product at empty air and coat everything
          downwind — including spectators, parked cars, and the registration
          table.
        </li>
        <li>
          <strong>Nobody inhales it.</strong> Powder hangs in the air at exactly
          face height. Slime does not aerosolize, so runners with asthma are not
          making a calculation about whether to participate.
        </li>
        <li>
          <strong>It photographs better.</strong> Powder reads as a colored haze
          and washes out highlights. Slime is a saturated color on a person, and
          it stays on them for the rest of the race and the photos afterwards.
        </li>
        <li>
          <strong>It rinses with water.</strong> No colored dust in cars, in
          hair, and in every crevice of the venue for a week.
        </li>
      </ul>
      <p>
        The honest tradeoff: slime is wetter and heavier, so runners finish
        soaked rather than dusty, and you need a water source at the venue.
        For most events that is a fair trade. For a cold-weather race it is
        not — that is the one case where powder still wins.
      </p>

      <h2>How many stations, and how much slime</h2>
      <p>
        A color run works because runners hit several stations. One giant
        station is a queue; three small ones is an event.
      </p>
      <ul>
        <li>
          <strong>Per runner, per station:</strong> roughly a quarter to a half
          gallon. Volunteers with sprayers use dramatically less than volunteers
          with cups.
        </li>
        <li>
          <strong>A 5K with 3 stations and 100 runners:</strong> plan for 75 to
          150 gallons total. Most organizers land on two 80-gallon kits.
        </li>
        <li>
          <strong>A short fun-run with 2 stations and 50 runners:</strong> one
          80-gallon kit is comfortable.
        </li>
      </ul>
      <p>
        Mix per station rather than centrally. Carrying mixed slime across a
        course is how it ends up on the course.
      </p>

      <h2>Setting up a slime station</h2>
      <ul>
        <li>
          <strong>Pick a straight, visible stretch.</strong> Runners should see
          it coming and have room to spread out. A blind corner causes
          collisions.
        </li>
        <li>
          <strong>Two to four volunteers per station,</strong> on both sides of
          the lane so runners get hit from both directions rather than turning
          to face one side.
        </li>
        <li>
          <strong>Pump sprayers over cups.</strong> Better coverage, far less
          product per runner, and no one gets a half-gallon in the face.
        </li>
        <li>
          <strong>Keep the mixing bucket off the course.</strong> Behind the
          volunteers, not between them.
        </li>
        <li>
          <strong>Refill between waves,</strong> not during. Start each wave
          full.
        </li>
      </ul>

      <h3>Course surface</h3>
      <p>
        Grass is ideal. Asphalt is fine but gets slick, so keep stations off
        downhill sections and away from turns. Never put a station at the top of
        a descent — that is where a slip becomes an injury rather than a laugh.
      </p>

      <h2>Colors</h2>
      <p>
        The classic setup is one color per station, so runners accumulate the
        full spectrum by the finish. It photographs well and it gives each
        station its own identity for volunteers.
      </p>
      <p>
        Our kits come in red, green, blue and yellow, and you can split a single
        kit across all four at no extra cost — which is usually what a
        multi-station event wants from one order.
      </p>

      <h2>What to tell runners</h2>
      <ul>
        <li>
          White shirts show the color best. That is the whole tradition, and it
          is worth saying explicitly on the registration page.
        </li>
        <li>
          Wear clothes and shoes you do not mind sacrificing. Our slime washes
          out of most fabrics, but not all — and running shoes are the item
          people forget.
        </li>
        <li>
          Sunglasses or goggles if you would rather not get any near your eyes.
        </li>
        <li>
          Bring a towel and a change of clothes, plus a bag for the wet ones.
        </li>
        <li>
          Leave phones at the bag drop, or bag them. Every year someone
          does not.
        </li>
      </ul>

      <h2>Finish line and cleanup</h2>
      <p>
        Put a rinse station at the finish — a hose, a sprinkler, or a line of
        water buckets. It doubles as the best photo op of the day and it stops
        slime ending up in every car in the parking lot.
      </p>
      <p>
        Hose the course down before it dries. Wet slime rinses away completely;
        dried slime needs scrubbing. If your venue has a groundskeeper, tell
        them in advance what you are using and that it is water-soluble and
        non-toxic — the conversation goes much better before the event than
        after.
      </p>

      <h2>Permits and venue conversations</h2>
      <p>
        Most parks and schools will approve this readily once they understand it
        rinses with water and leaves no residue. Go in with specifics: what it
        is, that it is non-toxic, that you will hose the course, and where your
        water source is. Vague requests get vague refusals.
      </p>
      <p>
        If you need a written product description for a venue or insurer, email
        us and we will send one.
      </p>
    </GuideShell>
  );
}
