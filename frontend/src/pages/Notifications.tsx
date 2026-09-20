import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Page, Spinner } from '../components/ui';
import { relativeDate } from '../engine/format';
import { api } from '../lib/api';
import type { NotificationList } from '../lib/types';

export default function Notifications() {
  const [data, setData] = useState<NotificationList | null>(null);
  const load = () => api<NotificationList>('/api/notifications').then(setData).catch(() => setData({ items: [], unread: 0 }));
  useEffect(() => {
    void load();
  }, []);

  const readAll = () => api<NotificationList>('/api/notifications/read-all', { method: 'POST' }).then(setData);
  const read = (id: string) => api<NotificationList>(`/api/notifications/${id}/read`, { method: 'POST' }).then(setData);

  return (
    <Page
      title="Notifications"
      subtitle={data ? `${data.unread} unread` : undefined}
      action={
        data && data.unread > 0 ? (
          <button className="btn-ghost text-xs" onClick={readAll}>
            <CheckCheck size={14} /> mark all read
          </button>
        ) : undefined
      }
    >
      {!data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <Empty title="Nothing yet" body="Payment confirmations, plan changes and reminders to record outcomes will appear here." />
      ) : (
        <ul className="space-y-2">
          {data.items.map((n) => (
            <li key={n.id} className={`card flex items-start gap-3 p-4 ${n.read_at ? 'opacity-70' : 'ring-1 ring-brand-400/40'}`}>
              <Bell size={16} className="mt-1 shrink-0 text-brand-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-slate-600 dark:text-ink-300">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{relativeDate(new Date(n.created_at).getTime())}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {n.link && (
                  <Link to={n.link} className="text-xs font-semibold text-brand-600 underline dark:text-brand-300" onClick={() => !n.read_at && read(n.id)}>
                    open
                  </Link>
                )}
                {!n.read_at && (
                  <button className="text-xs text-slate-500 underline" onClick={() => read(n.id)}>
                    mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
