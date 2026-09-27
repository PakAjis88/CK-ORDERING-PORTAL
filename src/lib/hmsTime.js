// HMS deadline/status logic — always Malaysia time (Asia/Kuala_Lumpur), which
// is a fixed UTC+8 with no DST, so a plain offset is correct and needs no
// timezone library. Pure functions, no React, no Supabase.

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000
const DEADLINE_HOUR_UTC = 9 // 16:59:59 MYT == 08:59:59 UTC; the cutoff instant is 09:00:00 UTC

// 'YYYY-MM-DD' for "now" as a Malaysia calendar date.
export function todayMYT(now = new Date()) {
  return new Date(now.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10)
}

// The UTC instant of 17:00:00 MYT (start of "late") on a given work date.
export function deadlineUtc(workDate) {
  return new Date(`${workDate}T${String(DEADLINE_HOUR_UTC).padStart(2, '0')}:00:00.000Z`)
}

export function isWeekend(workDate) {
  const day = new Date(`${workDate}T00:00:00Z`).getUTCDay() // 0=Sun, 6=Sat
  return day === 0 || day === 6
}

export function isWorkingDay(workDate, holidays) {
  return !isWeekend(workDate) && !holidays.has(workDate)
}

// submission: { submitted_at } or null/undefined if nothing submitted yet.
// holidays: a Set of 'YYYY-MM-DD' strings.
export function hmsStatus(submission, workDate, holidays, now = new Date()) {
  if (isWeekend(workDate)) return 'weekend'
  if (holidays.has(workDate)) return 'holiday'

  if (submission) {
    const submittedAt = new Date(submission.submitted_at)
    return submittedAt < deadlineUtc(workDate) ? 'on_time' : 'late'
  }

  // No submission yet. Only a strictly earlier Malaysia calendar day counts
  // as missed — same-day, even past the deadline, is still "pending" since a
  // late submission can still land before midnight.
  return workDate < todayMYT(now) ? 'missed' : 'pending'
}
