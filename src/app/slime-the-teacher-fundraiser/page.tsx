import GuideShell from "@/components/GuideShell";
import { HERO_IMAGES } from "@/lib/photos";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "How to Run a Slime the Teacher Fundraiser",
  description:
    "A complete plan for a slime-the-teacher fundraiser: how to price it, how much slime you need, how to run the vote, and what to do about the mess. From a company that supplies the slime.",
  path: "/slime-the-teacher-fundraiser",
  image: HERO_IMAGES.crowd.src,
});

export default function SlimeTheTeacherPage() {
  return (
    <GuideShell
      title="How to Run a Slime the Teacher Fundraiser"
      intro="It is the single most reliable school fundraiser we see, because it sells a thing kids genuinely want and costs almost nothing to run. Here is the whole plan, including the parts people get wrong."
      hero={HERO_IMAGES.crowd}
      recommend={{
        gallons: 40,
        why: "Forty gallons is the sweet spot for a school assembly. It is enough to slime four to six adults thoroughly in front of a full gym, with slime left over for the kids who raised the most. Twenty gallons works for a single classroom or one teacher; eighty is for when the whole school participates outdoors.",
      }}
      related={[
        { name: "Church slime fundraiser ideas", href: "/church-slime-fundraiser" },
        { name: "Running a youth group slime event", href: "/youth-group-slime-event" },
        { name: "How to make slime from powder", href: "/how-to-make-slime-from-powder" },
      ]}
    >
      <h2>Why this one works</h2>
      <p>
        Most school fundraisers ask families to buy something they did not want
        — wrapping paper, coupon books, tubs of cookie dough. A slime-the-teacher
        fundraiser sells an <strong>outcome</strong> instead, and the outcome is
        one every kid in the building already wants to see. The margin is better
        too: your only real cost is the slime.
      </p>
      <p>
        The mechanic is simple. Students donate. The donations decide who gets
        slimed. At the end, in front of everyone, it happens.
      </p>

      <h2>Pick your voting mechanic</h2>
      <p>
        This is the decision that determines how much you raise, and it is worth
        five minutes of thought.
      </p>

      <h3>Penny wars (highest total, most work)</h3>
      <p>
        Each candidate teacher gets a jar. Coins count positive for that
        teacher, bills count negative. Classes sabotage each other, totals swing
        wildly in the last two days, and the whole school pays attention.
        Raises the most. Requires someone willing to count coins.
      </p>

      <h3>Straight vote (simplest)</h3>
      <p>
        A dollar is a vote. The teacher with the most votes gets slimed. Easy to
        run, easy to explain, and you can post a running leaderboard. Most
        schools should start here.
      </p>

      <h3>Threshold goal (best for a specific target)</h3>
      <p>
        &quot;If we raise $2,000, the principal gets slimed.&quot; This one is
        excellent when you have a number you actually need to hit, because it
        turns the whole school into one team instead of pitting classes against
        each other. It only works if the adult is genuinely popular enough that
        kids want it.
      </p>

      <h3>Tiered unlocks (most fun)</h3>
      <p>
        $500 slimes a teacher. $1,000 adds the vice principal. $2,000 and the
        principal goes in. Publish the ladder on day one and update it daily.
        You will beat your target more often than not, because each tier is a
        fresh reason to give again.
      </p>

      <h2>How much slime you actually need</h2>
      <p>
        People wildly overestimate this. A thorough, unmistakable, photograph-worthy
        sliming of one adult takes about <strong>3 to 5 gallons</strong>. Not
        thirty.
      </p>
      <ul>
        <li>
          <strong>One teacher, one classroom:</strong> 20 gallons is plenty, and
          leaves enough for a few kids to get in on it.
        </li>
        <li>
          <strong>Four to six adults at an assembly:</strong> 40 gallons. This
          is the most common school order by a wide margin.
        </li>
        <li>
          <strong>Whole-school outdoor event:</strong> 80 gallons, especially if
          students are getting slimed too rather than just watching.
        </li>
      </ul>
      <p>
        Buy slightly more than you think you need. Nobody has ever regretted
        having a spare bucket; plenty of people have regretted running out with
        the principal still dry and 400 kids watching.
      </p>

      <h2>Logistics, in the order you will need them</h2>

      <h3>Three weeks out</h3>
      <p>
        Get administration approval in writing, and be specific about where it
        will happen and who is being slimed. Pick your candidates — you want
        adults who will genuinely lean into it. A reluctant participant makes
        the whole thing awkward, and kids can tell.
      </p>
      <p>
        Order your slime now. Kits ship in 1–3 business days and take 5–7 in
        transit, so ordering two weeks out is comfortable and one week out is
        a gamble.
      </p>

      <h3>Two weeks out</h3>
      <p>
        Launch the campaign. Announce it in person, not just in a newsletter —
        the assembly announcement is what makes it real. Put a physical
        leaderboard somewhere everyone walks past.
      </p>

      <h3>The week of</h3>
      <p>
        Confirm your location. <strong>Outdoors on grass is the correct
        answer.</strong> A gym floor is slippery and someone will fall; a
        cafeteria means you are mopping for two hours. If weather forces you
        inside, use a tarp with a wide margin and make everyone walk, not run.
      </p>
      <p>
        Recruit a photographer. This event is 40% fundraiser and 60% content —
        the photos are what make next year&apos;s campaign easy to sell.
      </p>

      <h3>The day before</h3>
      <p>
        Mix the slime. It is ready in minutes, but doing it the night before
        means you are not stirring buckets while 400 kids file into a gym. Cover
        the containers and keep them out of direct sun.
      </p>
      <p>
        Tell your teachers what to wear: clothes they do not care about, and a
        change of clothes plus a towel in a bag. Warn them about light-colored
        fabric and white shoes.
      </p>

      <h3>The day</h3>
      <ul>
        <li>Set up a clear slime zone with a boundary kids stay behind.</li>
        <li>Have a hose or several buckets of clean water for rinsing.</li>
        <li>Announce the total <em>before</em> the sliming, not after — the number is the point, the slime is the reward.</li>
        <li>Count down. Do not just dump. The countdown is what the video needs.</li>
      </ul>

      <h2>The mess, honestly</h2>
      <p>
        Our slime rinses off skin with plain water and washes out of most
        fabrics in a normal wash. It is not a dye. But &quot;most&quot; is not
        &quot;all&quot; — light-colored and delicate fabrics can hold a tint, so
        do not let anyone get slimed in something they love.
      </p>
      <p>
        On grass, hose it down and it is gone. On concrete, hose it toward a
        drain. The thing to avoid is letting it dry on a surface, because dried
        slime takes real scrubbing while wet slime takes a hose.
      </p>

      <h2>What to charge</h2>
      <p>
        For a straight vote, $1 per vote is the standard and it works. Consider
        a $5 &quot;five votes&quot; option, because a lot of parents will hand
        over a five and not want change.
      </p>
      <p>
        If you are selling the right to <em>throw</em> the slime rather than
        just vote, that is worth far more — $20 to $25 for a top-three donor to
        be the one holding the bucket, and kids will absolutely compete for it.
      </p>

      <h2>Common mistakes</h2>
      <ul>
        <li>
          <strong>Ordering too late.</strong> The single most common one. Order
          two weeks out.
        </li>
        <li>
          <strong>Doing it indoors on a hard floor.</strong> Slippery, and the
          cleanup is genuinely miserable.
        </li>
        <li>
          <strong>Not announcing the total.</strong> The fundraiser is the
          story; the sliming is the payoff. Say the number out loud.
        </li>
        <li>
          <strong>Picking a reluctant teacher.</strong> Ask for volunteers
          first. There is always someone who wants it.
        </li>
        <li>
          <strong>No change of clothes.</strong> Every single time.
        </li>
      </ul>
    </GuideShell>
  );
}
