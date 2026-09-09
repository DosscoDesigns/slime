import GuideShell from "@/components/GuideShell";
import { HERO_IMAGES } from "@/lib/photos";
import { pageMetadata } from "@/lib/site";

/**
 * The how-to page.
 *
 * TWO DELIBERATE OMISSIONS, both of which look like gaps and are not:
 *
 * 1. NO MIXING RATIOS OR MEASUREMENTS ANYWHERE. The formula is proprietary
 *    (CLAUDE.md), and the mixing instructions ship with the kit. This page
 *    explains the process, the failure modes and the planning — everything a
 *    buyer needs to decide — without publishing numbers.
 *
 * 2. No HowTo JSON-LD. Google retired HowTo rich results in 2023, the same
 *    reason StructuredData.tsx deliberately omits FAQPage. Emitting it would
 *    be inert weight on the page.
 */

export const metadata = pageMetadata({
  title: "How to Make Slime from Powder — Just Add Water",
  description:
    "How slime powder works, how to mix it for an event, how long mixed slime keeps, and how to fix slime that came out too thin or too thick.",
  path: "/how-to-make-slime-from-powder",
  image: HERO_IMAGES.joy.src,
});

export default function HowToPage() {
  return (
    <GuideShell
      title="How to Make Slime from Powder"
      intro="Powder slime exists because making event-quantity slime the DIY way is miserable — an afternoon, a folding-table mixing station, and gallons of craft glue you have to buy first. Add water instead, and wait a few minutes."
      hero={HERO_IMAGES.joy}
      recommend={{
        gallons: 40,
        why: "If you are still deciding, forty gallons is the size most groups land on: enough for a real event without being the amount you are still working through at the end of the night. Every kit mixes the same way — the only difference is how much water you are adding it to.",
      }}
      related={[
        { name: "Running a youth group slime event", href: "/youth-group-slime-event" },
        { name: "How to run a slime the teacher fundraiser", href: "/slime-the-teacher-fundraiser" },
        { name: "Slime for color runs", href: "/color-run-slime" },
      ]}
    >
      <h2>Why a small pouch makes so much</h2>
      <p>
        The number sounds implausible until you realise what the slime is mostly
        made of. A pouch that fits in one hand makes twenty gallons because
        almost all of the finished slime is <strong>the water you already
        have</strong> — the powder&apos;s job is to turn that water into a
        thick, stretchy gel and color it.
      </p>
      <p>
        That is also why shipping is cheap and storage is easy: until you add
        water, an eighty-gallon event fits in a box on your doorstep.
      </p>
      <p>
        Our formulation is proprietary, and the mixing instructions come printed
        with your kit. What follows is everything else — the part nobody prints
        on a card.
      </p>

      <h2>The process, start to finish</h2>

      <h3>1. Set up away from the action</h3>
      <p>
        Mix somewhere with a water source and a drain, not in the middle of the
        space where the event happens. You will spill, and you would rather
        spill on concrete near a hose than on the grass you are about to fill
        with people.
      </p>

      <h3>2. Water first, powder second</h3>
      <p>
        Always. Adding water to powder produces lumps — a gelled outer shell
        forms around dry powder and the middle never hydrates. Adding powder to
        water, gradually, while stirring, gives you an even mix.
      </p>

      <h3>3. Stir while you add</h3>
      <p>
        For small batches a paint stick and a five-gallon bucket is fine. For
        forty gallons and up, use a drill with a mixing paddle — it is the
        difference between a two-minute job and a twenty-minute one, and it is
        the single best accessory purchase for a large event.
      </p>

      <h3>4. Wait</h3>
      <p>
        This is where people go wrong. The mixture looks thin at first and stays
        thin for a few minutes while the powder takes up water. Judge the
        result after it has had time to sit, not while you are still stirring.
        Adding more powder because &quot;it looks watery&quot; is the most
        common mistake there is.
      </p>

      <h3>5. Check the texture and adjust</h3>
      <p>
        Too thin, add powder a little at a time and wait between additions. Too
        thick, add water and stir. Both directions are recoverable, which is the
        nice thing about powder — you are never committed.
      </p>

      <h2>Warm water, cold water, hose water</h2>
      <p>
        Room-temperature water is ideal. Cold water — straight from a hose in
        early spring — works but hydrates noticeably slower, so give it longer
        before deciding it has failed. Very hot water is not necessary and does
        not improve anything.
      </p>
      <p>
        Hard water and heavily chlorinated water both work. Pool water is not
        recommended; the chemistry is unpredictable and it is not worth
        troubleshooting on event day.
      </p>

      <h2>How far ahead can you mix?</h2>
      <p>
        <strong>The night before is ideal.</strong> Mixed slime holds its
        texture well overnight in covered containers, and mixing the day before
        means you are not stirring buckets while a crowd is arriving — which is
        the actual reason to do it, more than any property of the slime.
      </p>
      <ul>
        <li>
          <strong>Keep it covered.</strong> Uncovered slime skins over on top as
          surface water evaporates. A lid or a trash bag over the bucket solves
          it.
        </li>
        <li>
          <strong>Keep it out of direct sun.</strong> Heat thickens it and can
          fade the color. Shade or indoors.
        </li>
        <li>
          <strong>Do not refrigerate.</strong> Unnecessary, and cold slime is
          genuinely unpleasant to be hit with.
        </li>
      </ul>
      <p>
        Beyond a day or two it starts to separate. Mixing more than 48 hours
        ahead is not worth it — mix the day before and you have all the benefit
        with none of the risk.
      </p>

      <h2>Troubleshooting</h2>

      <h3>It came out lumpy</h3>
      <p>
        Powder went in too fast, or water went into powder instead of the other
        way round. Keep stirring — most lumps break down with time and
        agitation. A drill paddle fixes it quickly.
      </p>

      <h3>It is too thin and more powder is not helping</h3>
      <p>
        Almost always impatience. Give it another ten minutes before adding
        anything. Cold water in particular takes longer than people expect.
      </p>

      <h3>It is too thick to pour</h3>
      <p>
        Add water and stir it through. Thick slime is easy to fix and much
        better than the alternative — you can always dilute, and you cannot
        un-dilute without more powder.
      </p>

      <h3>The color is weaker than expected</h3>
      <p>
        Usually means the batch is thinner than intended, which spreads the same
        color through more volume. Thicken it and the color comes back.
      </p>

      <h2>Containers and gear</h2>
      <ul>
        <li>
          <strong>Five-gallon buckets.</strong> The default. Easy to carry, easy
          to pour, easy to source locally — which is why we do not ship them:
          eight nested pails cost more in shipping than the slime does, and your
          hardware store has them.
        </li>
        <li>
          <strong>Kiddie pools.</strong> Excellent for games and for the human
          sundae. Terrible for carrying anywhere.
        </li>
        <li>
          <strong>Pump sprayers.</strong> The highest-value accessory per dollar
          for any event with a crowd. Enormous coverage from very little slime.
        </li>
        <li>
          <strong>A drill and mixing paddle.</strong> Worth it at forty gallons,
          essential at eighty.
        </li>
        <li>
          <strong>Goggles.</strong> Especially for younger kids and anyone in
          contact lenses.
        </li>
      </ul>

      <h2>Cleanup</h2>
      <p>
        Rinse everything with plain water before it dries. That is the only rule
        that really matters — wet slime hoses away completely, dried slime needs
        scrubbing.
      </p>
      <p>
        Off skin: water. Off grass: a hose, and it is gone. Off clothes: a normal
        wash. Our slime is not a dye and comes out of most fabrics, but
        light-colored and delicate items can hold a tint, so nobody should get
        slimed in something they care about.
      </p>

      <h2>Is it safe?</h2>
      <p>
        Non-toxic and safe when used as directed. It is still a large volume of
        slippery liquid, so the real safety considerations are physical rather
        than chemical: keep it out of eyes, use it outdoors on a surface that
        can get wet, and make people walk rather than run. Adult supervision for
        children under 12, and goggles for the younger end of that.
      </p>
    </GuideShell>
  );
}
