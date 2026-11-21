# Final mobile and manager testing review

This review compares the submitted Mobile and Manager Testing Results with the earlier build, fb69ffd, and records the changes for the BIT320 submission.

| Finding | Earlier build | Final release |
| --- | --- | --- |
| Notification dismissal and mark as read | Close, Escape, outside click and token refresh were in place. | Added collapsible Unread and Read groups, larger controls and feedback when marking an item as read. Checked that read status survives a reload and links open the right record. |
| Mobile layout | The header and employee roster already adapted to narrow screens. The new employee form already grouped personal, employment and contact fields. | Used labelled rows for leave, attendance and payroll history on narrow screens. Increased tap areas and dashboard text sizes. Chart values can be opened as text on touch devices. |
| Dashboard clutter and team links | The Manager dashboard already moved account details out of the summary and linked team numbers to filtered records. | Removed the duplicate Workspace shortcuts from every role. Staff can use Menu or the desktop sidebar. Account details remain in the account panel. |
| Employee directory | The Manager roster already omitted the Department column and showed assigned employees. | Added the assigned team departments in the heading. For managers with multiple team departments, the department filter lists their assigned departments. |
| Leave search and review | The employee picker and separate rejection form were in place. Managers could review their assigned staff's leave. | Added search by name, ID or employee number, and role or job title. Managers see their assigned team's dates and statuses. HR/Admin alone approve or reject, and enter a reason when rejecting. New requests link directly from the HR/Admin notification. |
| Attendance | Manager rows already omitted department text. The status filter already grouped half-day records. | Rechecked the grouped filter and added labelled mobile rows for attendance records. |
| Payroll | Managers could view permitted processed payroll. | Managers can create, add one-off items and calculate drafts for assigned staff. HR/Admin set salaries and recurring items, process the saved draft and record external payments. Processed records have read-only totals. |
| Payslips | Managers and employees already had no Back to Payroll link. | Payslips now queries finalized records only. Employees see their own processed records. Managers can see authorized finalized payslips, including their own. |
| Documents, onboarding and progress | Documents had scoped filters, onboarding had an employee picker, and the progress form had preset and custom titles. | Rechecked these entries and management boundaries. The Manager interface omits redundant role tags. |

## Workflow results for the README

- Leave begins with an employee request. HR or Admin reviews it. The saved approval or rejection appears on the employee's request and updates the team status the manager sees. Approval reduces the available balance. Rejection records the reason for the employee and HR/Admin.
- Payroll starts from the draft form. A manager can prepare and calculate the draft for assigned staff and give HR the payroll ID. HR opens that record, processes it, and records a classroom payment. The employee opens the finalized payslip and sees the payment date.
- Notifications moved into Unread and Read groups. Use Open to go to the related record. Use Menu for the main modules and View chart data for exact chart values.
- The two submitted README formats cover the hosted walkthrough and the seven fictional demo accounts. They give the same steps and permissions.

## Verification and deployment notes

- Rebuilt a fresh PostgreSQL database from all 13 migrations and ran the existing PHP checks. Verified seven demo logins and the affected workflow, scope, isolation and validation rules using synthetic records.
- The production frontend build passed. Login loads the application shell, and feature pages and dashboard charts load on demand.
- This release uses existing database tables and migrations. Payroll records payments made outside HRMS. The test environment used in-app notifications for the workflows.
