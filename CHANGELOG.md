# Changelog

## Unreleased

- Added `delete_application` to remove a duplicate or mistaken application by id.
- Added `list_applications` to list applications with optional status and company filters to see ids without exporting a full report.
- Added `update_application` to change the deadline, notes, role or company of an existing application.

## 0.1.0

- First version of the job application tracker with add_application, update_status, list_upcoming and export_report.
- Applications are saved in one local JSON file, and JOB_TRACKER_FILE sets a different path if you want one.
- Reminders show up in list_upcoming as overdue, due today or due soon, with the number of days left.
