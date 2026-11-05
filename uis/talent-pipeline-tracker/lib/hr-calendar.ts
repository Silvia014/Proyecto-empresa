const eventTypes = ["absence", "holiday_request", "bank_holiday"] as const;
const eventStatuses = ["pending", "approved", "rejected"] as const;
const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function validateHrCalendarEntry(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const eventType = typeof body.event_type === "string" ? body.event_type : "";
  const startDate = typeof body.start_date === "string" ? body.start_date : "";
  const endDate = typeof body.end_date === "string" ? body.end_date : "";
  const status = typeof body.status === "string" ? body.status : "pending";
  const employeeName = typeof body.employee_name === "string" ? body.employee_name.trim() : "";
  const locationId = typeof body.location_id === "string" && body.location_id.trim() ? body.location_id : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!title || title.length > 120) return { error: "Enter a title of up to 120 characters.", value: null };
  if (!eventTypes.includes(eventType as (typeof eventTypes)[number])) return { error: "Choose a valid calendar entry type.", value: null };
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate) || endDate < startDate) {
    return { error: "Choose valid dates and make sure the end date is not before the start date.", value: null };
  }
  if (!eventStatuses.includes(status as (typeof eventStatuses)[number])) return { error: "Choose a valid request status.", value: null };
  if (employeeName.length > 120 || notes.length > 500 || (locationId && locationId.length > 120)) return { error: "Staff name, location, or notes exceed the allowed length.", value: null };
  return {
    error: null,
    value: {
      title,
      event_type: eventType,
      employee_name: employeeName || null,
      location_id: locationId,
      start_date: startDate,
      end_date: endDate,
      status: eventType === "bank_holiday" ? "approved" : status,
      notes: notes || null,
    },
  };
}
