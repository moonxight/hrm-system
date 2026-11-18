# Nexa People demonstration

Copperleaf Office Supplies is a fictitious small business with Operations, Sales, Finance, HR and IT. Staff addresses use the reserved domain `copperleafoffice.example`. Salaries and payment references are sample records in ZMW. Starting figures are independent of the deployed site's payroll policy.

## Accounts

| Role | Sign-in | Demonstration |
| --- | --- | --- |
| Admin | `naomi.mwila` | People access and workforce reporting |
| HR | `thandiwe.phiri` | Recruitment, onboarding, payroll and payment records |
| Operations manager | `kelvin.banda` | Operations team, leave approvals and assigned vacancies |
| Sales manager | `martha.zulu` | Sales team and assigned vacancies |
| Operations employee | `ruth.tembo` | Attendance, leave, benefits and personal payslips |
| Sales employee | `isaac.chileshe` | Separate team for access checks |
| New starter | `grace.mbewe` | Onboarding checklist and restricted navigation |

The workspace owner distributes the demonstration passwords separately. Database IDs are PostgreSQL identities. New employee numbers use an independent sequence and appear after saving. Department, position, manager and vacancy selections use names.

## Show the workflow

1. Sign in as HR and open Recruitment. Select **Inventory and Dispatch Coordinator**. Open offered applicant Chipo Nkhoma and use **Hire and start onboarding**. Check the populated form, supply the remaining details and save. Confirm the employee number, login details and checklist, then confirm the application moved to **Hired**.
2. Sign in as Grace to show the new-starter checklist. Use only fictional attachments. From HR, open Onboarding to review the form and documents. See [Onboarding access](ONBOARDING_ACCESS.md) for the complete checklist and [workflow details](HRMS_WORKFLOWS.md) for the database relationships.
3. Sign in as Kelvin. Review Ruth's team leave request. Isaac is assigned to Martha. Confirm Kelvin cannot open Isaac's payslip details. Sign in as Isaac to check he can see his own finalized payslips.
4. Sign in as HR and open Payroll. Select Ruth's most recent finalized payroll without a payment record. Record a simulated payment with a new reference, then verify the payment date on Ruth's payslip. The dashboard's payment chart should reflect the change.
5. Sign in as Naomi. Open **People access** to check the named accounts and their roles. Check the dashboard charts and use the date filter to focus on payroll or attendance.

## Prepare another workspace

Apply the schema migrations to an empty database intended for demonstration. Run [the Copperleaf fixture](../database/demo/copperleaf.sql) explicitly with a transaction-local `hrms.demo_password_hashes` map. The fixture requires a generated bcrypt hash for each username and refuses to run when employee or user records already exist. Keep credentials outside source control. Use synthetic documents and keep outbound email in test mode if configured.
