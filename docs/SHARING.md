# Schedule Sharing

Sharing uses the existing Firebase Authentication and Firestore setup, without
Cloud Functions, an email delivery service, or Cloudflare. Invitations appear
inside Weekdeck, not in the recipient's email inbox. Firebase sends verification
emails when requested. Normal Firebase free-tier quotas still apply.

## Experience

- Share is below the existing left-rail icons on desktop and in the bottom bar on phones.
- Both parties verify their email using Share > Send verification email, then
  Share > I have verified my email.
- The sender chooses the displayed week or all weeks. The recipient sees the
  sender's verified email and accepts or cancels the invitation.
- Accepted schedules appear below Share and stay read-only. Blocks, notes, day
  hours, and later edits are visible. Notification settings and presets are private.
- A week-only grant stays attached to that calendar week, not a rolling seven-day
  window. All-weeks grants cover past and future weeks until removed.
- Share lists outgoing and accepted incoming invitations with remove controls.
  Reinviting the same email replaces the previous grant and requires acceptance again.
- Shared calendars use the sender's recorded time zone. Device time-zone changes
  update schedule layout metadata when the owner's planner initializes or saves settings.

## Data and Authorization

`scheduleShares/{ownerUid}_{normalizedRecipientEmail}` contains:
owner UID and verified email, normalized recipient email, bound recipient UID,
pending/accepted/declined status, week/all scope, date and timestamp boundaries,
sender time zone, and server update time.

Incoming queries filter `recipientEmail`; outgoing queries filter `ownerUid`.
There is one grant per owner/recipient pair. No searchable public user directory.
Recipients can change only pending status, bind their own UID, and set server time.
They cannot change scope, dates, sender, or email. Accepted grants are bound to
both email and UID so a newly created account cannot inherit an older acceptance.
Senders cannot pre-accept an invitation. Either party can delete a grant.

Owner writes to `users/{uid}/blocks`, `days`, `templates`, and `settings/planner`
remain unchanged. Shared block reads require an accepted grant and constrain
`startAt` to the invited half-open interval for week-only grants. Day queries use
`documentId() in [seven dates]`; rules constrain those IDs to the invited week.
The shared view never subscribes to templates or private planner preferences.
Its block queries order by `startAt` and cap at 2,500 records.

`users/{uid}/settings/shared` is a minimal projection of `weekStart`, `dayHours`,
`timeZone`, and server update time. Initialization, sharing, and settings updates
write it. Notification preferences, theme, and account credentials are excluded.
No composite index is needed for these single-field queries.

Account deletion first locks the owner against new writes and shared reads, then
removes outgoing invitations, accepted incoming grants, pending invitations to a
verified current email, and shared layout metadata before deleting Auth identity.

## Checks and Limits

`npm run test:rules` includes the original owner-only tests and sharing tests for
verification, privacy, bounded reads, read-only access, identity forgery, scope
escalation, cancellation, re-invitation, deletion, and revocation.
`npm run test:sync` exercises two real emulator accounts through the browser UI.

Security Rules are a tested prototype, not an independent security certification.
Review them before broad distribution. Client-only invitations do not provide
server-enforced per-sender rate limiting; consider an authenticated rate-limited
invitation service before a large public rollout. Revocation prevents future reads,
but cannot retract information already viewed or saved by a recipient.
