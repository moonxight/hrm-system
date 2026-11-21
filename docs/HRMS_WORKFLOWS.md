# HRMS payment and onboarding workflows

The reference is [pbrong/hrms](https://github.com/pbrong/hrms). Its staff intake, salary accounts and salary history informed the workflows below. The folder's README describes the project as a learning reference and asks for attribution. The PHP, React and PostgreSQL implementation here is original.

| Reference term | English meaning | How this HRMS handles it |
| --- | --- | --- |
| ???? | Salary setup | Approved salary periods and recurring components determine the starting amounts for a draft. |
| ?????? | Salary disbursement management | Admin or HR finalizes payroll, then records a completed external payment with its date, method and reference. |
| ???? | Salary history | Employees see finalized payslips and their recorded payment dates. |
| ????? and ???? | Candidate management and employment start date | Admin or HR can turn an offer into an employee record and create a checklist using the employee's start date. |
| ???? | Attendance reporting | Payroll stores an attendance snapshot at processing time. The snapshot records hours and leave for review. |
| ???? and ???? | Departments and positions | A hire inherits the department and position from their vacancy. |
| ???? | Role-based access | Admin and HR control salary, recurring components, payroll finalization and payments. Managers prepare drafts for assigned staff. Employees see their own finalized records. |

## Record a payroll payment

1. Admin, HR or the employee's assigned manager opens Payroll and creates a draft. The employee needs a salary that covers the pay period. The draft uses recurring components in effect on the period's last day. The person preparing the draft can add one-off allowances and deductions and calculate the totals.
2. Admin or HR selects the same record in Payroll history and processes it. HRMS recalculates the totals, captures the attendance snapshot and makes the finalized record available in Payslips.
3. After payment is completed outside HRMS, Admin or HR records the payment date, method and receipt or transaction reference. HRMS uses the finalized net salary and currency, and logs who recorded it.
4. The employee sees the recorded date on their payslip. The receipt reference is visible to Admin and HR. The system creates an in-app alert for the employee.

`payroll_payments.payroll_id` is the primary key and points to the payroll record. One finalized payroll can have one full payment record. Retrying the same submission returns that record. A different submission for the same payroll returns a conflict. Some older records have a processing date in `payroll.payment_date`. Payment status now comes from the separate payment record.

## Review a leave request

1. An employee uses Request leave to enter a leave type and dates. The saved request opens with Pending status and HR/Admin receive a notification linked to it.
2. HR or Admin opens the request from Notifications or filters the Leave list by name, employee ID or number, role or job title, status or year.
3. The reviewer approves the request or enters a rejection reason and confirms rejection. The request opens with the saved decision. Approval updates the employee's balance. The employee receives a notification linked to the result.
4. Managers view request details such as dates and status for their assigned employees. The team view hides private reasons and the decision controls.

## Hire an applicant and begin onboarding

1. Admin or HR opens Employee Directory and selects an offered applicant. The form suggests the applicant's name and contacts and fills in the role's department and position.
2. Admin or HR reviews those details, enters the rest of the employee information, and chooses whether to create a login account.
3. Saving creates the employee and their onboarding checklist, marks the application as hired and links it to the employee. PostgreSQL commits these changes together. An offer already used or withdrawn cannot create another hire.
4. The new hire uses the existing onboarding form and document checklist. HR reviews them and completes onboarding when the requirements have been met.

The handoff uses the existing foreign keys from `job_applications.hired_employee_id` and `onboarding.employee_id` to `employees.employee_id`. A manual employee record is still available for hires tracked elsewhere.
