import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  documentId,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { ChevronLeft, ChevronRight, ArrowLeft, LockKeyhole } from 'lucide-react';
import { firebase } from '../firebase';
import { dayRange, shiftDate, type Block } from '../domain';
import {
  blockColor,
  clockLabel,
  dayConfig,
  emptyPlanner,
  weekDates,
  weekOf,
  type PlannerData,
  type SharedHours,
  type DayConfig,
} from './model';
import { validShareCalendar, type ScheduleShare } from './sharing';
import { IconButton, Modal } from './ui';

function zonedParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ms);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    day: `${value('year')}-${value('month')}-${value('day')}`,
    minute: Number(value('hour')) * 60 + Number(value('minute')),
  };
}
export function SharedSchedule({ share, onBack }: { share: ScheduleShare; onBack: () => void }) {
  const [anchor, setAnchor] = useState(() => zonedParts(Date.now(), share.timeZone).day);
  const [data, setData] = useState<PlannerData>(emptyPlanner);
  const [zone, setZone] = useState(share.timeZone);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => zonedParts(Date.now(), share.timeZone).day);
  const [detailId, setDetailId] = useState<string | null>(null);
  const week = share.scope === 'week' ? share.week : weekOf(anchor, data.preferences.weekStart);
  useEffect(() => {
    if (!firebase) return;
    setReady(false);
    setError('');
    setData((old) => ({ ...old, blocks: [], days: {} }));
    const loaded = new Set<string>();
    const mark = (key: string, cached: boolean) => {
      if (!cached) loaded.add(key);
      if (loaded.size === 3) setReady(true);
    };
    const fail = () => {
      setReady(false);
      setError(
        'This schedule is unavailable. Access may have been removed, or you may be offline.',
      );
    };
    const base = ['users', share.ownerUid] as const;
    const db = firebase.db;
    const unsubs = [
      onSnapshot(
        query(
          collection(db, ...base, 'blocks'),
          where(
            'startAt',
            '>=',
            share.scope === 'week' ? share.startAt : dayRange(shiftDate(week, -2))[0],
          ),
          where(
            'startAt',
            '<',
            share.scope === 'week' ? share.endAt : dayRange(shiftDate(week, 9))[0],
          ),
          orderBy('startAt'),
          limit(2500),
        ),
        { includeMetadataChanges: true },
        (snap) => {
          setData((old) => ({
            ...old,
            blocks: snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Block),
          }));
          mark('blocks', snap.metadata.fromCache);
        },
        fail,
      ),
      onSnapshot(
        query(collection(db, ...base, 'days'), where(documentId(), 'in', weekDates(week))),
        { includeMetadataChanges: true },
        (snap) => {
          setData((old) => ({
            ...old,
            days: Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as DayConfig])),
          }));
          mark('days', snap.metadata.fromCache);
        },
        fail,
      ),
      onSnapshot(
        doc(db, ...base, 'settings', 'shared'),
        { includeMetadataChanges: true },
        (snap) => {
          const settings = snap.data();
          if (settings) {
            setData((old) => ({
              ...old,
              preferences: {
                ...old.preferences,
                weekStart: settings.weekStart,
                dayHours: settings.dayHours as SharedHours | undefined,
              },
            }));
            setZone(
              share.scope === 'week' ||
                !validShareCalendar({ ...share, timeZone: settings.timeZone })
                ? share.timeZone
                : settings.timeZone,
            );
          }
          mark('settings', snap.metadata.fromCache);
        },
        fail,
      ),
    ];
    return () => unsubs.forEach((stop) => stop());
  }, [share.id, share.scope, share.startAt, share.endAt, share.ownerUid, share.timeZone, week]);
  const dates = weekDates(week).filter((d) => dayConfig(data, d).enabled);
  const active = dates.includes(selected) ? selected : dates[0];
  const blocks = data.blocks
    .map((b) => ({
      ...b,
      start: zonedParts(b.startAt, zone),
      end: zonedParts(b.endAt, zone),
    }))
    .filter((b) => dates.includes(b.start.day));
  const detail = blocks.find((b) => b.id === detailId);
  const start =
    Math.floor(
      Math.min(
        540,
        ...dates.map((d) => dayConfig(data, d).start),
        ...blocks.map((b) => b.start.minute),
      ) / 60,
    ) * 60;
  const end =
    Math.ceil(
      Math.max(
        1020,
        ...dates.map((d) => dayConfig(data, d).end),
        ...blocks.map((b) => (b.end.day === b.start.day ? b.end.minute : 1440)),
      ) / 60,
    ) * 60;
  return (
    <main className="planner-main shared-planner" aria-label="Shared schedule">
      <header className="planner-toolbar">
        <div className="shared-title">
          <IconButton label="Back to my schedule" onClick={onBack}>
            <ArrowLeft size={18} />
          </IconButton>
          <div>
            <h1>{share.ownerEmail}</h1>
            <span>
              <LockKeyhole size={12} />
              Read only
            </span>
          </div>
        </div>
        <div className="week-nav">
          <IconButton
            label="Previous shared week"
            disabled={share.scope === 'week'}
            onClick={() => setAnchor(shiftDate(week, -7))}
          >
            <ChevronLeft size={17} />
          </IconButton>
          <span>
            {week} - {shiftDate(week, 6)}
          </span>
          <IconButton
            label="Next shared week"
            disabled={share.scope === 'week'}
            onClick={() => setAnchor(shiftDate(week, 7))}
          >
            <ChevronRight size={17} />
          </IconButton>
        </div>
      </header>
      <nav className="mobile-days" aria-label="Shared schedule day">
        {dates.map((d) => (
          <button
            key={d}
            className={d === active ? 'active' : ''}
            aria-pressed={d === active}
            onClick={() => setSelected(d)}
          >
            <span>{new Date(`${d}T12:00`).toLocaleDateString([], { weekday: 'short' })}</span>
            <strong>{Number(d.slice(-2))}</strong>
          </button>
        ))}
      </nav>
      {error ? (
        <div className="empty-state" role="alert">
          {error}
        </div>
      ) : !ready ? (
        <div className="empty-state" role="status">
          Opening shared schedule...
        </div>
      ) : !dates.length ? (
        <div className="empty-state">No days planned this week.</div>
      ) : (
        <div className="shared-scroll">
          <div
            className="shared-grid"
            style={{ gridTemplateColumns: `56px repeat(${dates.length}, minmax(140px, 1fr))` }}
          >
            <div className="shared-time-axis">
              <div className="shared-day-heading" />
              <div style={{ height: (end - start) * 1.2 }}>
                {Array.from({ length: (end - start) / 60 + 1 }, (_, i) => (
                  <span key={i} style={{ top: i * 72 }}>
                    {clockLabel(start + i * 60)}
                  </span>
                ))}
              </div>
            </div>
            {dates.map((d) => (
              <section
                key={d}
                className={`shared-day ${d === active ? 'shared-day-active' : ''}`}
                aria-label={new Date(`${d}T12:00`).toLocaleDateString([], { weekday: 'long' })}
              >
                <header className="shared-day-heading">
                  <strong>
                    {new Date(`${d}T12:00`).toLocaleDateString([], {
                      weekday: 'short',
                      day: 'numeric',
                    })}
                  </strong>
                  <small>
                    {clockLabel(dayConfig(data, d).start)} - {clockLabel(dayConfig(data, d).end)}
                  </small>
                </header>
                <div className="shared-timeline" style={{ height: (end - start) * 1.2 }}>
                  {blocks
                    .filter((b) => b.start.day === d)
                    .map((b) => (
                      <button
                        type="button"
                        onClick={() => setDetailId(b.id)}
                        key={b.id}
                        className={`shared-block color-${blockColor(b)}`}
                        style={{
                          top: (b.start.minute - start) * 1.2,
                          height: Math.max(
                            18,
                            ((b.end.day === d ? b.end.minute : 1440) - b.start.minute) * 1.2,
                          ),
                        }}
                        title={`${b.title}\n${clockLabel(b.start.minute)} - ${clockLabel(b.end.minute)}${b.notes ? `\n${b.notes}` : ''}`}
                      >
                        <strong>{b.title}</strong>
                        <small>
                          {clockLabel(b.start.minute)} - {clockLabel(b.end.minute)}
                        </small>
                        {b.notes && <p>{b.notes}</p>}
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
      <footer className="planner-footer">
        <span>{zone.replaceAll('_', ' ')}</span>
      </footer>
      {ready && !error && detail && (
        <Modal title={detail.title} onClose={() => setDetailId(null)}>
          <div className="sharing-body">
            <p>
              {detail.start.day} · {clockLabel(detail.start.minute)} -{' '}
              {clockLabel(detail.end.minute)}
            </p>
            {detail.notes && <p className="shared-notes">{detail.notes}</p>}
            <small>Read only</small>
          </div>
        </Modal>
      )}
    </main>
  );
}
