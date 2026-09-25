import { ArrowLeft, Mail } from 'lucide-react';
import { Brand, IconButton } from './planner/ui';

export function SupportPage({
  onBack,
  onPrivacy,
  onDelete,
}: {
  onBack: () => void;
  onPrivacy: () => void;
  onDelete: () => void;
}) {
  return (
    <main className="account-page">
      <header>
        <Brand />
        <IconButton label="Back" onClick={onBack}>
          <ArrowLeft size={20} />
        </IconButton>
      </header>
      <section>
        <h1>Support</h1>
        <p>Weekdeck by Voyager</p>
        <h2>Contact</h2>
        <p>
          <a href="mailto:weekdeckdev@gmail.com" target="_blank" rel="noreferrer">
            weekdeckdev@gmail.com
          </a>
        </p>
        <div className="account-links">
          <a
            className="secondary"
            href="mailto:weekdeckdev@gmail.com"
            target="_blank"
            rel="noreferrer"
          >
            <Mail size={17} />
            Email support
          </a>
          <button className="text-button" onClick={onPrivacy}>
            Privacy
          </button>
          <button className="text-button" onClick={onDelete}>
            Delete account
          </button>
        </div>
      </section>
    </main>
  );
}
