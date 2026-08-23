# The Drop walkthrough — recording script

> Shooting script for the 90-second cut of PRD §22, *"The launch that starts
> losing sales"*. Beaam-only; the three-product version is §25 and is deferred.
>
> This exists because §22 lists eleven beats and no timings, no shot list and no
> words. That is a plan, not something you can sit down and record. Written
> 23 August 2026, unrecorded as of that date — and `/drop` says so on the page
> rather than showing a play button over a still frame.

## What the video has to do

One job: make the difference between *"the site is up"* and *"customers can
buy"* land in under two minutes, on a real application, without narration doing
the work a demonstration should.

If a viewer comes away able to repeat the sentence **"an uptime monitor would
have said Drop was online"** and knows why it is true, it worked.

## Before you record

- [ ] `pnpm db:reset` — Form/01 back to the canonical 38 of 100.
- [ ] `pnpm asset:seed` — the product file in the local bucket, so the download
      at beat 11 is real.
- [ ] Drop connected to Beaam, collecting, and green for at least an hour. A
      board that has been green for four minutes looks staged, because it is.
- [ ] Notifications arriving on the phone you will film.
- [ ] `/demo` secret set, and the payment-failure scenario tested once end to
      end, then reset. Discovering it does not fire while recording is how a
      ten-minute job becomes an afternoon.
- [ ] Browser at 1440×900, no bookmarks bar, no other tabs, clean profile.
- [ ] **Check the demo banner is visible.** PRD §26 makes it load-bearing: a
      recording of Drop without it is a recording of a store that looks real.

## Timings

Total 90 seconds. The detection wait is the honest part and the hardest to
edit — see the note after the table.

| # | Time | Shot | Words |
|---|---|---|---|
| 1 | 0:00–0:06 | Storefront, full screen. Slow scroll to the buy button. | "This is a real shop. It sells one thing — a set of icons, thirty-eight of a hundred gone." |
| 2 | 0:06–0:12 | Complete a purchase. Confirmation, then the email arriving. | "A purchase works. Payment, then the file, about four seconds." |
| 3 | 0:12–0:20 | Beaam's board for Drop. Every service green. | "Beaam is watching the stack behind it. Nothing needs anyone." |
| 4 | 0:20–0:26 | `/demo`, enable payment-failure. Cut on the click. | "Now I'm going to break the part nobody watches — the webhook that confirms a payment." |
| 5 | 0:26–0:36 | Three or four checkout attempts, fast. Each takes the money. | "Customers keep buying. The money arrives. Nothing is delivered." |
| 6 | 0:36–0:44 | **Split screen.** Left: storefront, 200, loading normally. Right: an uptime check, green. | "Every page still returns 200. An uptime monitor sees a perfect record." |
| 7 | 0:44–0:52 | Hold on the green uptime panel. Let it sit. Silence. | *(say nothing — this is the argument)* |
| 8 | 0:52–1:02 | The phone. Notification arrives, read it aloud. | "drop-checkout — checkout is failing. Stripe webhook signatures failing for eight minutes. Buyers are paying and getting an error." |
| 9 | 1:02–1:14 | The incident in Beaam: service, start time, Stripe evidence, affected purchases. | "The service, when it started, what it correlates with, and the one screen to open. No graph to interpret." |
| 10 | 1:14–1:22 | Disable the scenario. Resend from the dashboard. Queue drains. | "Fix the secret, resend the ones that stopped trying. Nothing was lost." |
| 11 | 1:22–1:30 | A real download completing. Then Beaam confirming recovery. | "An uptime monitor would have said Drop was online. Beaam noticed customers could no longer buy." |

## The thing that will go wrong

**Beat 8 is a real detection wait.** Beaam requires repeated evidence before it
alerts — that is the product working, and it means the notification will not
arrive on cue.

Do not fake it. Two honest options:

1. **Cut, with the cut visible.** A caption reading "8 minutes later" is fine
   and nobody minds. Trimming silently so it looks instant sells a detection
   speed the product does not claim, which would be the one dishonest frame in
   a video whose whole subject is honesty.
2. **Say the wait out loud** and keep it. "This took eight minutes, because it
   waits for the failure to repeat before it wakes anyone" is a *better* line
   than most monitoring marketing manages.

Prefer 2 if the pacing survives it.

## What not to do

- **No stock music, no speed-ramping, no zoom-punches.** The claim is calm
  competence. Editing that shouts undercuts it more than a plain recording ever
  could.
- **Do not hide the demo banner**, crop it out, or shoot around it.
- **Do not invent numbers on screen.** Whatever the dashboard says is what the
  video says. If revenue reads $87 because that is what three test purchases
  came to, it reads $87.
- **Do not re-record a beat to get a better alert.** If Beaam misses something,
  that is the finding, and it goes in the backlog rather than on the timeline.
- **Do not narrate over the notification.** Let it arrive.

## Where it goes when it exists

1. `/drop` — replaces the "not recorded yet" block. That block is written to be
   deleted.
2. `/demo` — above the four static frames, which then become the transcript.
3. The README here, and the repository's social preview.
4. `llms.txt` — as a link, with a one-line description of what it shows.

Update `DROP-MARKETING-INTEGRATION.md` step 6 in the same change, or the doc
will say "when there is something to record" after there is.
