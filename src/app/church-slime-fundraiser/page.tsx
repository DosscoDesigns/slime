import GuideShell from "@/components/GuideShell";
import { HERO_IMAGES } from "@/lib/photos";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Church Slime Fundraiser Ideas That Actually Raise Money",
  description:
    "Slime fundraiser ideas for churches: camp scholarship pushes, mission trip funding, slime-the-pastor challenges, and how much slime a church event really needs.",
  path: "/church-slime-fundraiser",
  image: HERO_IMAGES.youthGroup.src,
});

export default function ChurchFundraiserPage() {
  return (
    <GuideShell
      title="Church Slime Fundraiser Ideas That Actually Raise Money"
      intro="Slime fundraisers work in churches for a reason that has nothing to do with slime: they give the congregation a concrete, funny, visible reason to give to something specific. Here is how to run one well."
      hero={HERO_IMAGES.youthGroup}
      recommend={{
        gallons: 40,
        why: "Forty gallons covers the format most churches actually run — a handful of leaders slimed in front of the congregation, with enough left for the students who hit their goal. Go to eighty if the students are getting slimed too, which is usually where the night ends up anyway.",
      }}
      related={[
        { name: "Running a youth group slime event", href: "/youth-group-slime-event" },
        { name: "How to run a slime the teacher fundraiser", href: "/slime-the-teacher-fundraiser" },
        { name: "How to make slime from powder", href: "/how-to-make-slime-from-powder" },
      ]}
    >
      <h2>Pick the thing you are actually funding</h2>
      <p>
        This matters more than the mechanic. &quot;Give to the youth
        budget&quot; raises a fraction of what &quot;send eleven students to
        camp who otherwise cannot go&quot; raises. People give to a specific,
        countable outcome.
      </p>
      <p>The ones that work:</p>
      <ul>
        <li>
          <strong>Camp scholarships.</strong> Name the number of students. A
          thermometer with faces on it beats a thermometer with dollars on it.
        </li>
        <li>
          <strong>Mission trip funding.</strong> Especially effective because
          the students doing the fundraising are the ones going.
        </li>
        <li>
          <strong>A specific purchase.</strong> A van, a sound board, a week of
          VBS supplies. Concrete beats general every time.
        </li>
        <li>
          <strong>An outside cause.</strong> A local food pantry, a partner
          ministry. Slime is a good on-ramp for a congregation that gets asked
          for money often.
        </li>
      </ul>

      <h2>Four formats</h2>

      <h3>Slime the pastor (the reliable one)</h3>
      <p>
        Set a threshold. Hit it, and the pastor gets slimed in front of
        everyone. It works because the congregation gets to do something
        slightly irreverent to leadership with leadership&apos;s blessing, and
        that is genuinely fun for a room full of people.
      </p>
      <p>
        Two notes from experience. First, the pastor has to be actually
        willing — a good sport who commits sells it, and a reluctant one makes
        it uncomfortable. Second, set the threshold higher than you think. If
        you set it low you will hit it in a week and leave money on the table.
        Add tiers above it: youth pastor at $500, worship leader at $1,000,
        senior pastor at $2,500.
      </p>

      <h3>Student challenge</h3>
      <p>
        Every student who raises their own amount — say $150 toward their camp
        cost — earns the right to slime a leader. This one is quietly the best,
        because it makes the students the fundraisers rather than the
        beneficiaries, and that changes how they talk about it.
      </p>

      <h3>Slime night as the event itself</h3>
      <p>
        Charge admission ($10 to $15) to a slime night, and everyone gets
        slimed. Less of a fundraiser and more of an outreach event that pays for
        itself — which is often what you actually want. Students bring friends
        to a slime night who would never come to a service.
      </p>

      <h3>VBS or camp finale</h3>
      <p>
        Not a fundraiser at all, but worth mentioning because it is where a lot
        of churches use slime: the last night of camp or the last day of VBS,
        as the payoff for a week-long memory-verse or attendance challenge.
      </p>

      <h2>How much you need</h2>
      <p>
        One adult, thoroughly and visibly slimed, takes{" "}
        <strong>3 to 5 gallons</strong>. Plan from the number of people going in,
        not from the size of the crowd watching.
      </p>
      <ul>
        <li>
          <strong>One or two leaders, small group:</strong> 20 gallons.
        </li>
        <li>
          <strong>Several leaders in front of the congregation:</strong> 40
          gallons. Most common.
        </li>
        <li>
          <strong>Whole youth group getting slimed:</strong> 80 gallons.
        </li>
      </ul>

      <h2>Practical church-specific notes</h2>

      <h3>Do it outside</h3>
      <p>
        Church buildings have carpet, and carpet is the one surface that makes
        this genuinely annoying. Grass is ideal; a parking lot with a hose
        nearby is fine. If you must be inside, use a hard floor with tarps and a
        wide margin, and make people walk.
      </p>

      <h3>Get the announcement right</h3>
      <p>
        Announce it from the front, with the students present, at least two
        weeks out. Show a photo or video from a previous year if you have one.
        A bulletin insert alone will not do it — this is a fundraiser that runs
        on anticipation.
      </p>

      <h3>Permissions and comms</h3>
      <p>
        Send parents a note the week before: what to wear, bring a towel and a
        change of clothes, and a heads-up that photos will be taken. If your
        church has a media release policy, this is a good moment to check it is
        current.
      </p>

      <h3>Recruit a camera</h3>
      <p>
        The photos and video are worth as much as the money. They are what makes
        next year&apos;s campaign easy, what parents share, and what the students
        remember. Assign someone specifically — do not assume it will happen.
      </p>

      <h2>Timeline</h2>
      <ul>
        <li>
          <strong>3 weeks out:</strong> leadership approval, pick the cause and
          the number, recruit the volunteers going in. Order the slime.
        </li>
        <li>
          <strong>2 weeks out:</strong> announce from the front. Put up the
          tracker.
        </li>
        <li>
          <strong>1 week out:</strong> parent note, confirm the location, check
          the weather, assign the photographer.
        </li>
        <li>
          <strong>Day before:</strong> mix the slime, gather buckets and
          sprayers, stage everything.
        </li>
        <li>
          <strong>Day of:</strong> announce the total <em>before</em> the
          sliming. The number is the point.
        </li>
      </ul>

      <h2>Cleanup</h2>
      <p>
        Our slime rinses off skin with plain water and washes out of most
        fabrics in a normal wash — but not all, so nobody should get slimed in
        anything they care about. On grass, hose it and it is gone. The one rule
        that matters: <strong>rinse before it dries.</strong> Wet slime takes a
        hose; dried slime takes scrubbing.
      </p>
    </GuideShell>
  );
}
