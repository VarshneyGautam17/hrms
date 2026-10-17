import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { addHoliday, deleteHoliday } from '../../db/repositories/holidays';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatDisplayDate, todayISO } from '../../utils/dates';

export function CalendarPage() {
  const holidays = useLiveQuery(() => db.holidays.orderBy('date').toArray(), []);
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState('');
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date || !name.trim()) {
      setError('Date and holiday name are required.');
      return;
    }
    try {
      await addHoliday({ date, name: name.trim(), paid });
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add holiday.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Holidays</h1>
        <p className="text-sm text-slate-500">
          Company-wide holidays apply to all employees. Weekly off days are configured in Settings.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Holiday Name" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Paid holiday
        </label>
        <Button type="submit">Add Holiday</Button>
        {error && (
          <p className="w-full text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>

      {!holidays || holidays.length === 0 ? (
        <EmptyState title="No holidays configured yet" description="Add your first company holiday above." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Date</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-2">{formatDisplayDate(h.date)}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{h.name}</td>
                  <td className="px-4 py-2">
                    <Badge tone={h.paid ? 'success' : 'default'}>{h.paid ? 'Paid' : 'Unpaid'}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <button className="text-sm text-red-600 hover:underline" onClick={() => setPendingDelete(h.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove holiday"
        description="This will remove the holiday. Attendance already recorded on this date will not be deleted."
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteHoliday(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
