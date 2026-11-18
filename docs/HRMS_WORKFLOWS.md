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
| ???? | Role-based access | Admin and HR manage payroll and hiring. Managers see finalized payroll for themselves and their assigned team. Employees see their own finalized records. |

## Record a payroll payment

1. Admin or HR creates a draft for an employee with a salary that covers the pay period. The draft uses recurring components in effect on the period's last day and can receive extra allowances and deductions.
2. Admin or HR processes the draft. HRMS finalizes the totals and captures the attendance snapshot.
3. After payment is completed outside HRMS, Admin or HR records the payment date, method and receipt or transaction reference. HRMS uses the finalized net salary and currency, and logs who recorded it.
4. The employee sees the recorded date on their payslip. The receipt reference is visible to Admin and HR. The system creates an in-app alert for the employee.

`payroll_payments.payroll_id` is the primary key and points to the payroll record. One finalized payroll can have one full payment record. Retrying the same submission returns that record. A different submission for the same payroll returns a conflict. Some older records have a processing date in `payroll.payment_date`. Payment status now comes from the separate payment record.

## Hire an applicant and begin onboarding

1. Admin or HR opens Employee Directory and selects an offered applicant. The form suggests the applicant's name and contacts and fills in the role's department and position.
2. Admin or HR reviews those details, enters the rest of the employee information, and chooses whether to create a login account.
3. Saving creates the employee and their onboarding checklist, marks the application as hired and links it to the employee. PostgreSQL commits these changes together. An offer already used or withdrawn cannot create another hire.
4. The new hire uses the existing onboarding form and document checklist. HR reviews them and completes onboarding when the requirements have been met.

The handoff uses the existing foreign keys from `job_applications.hired_employee_id` and `onboarding.employee_id` to `employees.employee_id`. A manual employee record is still available for hires tracked elsewhere.
