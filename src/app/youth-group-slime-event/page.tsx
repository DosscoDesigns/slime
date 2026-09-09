import GuideShell from "@/components/GuideShell";
import { HERO_IMAGES } from "@/lib/photos";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "How to Run a Youth Group Slime Event",
  description:
    "Games, setup, supplies and cleanup for a youth group slime night — including how much slime you need per student and the mistakes that ruin the night.",
  path: "/youth-group-slime-event",
  image: HERO_IMAGES.party.src,
});

export default function YouthGroupPage() {
  return (
    <GuideShell
      title="How to Run a Youth Group Slime Event"
      intro="A slime night is the rare youth event that needs no talent, no skill level, and no explanation. Everyone can participate and everyone ends up looking ridiculous, which is exactly the point. Here is how to run one that works."
      hero={HERO_IMAGES.party}
      recommend={{
        gallons: 80,
        why: "If students are getting slimed — not just watching leaders get slimed — eighty gallons is the size you want. It covers a group of 50 to 100 with enough for games, refills and the inevitable second round. For a group under 25, the 40 gallon kit is the better buy.",
      }}
      related={[
        { name: "Church slime fundraiser ideas", href: "/church-slime-fundraiser" },
        { name: "Slime for color runs and messy games", href: "/color-run-slime" },
        { name: "How to make slime from powder", href: "/how-to-make-slime-from-powder" },
      ]}
    >
      <h2>How much slime per student</h2>
      <p>
        The question everyone asks, and the one most people get wrong in both
        directions.
      </p>
      <ul>
        <li>
          <strong>Getting thoroughly slimed:</strong> about 1 gallon per person.
        </li>
        <li>
          <strong>Playing games with it:</strong> closer to 1.5 gallons per
          person, because a lot ends up on the ground.
        </li>
        <li>
          <strong>Watching leaders get slimed:</strong> 3 to 5 gallons per
          leader, and that is the whole budget.
        </li>
      </ul>
      <p>
        So: 30 students getting properly slimed is a 40-gallon night. 60 students
        with games is an 80-gallon night. Round up — running out halfway through
        is the one failure mode there is no recovering from.
      </p>

      <h2>Six games that actually work</h2>

      <h3>1. Slime the leader (the closer)</h3>
      <p>
        Save it for last. Students earn the right to slime a leader through
        whatever the night&apos;s competition was. It is the payoff, and putting
        it earlier deflates everything after it.
      </p>

      <h3>2. Sprayer tag</h3>
      <p>
        Pump sprayers, teams, open field. Simplest and best. Cheap to run
        because sprayers cover a lot of people with very little slime, and it
        scales to any group size.
      </p>

      <h3>3. Slime relay</h3>
      <p>
        Teams carry slime from a full bucket to an empty one — by cup, by hand,
        or on a spoon if you want it to take a while. First team to fill their
        bucket wins. Loud, funny, and the mess is contained to a lane.
      </p>

      <h3>4. Human sundae</h3>
      <p>
        One volunteer per team stands in a kiddie pool. Teams earn ingredients
        through minigames and build their leader into a sundae. Slow-burn, very
        photogenic, and it rewards the students who like planning over the ones
        who like running.
      </p>

      <h3>5. Slime limbo</h3>
      <p>
        A rope over a tarp, slime underneath. Nobody clears it. That is the
        joke.
      </p>

      <h3>6. Capture the flag, slimed</h3>
      <p>
        Standard rules, except tagging is done with a cup of slime. Works for
        large groups and burns an hour, which is often exactly what you need.
      </p>

      <h2>Setup</h2>

      <h3>Location</h3>
      <p>
        <strong>Grass, outdoors, near a hose.</strong> That is the whole answer.
        Grass drains, cushions falls, and rinses clean. A parking lot works but
        is harder on knees and elbows. Indoors is a last resort — hard floors
        plus slime is a genuine injury risk, and carpet is a two-hour cleanup.
      </p>
      <p>
        Mark a clear boundary. Slime outside the zone is slime someone slips on
        while walking to their car.
      </p>

      <h3>Stations you need</h3>
      <ul>
        <li>
          <strong>Mixing station</strong> — set up away from the play area, with
          a water source.
        </li>
        <li>
          <strong>Rinse station</strong> — a hose, or several buckets of clean
          water. Non-negotiable.
        </li>
        <li>
          <strong>Dry zone</strong> — where bags, phones and dry clothes live.
          Make it obvious and make it far from the action.
        </li>
      </ul>

      <h3>Supplies beyond the slime</h3>
      <ul>
        <li>Pump sprayers — the highest-value item on this list per dollar.</li>
        <li>Buckets, more than you think.</li>
        <li>Safety goggles, especially for younger students.</li>
        <li>A drill and a mixing paddle if you are mixing 80 gallons.</li>
        <li>Towels. Then more towels.</li>
        <li>Trash bags for wet clothes on the ride home.</li>
      </ul>

      <h2>Communication with parents</h2>
      <p>
        Send this a week out, not the night before:
      </p>
      <ul>
        <li>Wear clothes that can be ruined. Dark colors are safer.</li>
        <li>Bring a full change of clothes, a towel, and a plastic bag.</li>
        <li>Closed-toe shoes you do not care about.</li>
        <li>Leave phones and anything electronic in the dry zone.</li>
        <li>Photos will be taken — flag your media release if you have one.</li>
      </ul>
      <p>
        Contact lenses and slime are a bad combination. Mention goggles for
        anyone who wears them.
      </p>

      <h2>Safety, briefly but seriously</h2>
      <ul>
        <li>
          <strong>Walk, do not run.</strong> Say it out loud at the start and
          mean it. Wet grass plus running is how the night ends early.
        </li>
        <li>Nothing above the neck without goggles. No slime in faces.</li>
        <li>
          Keep a leader on the rinse station the whole time — slime in the eyes
          is uncomfortable, and someone who can hand over clean water
          immediately turns it into a non-event.
        </li>
        <li>Ask about allergies and skin sensitivities beforehand.</li>
      </ul>

      <h2>Cleanup</h2>
      <p>
        Rinse everything before it dries — that is the only rule that really
        matters. Wet slime hoses away; dried slime needs scrubbing. Hose the
        grass, hose the tarps, hose the students. Sprayers and buckets rinse out
        with plain water.
      </p>
      <p>
        Clothes go straight into a normal wash. Our slime is not a dye and comes
        out of most fabrics, but light-colored and delicate items can hold a
        tint, which is why the parent note says what it says.
      </p>

      <h2>Run of show</h2>
      <p>
        A slime night runs about 90 minutes of actual slime before energy drops.
        A shape that works:
      </p>
      <ul>
        <li><strong>0:00</strong> — welcome, rules, boundaries, walk-do-not-run.</li>
        <li><strong>0:10</strong> — a warm-up game while people commit to getting messy.</li>
        <li><strong>0:30</strong> — the big team game.</li>
        <li><strong>0:55</strong> — free-for-all with sprayers.</li>
        <li><strong>1:10</strong> — slime the leaders.</li>
        <li><strong>1:20</strong> — rinse, group photo, talk if you are giving one.</li>
      </ul>
      <p>
        Give the talk <em>after</em> the slime, not before. Nobody is listening
        while there is a full bucket in view.
      </p>
    </GuideShell>
  );
}
