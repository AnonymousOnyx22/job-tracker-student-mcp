# Changelog

## Unreleased

- `list_applications` now accepts an optional `sort` of `deadline` (nearest first, no deadline last), `company` or `id`. Without it the list stays in id order.
- `list_applications` now returns a `summary_counts` field with how many of the matching applications are in each stage (applied, interview, offer and rejected). The existing fields are unchanged.
- `update_application` now accepts optional `type` and `source`, so a wrong internship or job type or a wrong source can be fixed without deleting the application. An empty `source` clears it.
- `add_application` now returns a `warning` field when an application with the same company, role and deadline already exists. The new application is still saved.
- `delete_application` is now marked as destructive, so clients can ask for confirmation before it removes an application.

## 0.1.1

- Added optional `deadline_after` and `deadline_before` to `list_applications` to list applications due in a date range. Both dates are included.
- Added `delete_application` to remove a duplicate or mistaken application by id.
- Added `list_applications` to list applications with optional status and company filters to see ids without exporting a full report.
- Added an optional `query` to `list_applications` that searches role, notes and source text, for example referral or LinkedIn.
- Added `update_application` to change the deadline, notes, role or company of an existing application.

## 0.1.0

- First version of the job application tracker with add_application, update_status, list_upcoming and export_report.
- Applications are saved in one local JSON file, and JOB_TRACKER_FILE sets a different path if you want one.
- Reminders show up in list_upcoming as overdue, due today or due soon, with the number of days left.
