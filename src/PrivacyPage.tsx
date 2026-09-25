import { ArrowLeft } from 'lucide-react';
import { Brand, IconButton } from './planner/ui';

export function PrivacyPage({ onBack, onDelete }: { onBack: () => void; onDelete: () => void }) {
  return (
    <main className="account-page legal-page">
      <header>
        <Brand />
        <IconButton label="Back" onClick={onBack}>
          <ArrowLeft size={20} />
        </IconButton>
      </header>
      <section>
        <h1>Privacy</h1>
        <p>Updated September 25, 2026</p>
        <h2>Your information</h2>
        <p>
          Weekdeck uses Firebase Authentication for your email address, account identifier, and
          password authentication. Your blocks, notes, presets, planning hours, and preferences are
          stored in Cloud Firestore so your signed-in devices can sync. Schedule data is stored in
          Los Angeles, United States. Firebase Authentication and service operations may process
          data in other locations.
        </p>
        <h2>How it is used</h2>
        <p>
          This information is used to operate your account, sync your planner, and provide the
          reminders you enable. Weekdeck does not include advertising, third-party tracking, or
          analytics SDKs. Firebase processes account and service information to operate and protect
          its services. Network services receive connection information such as IP addresses.
        </p>
        <h2>Schedule sharing</h2>
        <p>
          Sharing stores your email, the recipient's email, the selected week or all-weeks scope,
          and invitation status. After accepting, the verified recipient can read your blocks,
          notes, and planning hours in that scope and see live updates. They cannot edit them. You
          can stop sharing at any time. This stops future access but cannot erase information a
          recipient has already seen or saved. Account deletion removes your invitations and access.
        </p>
        <h2>On your devices</h2>
        <p>
          Sign-in information stays on your device until you sign out or remove app data. Schedules
          use an in-memory cache while signed in. Local preview schedules, when enabled, are saved
          only in that browser. The installed web app caches a public offline page and its icon, not
          your planner. Reminders require your permission. Their titles and block names may appear
          on your lock screen according to your device settings.
        </p>
        <h2>Background reminders</h2>
        <p>
          When enabled, Cloudflare processes your account identifier, device push subscription,
          timezone, reminder preferences, and upcoming reminder titles and times. Notes and
          passwords are not sent to Cloudflare. Your browser's push provider, such as Apple, Google,
          or Mozilla, delivers encrypted messages. These services may process data outside Los
          Angeles. Disabling a device or signing out stops its subscription. Inactive subscriptions
          expire after 90 days without reopening Weekdeck. Deleting your account also removes its
          reminder data. Provider backups may expire on their own schedules.
        </p>
        <h2>Retention and deletion</h2>
        <p>
          Your planner data is retained until you remove it or delete your account. Use Account,
          then Delete account, to remove your account and all its planner data. You can also sign in
          at the account-deletion page below without installing the app. If deletion is interrupted,
          sign in and finish it. A minimal record of the internal account identifier and deletion
          time is retained to prevent stale devices from recreating data. It contains no email or
          schedule content. Operational logs or backups held by service providers may expire on
          their own retention schedules.
        </p>
        <p>
          <button className="text-button" onClick={onDelete}>
            Delete your account
          </button>
        </p>
        <h2>Security</h2>
        <p>
          Connections to Firebase are encrypted in transit. Access rules restrict planner documents
          to the signed-in account and recipients you explicitly share with. No service can
          guarantee absolute security. Avoid placing sensitive personal information in block titles
          or notes.
        </p>
        <h2>Contact</h2>
        <p>
          Weekdeck is published by Voyager. For support and privacy requests, contact{' '}
          <a href="mailto:weekdeckdev@gmail.com" target="_blank" rel="noreferrer">
            weekdeckdev@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
