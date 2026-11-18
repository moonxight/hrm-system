-- Apply once after the schema migrations on an empty demonstration database.
-- Set hrms.demo_password_hashes to a JSON object of username-to-bcrypt mappings in this transaction.
DO $copperleaf$
DECLARE
    hashes JSONB := COALESCE(NULLIF(current_setting('hrms.demo_password_hashes', true), '')::JSONB, '{}'::JSONB);
    person RECORD;
    department BIGINT;
    position BIGINT;
    worker BIGINT;
    hr BIGINT;
    manager BIGINT;
    intake BIGINT;
    operations_job BIGINT;
    sales_job BIGINT;
    candidate BIGINT;
    application BIGINT;
    course BIGINT;
    policy BIGINT;
    monthly DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    domain CONSTANT TEXT := '@copperleafoffice.example';
BEGIN
    PERFORM pg_advisory_xact_lock(195307116);
    IF EXISTS (SELECT 1 FROM employees) OR EXISTS (SELECT 1 FROM users) THEN
        RAISE EXCEPTION 'Copperleaf fixtures require an empty workforce';
    END IF;
    SELECT work_policy_id INTO STRICT policy FROM work_policies WHERE status='Active' ORDER BY work_policy_id LIMIT 1;

    FOR person IN SELECT * FROM (VALUES
        ('Naomi','Mwila','Female','Information Technology','Systems Administrator','Admin',17200,'Full-Time'),
        ('Thandiwe','Phiri','Female','Human Resources','HR Officer','HR',10500,'Full-Time'),
        ('Kelvin','Banda','Male','Operations','Operations Manager','Manager',15100,'Full-Time'),
        ('Martha','Zulu','Female','Sales & Marketing','Sales Manager','Manager',14750,'Full-Time'),
        ('Ruth','Tembo','Female','Operations','Operations Officer','Employee',7850,'Full-Time'),
        ('Isaac','Chileshe','Male','Sales & Marketing','Sales Executive','Employee',8300,'Full-Time'),
        ('Grace','Mbewe','Female','Operations','Operations Officer','Employee',7300,'Full-Time'),
        ('Leya','Chanda','Female','Finance','Accountant',NULL,9400,'Full-Time'),
        ('Brian','Mulenga','Male','Operations','Operations Officer',NULL,6900,'Full-Time'),
        ('Joseph','Sakala','Male','Sales & Marketing','Sales Executive',NULL,7100,'Part-Time'),
        ('Tasha','Bwalya','Female','Sales & Marketing','Sales Executive',NULL,7660,'Full-Time'),
        ('Daniel','Zimba','Male','Finance','Accountant',NULL,8200,'Contract')
    ) AS sample(first_name,last_name,gender,department_name,position_name,role_name,salary,employment_type)
    LOOP
        SELECT d.department_id,p.position_id INTO STRICT department,position
        FROM departments d JOIN positions p USING (department_id)
        WHERE d.department_name=person.department_name AND p.position_name=person.position_name;
        INSERT INTO employees(first_name,last_name,gender,email,department_id,position_id,employment_type,hire_date,work_policy_id)
        VALUES (person.first_name,person.last_name,person.gender,LOWER(person.first_name||'.'||person.last_name)||domain,
            department,position,person.employment_type,
            CASE WHEN person.first_name='Grace' THEN CURRENT_DATE-2 ELSE (monthly-INTERVAL '5 months')::DATE END,policy)
        RETURNING employee_id INTO worker;

        INSERT INTO employee_salaries(employee_id,basic_salary,effective_from)
        SELECT employee_id,person.salary,hire_date FROM employees WHERE employee_id=worker;
        IF person.role_name IS NOT NULL THEN
            IF COALESCE(hashes->>LOWER(person.first_name||'.'||person.last_name),'') !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN
                RAISE EXCEPTION 'Missing generated password hash for %', person.first_name;
            END IF;
            INSERT INTO users(employee_id,role_id,username,email,password_hash)
            SELECT worker,r.role_id,LOWER(person.first_name||'.'||person.last_name),e.email,
                hashes->>LOWER(person.first_name||'.'||person.last_name)
            FROM roles r CROSS JOIN employees e WHERE r.role_name=person.role_name AND e.employee_id=worker;
            IF NOT FOUND THEN RAISE EXCEPTION 'Missing role %', person.role_name; END IF;
        END IF;
    END LOOP;

    SELECT user_id INTO STRICT hr FROM users WHERE username='thandiwe.phiri';
    SELECT employee_id INTO STRICT manager FROM users WHERE username='kelvin.banda';
    INSERT INTO manager_assignments(manager_employee_id,employee_id)
    SELECT m.employee_id,e.employee_id FROM employees e JOIN users m
        ON (e.first_name IN ('Ruth','Grace','Brian') AND m.username='kelvin.banda')
        OR (e.first_name IN ('Isaac','Joseph','Tasha') AND m.username='martha.zulu');

    INSERT INTO onboarding(employee_id,start_date,onboarding_status,assigned_hr_id,restricts_access,completed_at)
    SELECT e.employee_id,e.hire_date,CASE WHEN e.first_name='Grace' THEN 'Not Started' ELSE 'Completed' END,hr,
        e.first_name='Grace',CASE WHEN e.first_name<>'Grace' THEN e.hire_date::TIMESTAMPTZ+INTERVAL '5 days' END
    FROM employees e;
    SELECT o.onboarding_id INTO STRICT intake FROM onboarding o JOIN employees e USING (employee_id) WHERE e.first_name='Grace';
    INSERT INTO onboarding_documents(onboarding_id,document_name,document_type)
    SELECT intake,label,kind FROM (VALUES
        ('National ID / NRC copy','Identification'),('Proof of address','Identification'),
        ('Bank account details','Financial'),('Academic certificates','Qualification')
    ) documents(label,kind);

    INSERT INTO leave_balances(employee_id,leave_type_id,year,total_days,used_days,remaining_days)
    SELECT e.employee_id,t.leave_type_id,EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,t.default_days,
        CASE WHEN e.first_name='Leya' AND t.leave_name='Annual Leave' THEN 1 ELSE 0 END,
        t.default_days-CASE WHEN e.first_name='Leya' AND t.leave_name='Annual Leave' THEN 1 ELSE 0 END
    FROM employees e CROSS JOIN leave_types t WHERE t.status='Active';
    INSERT INTO leave_requests(employee_id,leave_type_id,start_date,end_date,number_of_days,reason,status,approved_by,approved_at)
    SELECT e.employee_id,t.leave_type_id,s.day,s.day,1,s.reason,s.status,
        CASE WHEN s.status='Approved' THEN hr END,CASE WHEN s.status='Approved' THEN NOW()-INTERVAL '40 days' END
    FROM (VALUES
        ('Ruth','Annual Leave',CURRENT_DATE+5,'Annual leave','Pending'),
        ('Isaac','Annual Leave',CURRENT_DATE+7,'Family commitments','Pending'),
        ('Leya','Annual Leave',CURRENT_DATE-33,'Annual leave','Approved'),
        ('Tasha','Annual Leave',CURRENT_DATE-14,'Personal appointment','Rejected')
    ) s(first_name,leave_name,day,reason,status)
    JOIN employees e USING (first_name) JOIN leave_types t USING (leave_name);

    INSERT INTO attendance(employee_id,attendance_date,check_in,check_out,hours_worked,status,late_minutes,expected_hours,scheduled_start,scheduled_end)
    SELECT e.employee_id,calendar.day::DATE,
        CASE WHEN s.status NOT IN ('Absent','On Leave') THEN d.start_time+MAKE_INTERVAL(mins=>s.late) END,
        CASE WHEN s.status NOT IN ('Absent','On Leave') THEN d.end_time END,
        CASE WHEN s.status IN ('Absent','On Leave') THEN 0 ELSE GREATEST(d.expected_hours-s.late/60.0,0) END,
        CASE WHEN s.status IN ('Present','Late') AND d.expected_hours<6 THEN s.status||' (Half Day)' ELSE s.status END,
        s.late,d.expected_hours,d.start_time,d.end_time
    FROM employees e CROSS JOIN GENERATE_SERIES(CURRENT_DATE-48,CURRENT_DATE-1,INTERVAL '1 day') calendar(day)
    JOIN work_policy_days d ON d.work_policy_id=policy AND d.day_of_week=EXTRACT(DOW FROM calendar.day) AND d.is_working_day
    CROSS JOIN LATERAL (
        SELECT CASE
            WHEN e.first_name='Leya' AND calendar.day::DATE=CURRENT_DATE-33 THEN 'On Leave'
            WHEN (EXTRACT(DOY FROM calendar.day)::INTEGER+e.employee_id)%43=0 THEN 'Absent'
            WHEN (EXTRACT(DOY FROM calendar.day)::INTEGER+e.employee_id)%8=0 THEN 'Late'
            ELSE 'Present' END status,
            CASE WHEN (EXTRACT(DOY FROM calendar.day)::INTEGER+e.employee_id)%8=0 THEN 23 ELSE 0 END late
    ) s WHERE calendar.day::DATE>=e.hire_date;

    INSERT INTO payroll(employee_id,pay_period_start,pay_period_end,basic_salary,total_allowances,total_deductions,
        gross_salary,net_salary,payroll_status,created_by,processed_by,processed_at)
    SELECT e.employee_id,mo.start::DATE,(mo.start+INTERVAL '1 month - 1 day')::DATE,s.basic_salary,
        350,200,s.basic_salary+350,s.basic_salary+150,'Processed',hr,hr,mo.start+INTERVAL '1 month'
    FROM employees e JOIN employee_salaries s USING (employee_id)
    CROSS JOIN GENERATE_SERIES(monthly-INTERVAL '3 months',monthly-INTERVAL '1 month',INTERVAL '1 month') mo(start)
    WHERE e.hire_date<=mo.start::DATE;
    INSERT INTO payroll_items(payroll_id,item_type,item_name,amount)
    SELECT payroll_id,item.kind,item.label,item.amount
    FROM payroll CROSS JOIN (VALUES ('Allowance','Transport allowance',350),('Deduction','Staff advance repayment',200)) item(kind,label,amount);
    INSERT INTO payroll_payments(payroll_id,paid_on,payment_method,payment_reference,amount,currency,recorded_by)
    SELECT p.payroll_id,p.pay_period_end+1,'Bank transfer',
        'COPPER-'||TO_CHAR(p.pay_period_start,'YYYYMM')||'-'||e.employee_number,p.net_salary,p.currency,hr
    FROM payroll p JOIN employees e USING (employee_id)
    WHERE p.pay_period_start < (monthly-INTERVAL '1 month')::DATE OR e.first_name NOT IN ('Ruth','Isaac','Leya');
    UPDATE payroll p SET payment_date=pp.paid_on FROM payroll_payments pp WHERE pp.payroll_id=p.payroll_id;

    INSERT INTO employee_benefits(employee_id,benefit_id,enrollment_date,amount)
    SELECT e.employee_id,b.benefit_id,e.hire_date,b.default_amount
    FROM employees e CROSS JOIN benefits b WHERE b.benefit_name IN ('Medical Insurance','Lunch Allowance') AND e.first_name<>'Grace';
    INSERT INTO training_courses(title,description,provider,start_date,end_date,capacity,status,created_by)
    VALUES ('Stock control and safe handling','Practical checklist for receiving, shelving and dispatch.','Copperleaf Learning',CURRENT_DATE-10,CURRENT_DATE+7,12,'In Progress',hr)
    RETURNING course_id INTO course;
    INSERT INTO training_enrollments(course_id,employee_id,status)
    SELECT course,employee_id,CASE WHEN first_name='Brian' THEN 'Completed' ELSE 'In Progress' END
    FROM employees WHERE first_name IN ('Ruth','Brian');

    INSERT INTO job_vacancies(title,description,department_id,position_id,requirements,status,closing_date,manager_employee_id,created_by)
    SELECT 'Inventory and Dispatch Coordinator','Coordinate stock receipts and the weekly dispatch schedule.',p.department_id,p.position_id,
        'Stock control, spreadsheet reporting and supplier follow-up.','Open',CURRENT_DATE+21,manager,hr
    FROM positions p WHERE p.position_name='Operations Officer' RETURNING vacancy_id INTO operations_job;
    INSERT INTO job_vacancies(title,description,department_id,position_id,requirements,status,closing_date,manager_employee_id,created_by)
    SELECT 'Business Accounts Assistant','Follow up with business customers and assist with order enquiries.',p.department_id,p.position_id,
        'Clear customer communication and experience keeping accurate order records.','Open',CURRENT_DATE+30,u.employee_id,hr
    FROM positions p CROSS JOIN users u WHERE p.position_name='Sales Executive' AND u.username='martha.zulu'
    RETURNING vacancy_id INTO sales_job;
    FOR person IN SELECT * FROM (VALUES
        ('Chipo Nkhoma','chipo.nkhoma@candidate.copperleafoffice.example','Offered','Reference check completed.',operations_job),
        ('Kondwani Jere','kondwani.jere@candidate.copperleafoffice.example','Interview','Shortlisted for stock reporting experience.',operations_job),
        ('Mwaka Chileshe','mwaka.chileshe@candidate.copperleafoffice.example','Submitted','',operations_job),
        ('Taonga Nyirenda','taonga.nyirenda@candidate.copperleafoffice.example','Shortlisted','Customer support background.',sales_job),
        ('Chanda Silwamba','chanda.silwamba@candidate.copperleafoffice.example','Submitted','',sales_job),
        ('Mukuka Musonda','mukuka.musonda@candidate.copperleafoffice.example','Offered','Offer ready for the onboarding walkthrough.',sales_job)
    ) applicants_data(full_name,email,status,notes,job)
    LOOP
        INSERT INTO applicants(full_name,email) VALUES (person.full_name,person.email) RETURNING applicant_id INTO candidate;
        INSERT INTO job_applications(vacancy_id,applicant_id,cover_letter,status,decision_notes,created_by)
        VALUES (person.job,candidate,'Application recorded by HR.',person.status,NULLIF(person.notes,''),hr)
        RETURNING application_id INTO application;
        IF person.status IN ('Offered','Interview') THEN
            INSERT INTO interviews(application_id,interviewer_employee_id,scheduled_at,status,result)
            SELECT application,v.manager_employee_id,
                CASE WHEN person.status='Offered' THEN NOW()-INTERVAL '5 days' ELSE NOW()+INTERVAL '2 days' END,
                CASE WHEN person.status='Offered' THEN 'Completed' ELSE 'Scheduled' END,
                CASE WHEN person.status='Offered' THEN 'Pass' END
            FROM job_vacancies v WHERE v.vacancy_id=person.job;
        END IF;
    END LOOP;
    INSERT INTO announcements(title,body,audience,created_by)
    VALUES ('Copperleaf office update','Please confirm next week''s dispatch availability with your team lead by Friday.','All',hr);
    INSERT INTO notifications(user_id,title,entity,entity_id)
    SELECT u.user_id,'Welcome to Copperleaf Office Supplies','employees',u.employee_id FROM users u;
END
$copperleaf$;
